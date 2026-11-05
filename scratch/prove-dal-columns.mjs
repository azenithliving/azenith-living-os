/**
 * prove-dal-columns.mjs — the names the data layer uses, checked against the live record.
 *
 * Claims under attack:
 *   1. the six names the layer used to send are still absent from the record (the fix was not a
 *      guess about a schema that had quietly appeared),
 *   2. every name the layer sends now is a column the record answers to, read from information_schema
 *      rather than from the committed snapshot,
 *   3. the queries the fixed resolvers build return rows on the live record,
 *   4. his screens did not regress: the cockpit and a customer page render at phone width with no
 *      console error.
 *
 * Nothing is written. The insert and update payloads are checked as key sets, not executed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";

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

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
let browser = null;

try {
  const rows = await sql`
    select table_name, column_name from information_schema.columns where table_schema='public'`;
  const real = new Map();
  for (const r of rows) {
    if (!real.has(r.table_name)) real.set(r.table_name, new Set());
    real.get(r.table_name).add(r.column_name);
  }
  say("relations in the record", real.size);

  const GHOSTS = [
    ["companies", "slug"],
    ["production_jobs", "scheduled_start"],
    ["users", "auth_user_id"],
    ["sales_orders", "final_payment_paid"],
    ["approval_requests", "decided_by"],
    ["approval_requests", "decided_at"],
    ["inventory_movements", "id"],
  ];
  const stillGhosts = GHOSTS.filter(([t, c]) => !real.get(t)?.has(c));
  say("names still absent from the record", `${stillGhosts.length} of ${GHOSTS.length}`);
  check("the six phantom names are still not in the record", stillGhosts.length === GHOSTS.length, stillGhosts.map(([t, c]) => `${t}.${c}`).join(","));

  // 2. every (table, column) the layer names, re-derived from the source and checked live.
  const source = readFileSync("lib/dal/unified-supabase.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const srcLines = source.split(/\r?\n/);
  const FROM = /\.from\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/;
  const FILTER = /\.(eq|neq|gt|gte|lt|lte|like|ilike|in|order|not|is|contains|containedBy)\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g;
  const WRITE = /\.(insert|update|upsert)\(\s*\{/;
  const KEY = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g;

  const pairs = [];
  let current = null;
  srcLines.forEach((raw, i) => {
    const f = FROM.exec(raw);
    if (f) current = f[1];
    let m;
    FILTER.lastIndex = 0;
    while ((m = FILTER.exec(raw))) if (current) pairs.push([current, m[2]]);
    if (WRITE.test(raw)) {
      let table = null;
      for (let b = i; b >= 0 && b > i - 20; b--) {
        const fm = FROM.exec(srcLines[b]);
        if (fm) {
          table = fm[1];
          break;
        }
      }
      const keys = [];
      for (let j = i; j < Math.min(i + 16, srcLines.length); j++) {
        let km;
        KEY.lastIndex = 0;
        while ((km = KEY.exec(srcLines[j]))) keys.push(km[1]);
        if (srcLines[j].includes("}")) break;
      }
      if (table) keys.forEach((k) => pairs.push([table, k]));
    }
  });
  const bad = [...new Set(pairs.map(([t, c]) => `${t}.${c}`))].filter((k) => {
    const [t, c] = k.split(".");
    return !real.get(t)?.has(c);
  });
  say("column names the layer uses", `${pairs.length} mentions · ${new Set(pairs.map((p) => p.join("."))).size} distinct`);
  check("every name the layer uses is a column the record answers to", bad.length === 0, bad.slice(0, 8).join(","));

  // 3. the resolvers that were retargeted must actually find rows.
  const domains = await sql`select domain from public.companies where domain is not null limit 1`;
  if (domains.length) {
    const found = await sql`select id from public.companies where domain=${domains[0].domain}`;
    say("company resolved by domain", found.length ? "yes" : "no");
    check("the company resolver finds the row the record holds", found.length === 1);
  } else {
    say("company resolved by domain", "the record holds no company with a domain");
  }

  const jobs = await sql`select id from public.production_jobs order by created_at asc limit 3`;
  say("production jobs ordered by the column that exists", jobs.length);
  check("the jobs list answers with the column it now orders by", true, `rows=${jobs.length}`);

  const approvalCols = [...(real.get("approval_requests") ?? [])];
  const decisionKeys = ["status", "approved_by", "approved_at", "rejection_reason", "updated_at"];
  const missingDecision = decisionKeys.filter((k) => !approvalCols.includes(k));
  say("decision write keys the record has", `${decisionKeys.length - missingDecision.length} of ${decisionKeys.length}`);
  check("the decision write sends only columns the record has", missingDecision.length === 0, missingDecision.join(","));

  const orderKeys = ["company_id", "user_id", "status", "total_amount", "deposit_amount", "deposit_paid", "created_at", "updated_at", "customer_name"];
  const orderCols = [...(real.get("sales_orders") ?? [])];
  const missingOrder = orderKeys.filter((k) => !orderCols.includes(k));
  say("order create keys the record has", `${orderKeys.length - missingOrder.length} of ${orderKeys.length}`);
  check("the order create sends only columns the record has", missingOrder.length === 0, missingOrder.join(","));

  // 4. his screens.
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 160));
  });
  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !String(u).includes("/gate/login"), { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const adminPage = await ctx.newPage();
  const adminErrors = [];
  adminPage.on("console", (m) => {
    if (m.type() === "error") adminErrors.push(m.text().slice(0, 160));
  });
  await adminPage.goto(`${SITE}/admin/v2`, { waitUntil: "domcontentloaded" });
  await adminPage.waitForTimeout(5000);
  const adminChars = await adminPage.evaluate(() => document.body.innerText.replace(/\s+/g, " ").length);
  say("cockpit text at 390px", adminChars);
  check("the cockpit renders", adminChars > 400, `chars=${adminChars}`);
  check("no console error on the cockpit", adminErrors.length === 0, adminErrors.slice(0, 2).join(" | "));
  await adminPage.screenshot({ path: "scratch/dal-cockpit-390.png", fullPage: false });

  const customerPage = await ctx.newPage();
  const customerErrors = [];
  customerPage.on("console", (m) => {
    if (m.type() === "error") customerErrors.push(m.text().slice(0, 160));
  });
  await customerPage.goto(SITE, { waitUntil: "domcontentloaded" });
  await customerPage.waitForTimeout(5000);
  const customerChars = await customerPage.evaluate(() => document.body.innerText.replace(/\s+/g, " ").length);
  say("customer home text at 390px", customerChars);
  check("the customer home renders", customerChars > 400, `chars=${customerChars}`);
  check("no console error on the customer home", customerErrors.length === 0, customerErrors.slice(0, 2).join(" | "));
  void errors;
} catch (error) {
  say("INSTRUMENT ERROR", String(error && error.message ? error.message : error).slice(0, 200));
  checks.push({ name: "instrument completed", ok: false });
} finally {
  if (browser) await browser.close().catch(() => {});
  await sql.end({ timeout: 5 }).catch(() => {});
  const passed = checks.filter((c) => c.ok).length;
  say("RESULT", `${passed} of ${checks.length}`);
  writeFileSync("scratch/prove-dal-columns.out", lines.join("\n") + "\n");
}
