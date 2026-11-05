/**
 * prove-rules-one-shape.mjs — the automation rules desk, measured on the published link at 390px.
 *
 * Claims under attack: «saving a rule lands in the record», «the on/off flag has one owner»,
 * «the phantom names are gone from the live shape», «toggling a rule reads back the way it was
 * written», «a stranger cannot write a rule», and «the instrument leaves nothing behind».
 *
 * Measured before the fix (scratch/measure-automation-shape.out): the desk sent eight names and the
 * record answers to six — `is_active`, `created_by` and `updated_by` have never existed in
 * `automation_rules`. The record refused with PGRST204, the desk stripped a name and tried again,
 * so every save paid refused round trips (REFUSED=2) before it landed.
 *
 * Every row this instrument creates is deleted by the id the door handed back, and the leftover
 * count is printed before any claim is made.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";
const DOOR = "/api/admin/automation";
const MARK = "سبب قياس القاعدة";

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
const rowCount = async () => (await sql`select count(*)::int c from public.automation_rules`)[0].c;
const marked = async () =>
  await sql`select id, name, enabled from public.automation_rules where name = ${MARK}`;

let browser = null;
let before = 0;

try {
  before = await rowCount();
  say("rules in the record before", before);

  const cols = await sql`select column_name from information_schema.columns where table_schema='public' and table_name='automation_rules'`;
  const names = cols.map((c) => c.column_name);
  say("the record answers to", names.length + " columns: " + names.join(","));
  check(
    "the phantom names are still absent from the record, so the desk must not send them",
    !names.includes("is_active") && !names.includes("created_by") && !names.includes("updated_by"),
  );

  browser = await chromium.launch();

  // negative: a stranger with no session must not create a rule
  const anonCtx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const anonPage = await anonCtx.newPage();
  await anonPage.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  const anon = await anonPage.evaluate(
    async ([door, mark]) => {
      const r = await fetch(door, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: mark, trigger: "manual" }),
      });
      return { status: r.status, body: (await r.text()).slice(0, 120) };
    },
    [DOOR, MARK],
  );
  await anonCtx.close();
  say("a stranger's save", `status=${anon.status} body=${anon.body.slice(0, 60)}`);
  const anonLeft = await marked();
  check("a stranger cannot write a rule", anon.status >= 400 && anonLeft.length === 0, `status=${anon.status} rows=${anonLeft.length}`);

  // the owner's own session
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
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !String(u).includes("/gate/login"), { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(2000);
  say("after login", page.url());

  const created = await page.evaluate(
    async ([door, mark]) => {
      const r = await fetch(door, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: mark, trigger: "manual", conditions: {}, actions: {} }),
      });
      const text = await r.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {}
      return { status: r.status, json, text: text.slice(0, 200) };
    },
    [DOOR, MARK],
  );
  const newId = created.json && created.json.rule ? String(created.json.rule.id) : null;
  say("the desk's save", `status=${created.status} id=${newId ? newId.slice(0, 8) : "-"}`);
  check("saving a rule through the real door succeeds", created.status === 200 && Boolean(newId), created.text.slice(0, 80));

  const rows = await marked();
  say("the record holds the marked rule", rows.length);
  check("the rule landed in the record with the flag on", rows.length === 1 && rows[0].enabled === true, `rows=${rows.length} enabled=${rows[0] ? String(rows[0].enabled) : "-"}`);

  const toggled = await page.evaluate(
    async ([door, id]) => {
      const r = await fetch(`${door}?id=${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      return { status: r.status, body: (await r.text()).slice(0, 200) };
    },
    [DOOR, newId],
  );
  say("the desk's toggle", `status=${toggled.status}`);
  check("toggling the flag answers", toggled.status === 200, toggled.body.slice(0, 80));

  const afterToggle = await marked();
  check(
    "the one flag reads back off, from the column that owns it",
    afterToggle.length === 1 && afterToggle[0].enabled === false,
    `enabled=${afterToggle[0] ? String(afterToggle[0].enabled) : "-"}`,
  );

  const listed = await page.evaluate(
    async ([door, mark]) => {
      const r = await fetch(door);
      const json = await r.json();
      const rules = (json.rules || []).filter((x) => x.name === mark);
      return { status: r.status, count: rules.length, first: rules[0] || null };
    },
    [DOOR, MARK],
  );
  say("the desk's own list", `status=${listed.status} marked=${listed.count} enabled=${listed.first ? String(listed.first.enabled) : "-"}`);
  check(
    "the desk lists the rule with the flag it just stored",
    listed.status === 200 && listed.count === 1 && listed.first.enabled === false,
  );

  say("cleanup: deleting only the rule this instrument created");
  const removed = await page.evaluate(
    async ([door, id]) => {
      const r = await fetch(`${door}?id=${id}`, { method: "DELETE" });
      return { status: r.status, body: (await r.text()).slice(0, 120) };
    },
    [DOOR, newId],
  );
  say("the delete answered", `status=${removed.status}`);
  const leftovers = await marked();
  const after = await rowCount();
  say("marked rows left", leftovers.length);
  say("rules after cleanup", after);
  check("the instrument left no rule behind", leftovers.length === 0 && after === before, `left=${leftovers.length} after=${after} before=${before}`);

  consoleErrors.length = 0;
  await page.goto(`${SITE}/admin/owner-dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "scratch/rules-dashboard-390.png", fullPage: false });
  const boardText = await page.evaluate(() => document.body.innerText);
  say("board characters", boardText.length);
  check("the owner's board opens clean after the change", boardText.length > 300);
  check("the board printed no console error", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
} catch (e) {
  say("ERROR", String(e && e.message ? e.message : e));
} finally {
  if (browser) await browser.close();
  try {
    const left = await marked();
    if (left.length > 0) {
      await sql`delete from public.automation_rules where name = ${MARK}`;
      say("teardown swept", left.length);
    }
  } catch {}
  await sql.end();

  const passed = checks.filter((c) => c.ok).length;
  say("النتيجة", `${passed} نجح من ${checks.length}`);
  for (const c of checks.filter((x) => !x.ok)) say("  فشل", c.name);
  writeFileSync("scratch/prove-rules-one-shape.out", lines.join("\n") + "\n");
  process.exitCode = passed === checks.length ? 0 : 1;
}
