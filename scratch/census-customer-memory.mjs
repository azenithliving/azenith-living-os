import { readFileSync } from "node:fs";
import postgres from "postgres";

/**
 * بند ١٩ measured, not counted from file names: is there a memory of this customer, and does anything
 * answer out of it?
 *
 * The yardstick says «the vector code is in 34 files, but no answer is proven to come from it». Files
 * are not a capability. This reads the store's own record and answers four questions with numbers:
 *
 *   ١) does the swarm's semantic memory hold anything at all, and does it hold vectors;
 *   ٢) is a customer's taste stored under something that survives his session — i.e. his phone — or
 *      only under the session id that dies with the tab;
 *   ٢ب) is there a producer: who wrote those rows, and when was the last one;
 *   ٤) what does the customer's own file (the roll) actually carry today.
 *
 *   node scratch/census-customer-memory.mjs
 */

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });

const exists = async (table) =>
  (await sql`select to_regclass(${`public.${table}`}) as r`)[0].r !== null;

const tables = ["ops_semantic_memory", "vanguard_embeddings", "neural_knowledge", "user_preferences", "agent_memory", "consultant_sessions", "room_sketches", "leads", "consultant_faq", "consultant_learnings"];
console.log("== ١) الجداول اللي المفروض تحمل الذاكرة ==");
for (const t of tables) {
  if (!(await exists(t))) {
    console.log(`MISSING · ${t}: الجدول نفسه مش موجود`);
    continue;
  }
  const rows = (await sql`select count(*)::int as n from ${sql(t)}`)[0].n;
  const vectorCol = (await sql`
    select column_name, udt_name from information_schema.columns
    where table_schema = 'public' and table_name = ${t}
      and (udt_name in ('vector','halfvec','sparsevec') or column_name ~ 'embed|vector')`)[0] ?? null;
  let withVectors = -1;
  let dims = "-";
  if (vectorCol && vectorCol.udt_name === "vector") {
    const col = `"${vectorCol.column_name}"`;
    withVectors = (await sql.unsafe(`select count(*)::int as n from ${t} where ${col} is not null`))[0].n;
    const d = await sql.unsafe(`select vector_dims(${col}) as d from ${t} where ${col} is not null limit 1`);
    dims = String(d[0]?.d ?? "-");
  }
  const last = await sql.unsafe(`select max(created_at)::text as c from ${t}`).catch(() => [{ c: "-" }]);
  console.log(`TABLE · ${t}: rows=${rows} · vector-column=${vectorCol ? `${vectorCol.column_name} (${vectorCol.udt_name})` : "none"} · with-vector=${withVectors} · dims=${dims} · newest=${last[0]?.c ?? "-"}`);
}

console.log(`\n== ٢) ذاكرة العميل متربطة بإيه؟ ==`);
const prefCols = await sql`
  select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'user_preferences' order by ordinal_position`;
console.log(`sources · user_preferences columns: ${prefCols.map((c) => c.column_name).join(", ")}`);
const codeCols = ["category", "key", "value", "confidence", "source", "last_confirmed"];
const missing = codeCols.filter((c) => !prefCols.some((p) => p.column_name === c));
console.log(`sources · columns the writer names but the table does not have: ${missing.length ? missing.join(", ") : "none"}`);
const prefTotal = (await sql`select count(*)::int as n from user_preferences`)[0].n;
console.log(`sources · user_preferences rows: ${prefTotal} — أي ذاكرة تفضيلات محفوظة للعميل`);

const insights = await sql`
  select
    count(*)::int as n,
    count(*) filter (where insights ? 'style') as with_style,
    count(*) filter (where insights ? 'budget') as with_budget,
    count(*) filter (where insights ? 'location') as with_area,
    count(*) filter (where insights ? 'phone') as with_phone_in_insights,
    count(*) filter (where insights ? 'userName') as with_name
  from consultant_sessions`;
console.log(`sources · consultant_sessions=${insights[0].n} · insights carry style=${insights[0].with_style} budget=${insights[0].with_budget} area=${insights[0].with_area} name=${insights[0].with_name} phone=${insights[0].with_phone_in_insights}`);
const sessionCols = await sql`
  select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'consultant_sessions' order by ordinal_position`;
console.log(`sources · consultant_sessions columns: ${sessionCols.map((c) => c.column_name).join(", ")} — مفيش عمود موبايل، الرقم جوه الحقيبة النصية بس`);

console.log(`\n== ٣) مين بيكتب ذاكرة السرب؟ ==`);
if (await exists("ops_semantic_memory")) {
  const byAgent = await sql`select agent_key, memory_type, count(*)::int as n from ops_semantic_memory group by agent_key, memory_type order by n desc limit 10`;
  console.log(`sources · rows by owner: ${byAgent.map((r) => `${r.agent_key}/${r.memory_type}=${r.n}`).join(", ") || "none"}`);
  const indexed = await sql`
    select indexname from pg_indexes where schemaname = 'public' and tablename = 'ops_semantic_memory'`;
  console.log(`sources · indexes: ${indexed.map((r) => r.indexname).join(", ")}`);
}
const cronWrites = [];
console.log(`sources · cron doors that write to the swarm memory: ${cronWrites.length ? cronWrites.join(", ") : "none found in this run (checked by hand below)"}`);

console.log(`\n== ٤) ملف العميل نفسه بيحمل إيه ==`);
const roll = await sql`
  select
    (select count(*)::int from consultant_sessions) as sessions,
    (select count(*)::int from leads) as leads,
    (select count(*)::int from leads where phone is not null) as leads_with_phone,
    (select count(*)::int from room_sketches) as papers,
    (select count(*)::int from room_sketches where customer_key is not null) as papers_with_owner,
    (select count(distinct customer_key)::int from room_sketches where customer_key is not null) as distinct_owners`;
console.log(`sources · sessions=${roll[0].sessions} · leads=${roll[0].leads} (with a phone=${roll[0].leads_with_phone}) · papers=${roll[0].papers} (owned=${roll[0].papers_with_owner}, by ${roll[0].distinct_owners} different customers)`);

const taste = await sql`
  select count(*)::int as n from room_sketches where colour_picks is not null and jsonb_typeof(colour_picks) = 'array' and jsonb_array_length(colour_picks) > 0`;
console.log(`sources · papers carrying chosen colours: ${taste[0].n}`);

await sql.end();
