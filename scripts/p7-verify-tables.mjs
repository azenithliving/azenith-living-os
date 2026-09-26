/**
 * p7-verify-tables.mjs — does the swarm's data actually live under ops_*, and can
 * the retired names still be read and written without opening a security hole?
 *
 * Renaming fifteen tables is a metadata operation, so "it ran without error" is
 * not evidence. This checks the four things that can silently be wrong:
 *
 *  1. every table reached its new name and no base relation kept the old one;
 *  2. each retired name survived as an alias, and the alias is writable — not
 *     just readable — because PostgREST inserts through it too;
 *  3. the alias is a SECURITY INVOKER view. Checked by counting rows as `anon`
 *     through the alias and through the table: a view created the default way
 *     runs as its owner (postgres), which bypasses row security and would show
 *     the whole table where the table itself shows nothing;
 *  4. the enterprise_agents view still contains the swarm leader after P7-M2
 *     moved his key out from under the filter the view was written with.
 *
 * Read-only. Usage: node scripts/p7-verify-tables.mjs
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const p = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const OLD = [
  "qayyim_benchmark_runs", "qayyim_drafts", "qayyim_experiment_events", "qayyim_experiments",
  "qayyim_goals", "qayyim_rival_snapshots", "qayyim_rivals", "qayyim_semantic_memory",
  "qayyim_suggestions", "qayyim_swarm_events", "qayyim_swarm_learnings", "qayyim_swarm_tasks",
  "qayyim_sync_events", "qayyim_task_metrics", "qayyim_telemetry_events",
];
const NEW = OLD.map((t) => "ops_" + t.slice(7));

let bad = 0;
const ok = (label, pass, detail = "") => {
  if (!pass) bad++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const kinds = await p.$queryRawUnsafe(
  `select c.relname::text as n, c.relkind::text as k from pg_class c
    where c.relnamespace='public'::regnamespace
      and (c.relname like 'qayyim%' or c.relname like 'ops_%')
      and c.relname not like '\_p%\_backup%'`
);
const kindOf = new Map(kinds.map((r) => [r.n, r.k]));

ok("no base table kept the retired name", !OLD.some((t) => kindOf.get(t) === "r"),
  OLD.filter((t) => kindOf.get(t) === "r").join(", ") || "0 left");
ok("all fifteen tables answer to ops_*", NEW.every((t) => kindOf.get(t) === "r"),
  NEW.filter((t) => kindOf.get(t) !== "r").join(", ") || "15 present");
ok("each retired name survives as a view", OLD.every((t) => kindOf.get(t) === "v"),
  OLD.filter((t) => kindOf.get(t) !== "v").join(", ") || "15 aliases");

// 2 + 3: alias must be writable and must not outrank row security.
for (let i = 0; i < OLD.length; i++) {
  const alias = OLD[i], table = NEW[i];
  const [meta] = await p.$queryRawUnsafe(
    `select (select relrowsecurity from pg_class where oid = to_regclass('public.'||$2)) as table_rls,
            coalesce(array_to_string((select reloptions from pg_class where oid = to_regclass('public.'||$1)), ','), '') as view_options,
            (select is_updatable from information_schema.views where table_schema='public' and table_name = $1::name) as updatable,
            has_table_privilege('anon', 'public.'||$1, 'SELECT') as anon_select,
            has_table_privilege('authenticated', 'public.'||$1, 'INSERT') as auth_insert,
            has_table_privilege('service_role', 'public.'||$1, 'UPDATE') as svc_update`,
    alias, table
  );
  if (!meta) {
    ok(`alias ${alias}`, false, "the alias does not exist yet");
    continue;
  }
  // The flag lives in the view's reloptions; the pass condition below is the
  // semantic test, because a flag that says the right thing while the view
  // behaves the wrong way is exactly the failure being guarded against.
  const invokerOk = /security_invoker=true/.test(String(meta.view_options));
  const grantsOk = Boolean(meta.anon_select && meta.auth_insert && meta.svc_update);

  // An UPDATE that names a real column and matches no row: it needs the same
  // privileges and the same updatable-view resolution a production insert does,
  // without touching a byte. The column is chosen from the BASE table, because a
  // view's own attribute list does not show that the column underneath it is
  // GENERATED ALWAYS — and assigning to that one is refused for reasons that have
  // nothing to do with the alias working or not.
  let wrote = true, wroteWhy = "";
  try {
    const [col] = await p.$queryRawUnsafe(
      `select attname::text as c from pg_attribute
        where attrelid = to_regclass('public.'||$1) and attnum > 0
          and not attisdropped and attidentity = ''
        order by attnum limit 1`,
      table
    );
    const r = await p.$executeRawUnsafe(
      `UPDATE public."${alias}" SET "${col.c}" = "${col.c}" WHERE false`
    );
    wrote = meta.updatable === "YES" && Number(r) === 0;
    if (!wrote) wroteWhy = `updatable=${meta.updatable} rows=${r}`;
  } catch (e) {
    wrote = false;
    wroteWhy = String(e.message).split("\n").filter(Boolean).pop() ?? "error";
  }

  let leak = false, leakRan = false, counts = "";
  try {
    const viaAlias = await p.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE anon`);
      const r = await tx.$queryRawUnsafe(`select count(*)::bigint as n from public."${alias}"`);
      return Number(r[0].n);
    });
    const viaTable = await p.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE anon`);
      const r = await tx.$queryRawUnsafe(`select count(*)::bigint as n from public."${table}"`);
      return Number(r[0].n);
    });
    leakRan = true;
    counts = `as anon: alias=${viaAlias} table=${viaTable}`;
    leak = viaAlias !== viaTable;
  } catch (e) {
    counts = `probe unavailable: ${String(e.message).split("\n")[0].slice(0, 60)}`;
  }

  ok(`alias ${alias}`, invokerOk && wrote && grantsOk && leakRan && !leak,
    `rls=${meta.table_rls ? "on" : "OFF"} invoker=${invokerOk ? "yes" : "NO"} granted=${grantsOk ? "yes" : "NO"} updatable=${wrote ? "yes" : "NO"} ${counts}${wroteWhy ? ` (${wroteWhy})` : ""}`);
}

// 4: the leader is back in the view that dropped him.
const inView = await p.$queryRawUnsafe(
  `select agent_key::text as k from public.enterprise_agents order by 1`
);
ok("enterprise_agents contains the swarm leader", inView.some((r) => r.k === "ops-lead"),
  inView.map((r) => r.k).join(", ") || "empty");

// Row parity against the pre-migration snapshots, where one exists.
for (const t of OLD) {
  const snap = `_p7_backup_${t}`;
  const table = "ops_" + t.slice(7);
  let live = null, snapRows = null;
  try {
    const [r] = await p.$queryRawUnsafe(`select count(*)::bigint as n from public."${table}"`);
    live = Number(r.n);
  } catch {
    ok(`rows ${table}`, false, "the renamed table is not there yet");
    continue;
  }
  try {
    const [s] = await p.$queryRawUnsafe(`select count(*)::bigint as n from public."${snap}"`);
    snapRows = Number(s.n);
  } catch {
    continue; /* no snapshot for this table — nothing to compare against */
  }
  ok(`rows ${t}: ${table} has ${live}, snapshot has ${snapRows}`, live >= snapRows);
}

await p.$disconnect();
console.log(bad ? `\n${bad} check(s) failed` : "\nP7-M5 tables verified");
process.exit(bad ? 1 : 0);
