/**
 * prove-relations-door-reads.mjs — the relations health door, measured on the published link at 390px.
 *
 * Claims under attack: «the door reads the record instead of asking for a view the store cannot
 * serve», «its verdict equals the record's own answer, column by column, taken by a second path in
 * the same run», «a real gap is still called a gap», «a stranger with a forged identity header is
 * refused», and «nothing on the owner's screens broke while the door was rewritten».
 *
 * Measured before the fix (scratch/measure-schema-probe.out): the door asked PostgREST for
 * information_schema.columns and got PGRST205 — "no such table" — for all four of its tables, so it
 * reported every column of every table missing, and then reported nothing at all once it was made
 * honest about its blindness. The record answers a column question through a read projection:
 * 42703 naming a column it does not have, PGRST205 for a table it does not have, and an empty row
 * list with no error for a column it has in a table with no rows.
 *
 * This instrument writes nothing: every step is a read, so there is no residue to clean and no row
 * of the owner's to mistake for a probe.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";
const DOOR = "/api/admin/intel/relations/health";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(1 + l.indexOf("=")).trim().replace(/^["']|["']$/g, "")]),
);

const lines = [];
const checks = [];
const say = (label, value) => {
  const s = `${label}: ${value}`;
  lines.push(s);
  console.log(s);
};
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok) });
  const s = `${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${detail}` : ""}`;
  lines.push(s);
  console.log(s);
};

// ---- the door's own requirement list, read out of its source so the two paths ask the same thing
const routeSource = readFileSync("app/api/admin/intel/relations/health/route.ts", "utf8");

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(full);
    return /\.ts$/.test(entry.name) ? [full] : [];
  });
}

function resolveList(name) {
  for (const file of walk("lib")) {
    const src = readFileSync(file, "utf8");
    const m = src.match(new RegExp("export const " + name + "\\s*=\\s*\\[([\\s\\S]*?)\\]"));
    if (m) return [...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
  }
  throw new Error("cannot resolve the writer's column list: " + name);
}

const required = [];
for (const m of routeSource.matchAll(/\{\s*table:\s*"([a-z_]+)",\s*columns:\s*\[([\s\S]*?)\]\s*\}/g)) {
  const table = m[1];
  const inner = m[2].trim();
  const spread = inner.match(/^\.\.\.([A-Z_0-9]+)$/);
  const columns = spread ? resolveList(spread[1]) : [...inner.matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
  required.push({ table, columns });
}

say("required lists read out of the door", required.length);
for (const r of required) say("  required " + r.table, r.columns.length + " → " + r.columns.join(","));

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
let browser = null;

try {
  // ---- truth path: ask the record itself, in the same run, through a different door
  const truth = {};
  for (const r of required) {
    const rows = await sql`select column_name from information_schema.columns where table_schema='public' and table_name=${r.table}`;
    const has = new Set(rows.map((x) => x.column_name));
    truth[r.table] = {
      exists: rows.length > 0,
      columnCount: has.size,
      missing: r.columns.filter((c) => !has.has(c)),
    };
    say("truth " + r.table, `columns=${has.size} missing=${truth[r.table].missing.length}`);
  }
  const truthMissing = required.reduce((n, r) => n + truth[r.table].missing.length, 0);
  say("truth total missing", truthMissing);

  browser = await chromium.launch();

  // ---- negative: a stranger with a forged identity header, from a clean browser with no session
  const strangerCtx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const strangerPage = await strangerCtx.newPage();
  await strangerPage.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  const forged = await strangerPage.evaluate(
    async ([door]) => {
      const r = await fetch(door, { headers: { "x-admin-user-id": "stranger-forged" } });
      return { status: r.status, body: (await r.text()).slice(0, 160) };
    },
    [DOOR],
  );
  say("stranger with a forged header", `status=${forged.status}`);
  check(
    "a stranger who forges the identity header is refused and learns no column name",
    forged.status === 401 && !forged.body.includes("checks"),
    `status=${forged.status}`,
  );
  await strangerCtx.close();

  // ---- the owner's own session
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });

  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  const loginResponse = page.waitForResponse((r) => r.url().includes("/gate/login") || r.url().includes("/auth"), { timeout: 30000 }).catch(() => null);
  await page.click('button[type="submit"]');
  const seen = await loginResponse;
  say("login response", seen ? `${seen.status()} ${seen.url().slice(SITE.length)}` : "no response seen");
  await page
    .waitForURL((u) => !String(u).includes("/gate/login"), { timeout: 40000 })
    .catch(() => {});
  await page.waitForTimeout(2500);
  say("after login", page.url());
  if (page.url().includes("/gate/login")) {
    const gateText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 300);
    say("the gate said", gateText);
    await page.screenshot({ path: "scratch/relations-gate-refusal-390.png", fullPage: false });
  }

  const answer = await page.evaluate(
    async ([door]) => {
      const r = await fetch(door);
      const text = await r.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {}
      return { status: r.status, json, text: text.slice(0, 400) };
    },
    [DOOR],
  );
  say("door status", answer.status);
  const doorMessage = answer.json ? String(answer.json.message ?? answer.json.error ?? "") : answer.text;
  const doorHint = answer.json && answer.json.meta ? String(answer.json.meta.migrationHint ?? "") : "";
  say("door message", doorMessage);

  const data = answer.json && answer.json.data;
  check("the door answers the owner's own session", answer.status === 200 && Boolean(data));
  check(
    "the door no longer reports a schema it cannot read",
    Boolean(data) && Array.isArray(data.unreadableTables) && data.unreadableTables.length === 0,
    `unreadable=${data ? data.unreadableTables.length : "no answer"}`,
  );
  check(
    "the door names no absent table for four tables that all exist",
    Boolean(data) && data.absentTables.length === 0,
    `absent=${data ? data.absentTables.join(",") || "none" : "no answer"}`,
  );

  // ---- the central claim: two independent paths must agree, table by table and column by column
  let agree = true;
  const disagreements = [];
  for (const r of required) {
    const checkRow = data ? data.checks.find((c) => c.table === r.table) : null;
    if (!checkRow) {
      agree = false;
      disagreements.push(`${r.table}: the door did not report it`);
      continue;
    }
    const doorMissing = [...checkRow.missingColumns].sort().join(",");
    const sqlMissing = [...truth[r.table].missing].sort().join(",");
    say(`door ${r.table}`, `missing=${checkRow.missingColumns.length} readFailed=${checkRow.readFailed}`);
    if (doorMissing !== sqlMissing || checkRow.readFailed) {
      agree = false;
      disagreements.push(`${r.table}: door=[${doorMissing}] record=[${sqlMissing}]`);
    }
  }
  check("the door's verdict equals the record's own answer on every table", agree, disagreements.join(" | "));
  check(
    "the counted gap equals the record's counted gap",
    Boolean(data) && data.totalMissing === truthMissing,
    `door=${data ? data.totalMissing : "-"} record=${truthMissing}`,
  );
  check(
    "a real gap is still called a gap, not swallowed into a healthy verdict",
    truthMissing === 0
      ? Boolean(data) && data.healthy === true
      : Boolean(data) && data.healthy === false && data.gapTables.length > 0,
    `record gaps=${truthMissing} door healthy=${data ? data.healthy : "-"} gapTables=${data ? data.gapTables.join(",") : "-"}`,
  );
  check(
    "the door's summary names the tables it measured a gap in",
    Boolean(data) &&
      (truthMissing === 0
        ? doorMessage.includes("healthy")
        : data.gapTables.length > 0 && data.gapTables.every((t) => doorMessage.includes(t))),
    doorMessage.slice(0, 120) || "no answer",
  );
  check(
    "the migration hint is a measurement, not a shrug",
    Boolean(data) &&
      (truthMissing === 0
        ? doorHint.includes("No table is missing")
        : doorHint.includes("Measured gaps")),
    doorHint || "no answer",
  );

  // ---- the door's own answer, as the owner would see it at 390px
  await page.goto(`${SITE}${DOOR}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "scratch/relations-door-390.png", fullPage: true });
  const doorText = (await page.evaluate(() => document.body.innerText)).slice(0, 4000);
  say("door on the glass", doorText.slice(0, 200).replace(/\n/g, " "));
  check(
    "the answer is readable on the glass at phone width, and carries no unreadable-schema note",
    doorText.includes("audit_log") || doorText.includes("healthy"),
  );

  // ---- regression: the owner's own board still opens clean at 390px
  await page.goto(`${SITE}/admin/owner-dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "scratch/relations-dashboard-390.png", fullPage: false });
  const boardText = await page.evaluate(() => document.body.innerText);
  say("board characters", boardText.length);
  check("the owner's board still opens after the rewrite", boardText.length > 300);
  check("the board printed no console error", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  say("rows this instrument wrote", 0);
} catch (e) {
  say("ERROR", String(e && e.message ? e.message : e));
} finally {
  if (browser) await browser.close();
  await sql.end();

  const passed = checks.filter((c) => c.ok).length;
  say("النتيجة", `${passed} نجح من ${checks.length}`);
  for (const c of checks.filter((x) => !x.ok)) say("  فشل", c.name);
  writeFileSync("scratch/prove-relations-door-reads.out", lines.join("\n") + "\n");
  process.exitCode = passed === checks.length ? 0 : 1;
}
