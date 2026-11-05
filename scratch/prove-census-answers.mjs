/**
 * prove-census-answers.mjs — the discovery census, measured on the published link.
 *
 * Claims under attack: «the assistant's picture of the store lists his tables», «the settings read
 * returns the rows», «the rules read asks only names the record has», «a credential never enters the
 * picture», «a stranger is refused», and «his cockpit still renders at phone width».
 *
 * Measured before the fix (scratch/measure-discovery-blind.out): the engine asked PostgREST for
 * `information_schema.tables` to decide whether a table exists, and the record answers that with
 * 404 / PGRST205. So the check never passed, and the snapshot carried 0 settings and 0 rules while
 * the record held 20 settings and 1 rule.
 *
 * This instrument writes nothing. It reads the record directly for the ground truth and compares.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";
const DOOR = "/api/omnipotent";

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
let tokenCandidates = [];
try {
  // Ground truth, straight from the record (this path is Postgres, not PostgREST — it can see itself).
  const relRows = await sql`
    select table_name, table_type from information_schema.tables where table_schema='public'`;
  const truthAll = relRows.map((r) => r.table_name);
  const truthViews = relRows.filter((r) => r.table_type === "VIEW").map((r) => r.table_name);
  const truthBase = relRows.filter((r) => r.table_type === "BASE TABLE").map((r) => r.table_name);
  // The census leaves the backup relations out by name; compare against the same rule.
  const truthWorking = truthBase.filter((n) => !n.startsWith("pg_") && !n.startsWith("_"));
  const truthSkipped = truthBase.length - truthWorking.length;
  const truthSettings = await sql`select count(*)::int c from public.site_settings`;
  const truthRules = await sql`select id, name, enabled from public.automation_rules`;
  const telegramRow = await sql`select value from public.site_settings where key='telegram_config' limit 1`;

  const tableCount = truthBase.length;
  say(
    "the record's relations",
    `base=${tableCount} views=${truthViews.length} working (census rule)=${truthWorking.length} skipped=${truthSkipped}`
  );
  say("the record's settings rows", truthSettings[0].c);
  say("the record's rules", truthRules.length);

  // The token, kept as a value we test for and never print.
  tokenCandidates = Object.values(telegramRow[0]?.value || {})
    .filter((v) => typeof v === "string" && v.length > 8)
    .map((v) => v.trim());
  say("credential fields found in telegram_config", tokenCandidates.length);

  browser = await chromium.launch();

  // negative: a stranger must not read the store's picture
  const anonCtx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const anonPage = await anonCtx.newPage();
  await anonPage.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  const anon = await anonPage.evaluate(async ([door]) => {
    const r = await fetch(door, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "snapshot" }),
    });
    return { status: r.status, body: (await r.text()).slice(0, 160) };
  }, [DOOR]);
  await anonCtx.close();
  say("a stranger's snapshot", `status=${anon.status}`);
  check("a stranger cannot read the store's picture", anon.status >= 400, anon.body.slice(0, 70));

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

  const got = await page.evaluate(async ([door]) => {
    const r = await fetch(door, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "snapshot" }),
    });
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: r.status, json, text: text.slice(0, 200) };
  }, [DOOR]);

  const snap = got.json && got.json.snapshot ? got.json.snapshot : null;
  say("the snapshot door", `status=${got.status} parsed=${snap ? "yes" : "no"}`);
  if (!snap) throw new Error("no snapshot in the reply: " + got.text.slice(0, 160));

  const listed = Array.isArray(snap.tables) ? snap.tables.length : -1;
  const listedNames = (snap.tables || []).map((t) => t.name);
  const expected = truthWorking.length + truthViews.length;
  say("tables in the picture", listed);
  check("the census lists the record's tables", listed > 0, `listed=${listed}`);
  check(
    "the census count agrees with the record on the same rule",
    listed === expected,
    `listed=${listed} expected=${expected} (working=${truthWorking.length} + views=${truthViews.length})`
  );
  const notInRecord = listedNames.filter((n) => !truthAll.includes(n));
  const missingFromPicture = [...truthWorking, ...truthViews].filter((n) => !listedNames.includes(n));
  say(
    "the two sets, name by name",
    `only in the picture=${notInRecord.length}[${notInRecord.slice(0, 6).join(",")}] ` +
      `record tables the picture never names=${missingFromPicture.length}[${missingFromPicture.slice(0, 8).join(",")}]`
  );
  check("the picture names nothing the record does not have", notInRecord.length === 0, notInRecord.slice(0, 6).join(","));
  check("the picture names every working relation the record has", missingFromPicture.length === 0, missingFromPicture.slice(0, 8).join(","));

  const settingsCount = Array.isArray(snap.settings) ? snap.settings.length : -1;
  say("settings in the picture", settingsCount);
  check(
    "the settings read returns the rows the blind gate used to throw away",
    settingsCount === truthSettings[0].c,
    `picture=${settingsCount} truth=${truthSettings[0].c}`,
  );

  const rulesCount = Array.isArray(snap.automationRules) ? snap.automationRules.length : -1;
  say("rules in the picture", rulesCount);
  check("the rules read returns the row the phantom names used to break", rulesCount === truthRules.length, `picture=${rulesCount} truth=${truthRules.length}`);

  const flagOwner = snap.automationRules && snap.automationRules[0];
  check(
    "the on/off flag reads from the record's one owner",
    Boolean(flagOwner) && flagOwner.isActive === truthRules[0].enabled,
    flagOwner ? `picture=${String(flagOwner.isActive)} record=${String(truthRules[0].enabled)}` : "no rule",
  );

  // The credential must not be anywhere in what the door handed back — tested on the whole object,
  // and the instrument refuses to write its log if a token ever appears in a printed line.
  const serialized = JSON.stringify(snap);
  const leaked = tokenCandidates.filter((t) => serialized.includes(t));
  say("payload size of the picture", serialized.length);
  check("no credential value reaches the picture", tokenCandidates.length > 0 && leaked.length === 0, `checked=${tokenCandidates.length} leaked=${leaked.length}`);

  const summary = String(snap.summary || "");
  // The count block is the first lines; paths and table names may carry Latin characters honestly.
  const countBlock = summary.split("\n").slice(0, 8).join("\n");
  const latinDigits = (countBlock.match(/[0-9]/g) || []).length;
  const digitContexts = (summary.match(/.{0,24}[0-9].{0,24}/g) || []).slice(0, 4);
  say("summary first lines", countBlock.split("\n").slice(1, 7).join(" / ").slice(0, 200));
  say("latin digits anywhere in the summary", (summary.match(/[0-9]/g) || []).length);
  say("their context", digitContexts.join(" || ").slice(0, 220));
  check("the summary counts in his digits", latinDigits === 0, `latin digits in the count block=${latinDigits}`);
  check("the summary does not claim an empty store", !/قاعدة البيانات فيها 0 جدول/.test(summary));

  const ar = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));
  check(
    "the summary says how many relations the count leaves out",
    summary.includes(`${ar(truthSkipped)} علاقة مش داخلة في العدّ`),
    `skipped=${truthSkipped}`
  );

  const secretRow = (snap.settings || []).find((s) => s.key === "telegram_config");
  check("the credential row reaches the picture as a mask, not a value", Boolean(secretRow) && JSON.stringify(secretRow).includes("مخفي"), secretRow ? secretRow.description : "no row");

  const auditShape = snap.tables.find((t) => t.name === "audit_log");
  check(
    "a table in the picture carries its columns, not a made-up row count",
    Boolean(auditShape) && Array.isArray(auditShape.columns) && auditShape.columns.length > 0 && auditShape.rowCount === null,
    auditShape ? `columns=${auditShape.columns.length} rowCount=${String(auditShape.rowCount)}` : "audit_log missing",
  );

  // His cockpit, at phone width, after all of this.
  consoleErrors.length = 0;
  await page.goto(`${SITE}/admin/v2`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const bodyLen = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").length);
  say("cockpit text length at 390px", bodyLen);
  check("the cockpit still renders", bodyLen > 200, `chars=${bodyLen}`);
  check("no console error on the cockpit", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
  await page.screenshot({ path: "scratch/census-cockpit-390.png", fullPage: false });
} catch (error) {
  say("INSTRUMENT ERROR", String(error && error.message ? error.message : error).slice(0, 200));
  checks.push({ name: "instrument completed", ok: false });
} finally {
  if (browser) await browser.close().catch(() => {});
  await sql.end({ timeout: 5 }).catch(() => {});
  const passed = checks.filter((c) => c.ok).length;
  say("RESULT", `${passed} of ${checks.length}`);
  // Refuse to write a log that carries the credential it is testing for.
  const printedLeak = tokenCandidates.filter((t) => t && lines.some((l) => l.includes(t)));
  if (printedLeak.length) {
    console.log("INSTRUMENT REFUSED: a credential reached its own log — nothing written");
    process.exitCode = 1;
  } else {
    writeFileSync("scratch/prove-census-answers.out", lines.join("\n") + "\n");
  }
}
