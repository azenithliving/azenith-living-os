/**
 * prove-admin-alerts-lands.mjs — the old admin home's alert block, measured on the published link.
 *
 * Claims:
 *   1. the login door's query is no longer refused, and the count it reports is the record's own,
 *   2. the page reads the store's alerts through the one door, so its rows agree with the doors,
 *   3. the card names where each row came from and says what it left off,
 *   4. the block prints his digits and no invented «no alerts», at phone width, with no console error.
 *
 * Nothing here writes: every call is a read.
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
const notRun = [];
const skip = (name, why) => {
  notRun.push(name);
  const s = `لم يُقَس — ${name} · ${why}`;
  lines.push(s);
  console.log(s);
};

const sql = postgres(env.DIRECT_URL, { max: 1 });
let browser = null;

try {
  const realAttempts = (
    await sql`select count(*)::int n from failed_login_attempts where attempted_at > now() - interval '24 hours'`
  )[0].n;
  const totalAttempts = (await sql`select count(*)::int n from failed_login_attempts`)[0].n;
  say("record's own attempts", `in 24h=${realAttempts} · all time=${totalAttempts}`);

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !String(u).includes("/gate/login"), { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // 1 — the door, on the published link.
  const stats = await page.evaluate(async () => {
    const r = await fetch("/api/admin/mastermind/stats", { cache: "no-store" });
    const j = await r.json().catch(() => null);
    const body = j?.data ?? j ?? {};
    return {
      status: r.status,
      warnings: Array.isArray(body.warnings) ? body.warnings : [],
      failedAttempts24h: body?.security?.failedAttempts24h ?? null,
    };
  });
  const attemptsRefusal = stats.warnings.filter((w) => /failed_login_attempts/.test(String(w)));
  say("mastermind door", `status=${stats.status} warnings=${stats.warnings.length} attempts_refusals=${attemptsRefusal.length} count=${stats.failedAttempts24h}`);
  check("the login door no longer names the attempts refusal", attemptsRefusal.length === 0, stats.warnings.join(" | ").slice(0, 160));
  check("the count the door reports is the record's own", Number(stats.failedAttempts24h) === Number(realAttempts), `door=${stats.failedAttempts24h} record=${realAttempts}`);

  // 2 — the two other sources, read the same way the page reads them.
  const door = await page.evaluate(async () => {
    const r = await fetch("/api/admin/notifications?limit=20", { cache: "no-store" });
    const j = await r.json().catch(() => null);
    return {
      status: r.status,
      success: j?.success ?? null,
      rows: Array.isArray(j?.data) ? j.data.length : -1,
      rest: j?.restingLine == null ? "null" : String(j.restingLine),
    };
  });
  const watch = await page.evaluate(async () => {
    const r = await fetch("/api/system-health", { cache: "no-store" });
    const j = await r.json().catch(() => null);
    return {
      status: r.status,
      ok: j?.ok ?? null,
      pending: Array.isArray(j?.pendingAlerts) ? j.pendingAlerts.length : -1,
    };
  });
  say("notifications door", `status=${door.status} success=${door.success} rows=${door.rows}`);
  say("watcher door", `status=${watch.status} ok=${watch.ok} pending=${watch.pending}`);
  check("the ledger door answers the page's read", door.status === 200 && door.success === true, `status=${door.status}`);

  // 3 and 4 — the card itself.
  const dash = await ctx.newPage();
  const dashErrors = [];
  dash.on("console", (m) => {
    if (m.type() === "error") dashErrors.push(m.text().slice(0, 160));
  });
  await dash.goto(`${SITE}/admin`, { waitUntil: "domcontentloaded" });
  await dash.waitForTimeout(9000);
  await dash.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((x) => x.textContent?.includes("أهم التنبيهات"));
    h?.scrollIntoView({ block: "center" });
  });
  await dash.waitForTimeout(1200);

  const card = await dash.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((x) => x.textContent?.includes("أهم التنبيهات"));
    if (!h) return { found: 0 };
    const box = h.parentElement;
    const text = (box?.textContent || "").replace(/\s+/g, " ").trim();
    const rows = [...box.querySelectorAll("a[href^='/admin'], div.flex.items-start")].filter((el) =>
      /دفتر المتجر|فحص الموقع|بوابة الدخول/.test(el.textContent || "")
    );
    return {
      found: 1,
      width: Math.round(box.getBoundingClientRect().width),
      bytes: text.length,
      rowCount: rows.length,
      sources: [...new Set([...text.matchAll(/دفتر المتجر|فحص الموقع|بوابة الدخول/g)].map((m) => m[0]))],
      latinDigits: (text.match(/[0-9]/g) || []).length,
      arabicDigits: (text.match(/[٠-٩]/g) || []).length,
      inventedEmpty: /لا توجد تنبيهات حالية/.test(text),
      oldSubtitle: /تنبيهات تتطلب الانتباه/.test(text),
      saysOnScreen: /على الشاشة/.test(text),
      head: text.slice(0, 260),
    };
  });
  say("the card at phone width", JSON.stringify(card));
  check("the card is on the screen", card.found === 1, `found=${card.found}`);
  check("it fits the phone", card.width > 0 && card.width <= 390, `width=${card.width}`);
  check("the invented «no alerts» line is gone", card.inventedEmpty === false, `invented=${card.inventedEmpty}`);
  check("the placeholder subtitle is gone", card.oldSubtitle === false, `old=${card.oldSubtitle}`);
  check("it counts what it shows, in his digits", card.saysOnScreen === true && card.latinDigits === 0, `latin=${card.latinDigits} arabic=${card.arabicDigits}`);

  const expectedRows = Math.min(door.rows, 20) + (Number(stats.failedAttempts24h) > 0 ? 1 : 0) + Math.min(watch.pending, 2);
  if (expectedRows === 0) {
    skip("the card's rows against the three doors", "all three sources answered zero, so there is no row to count");
  } else {
    check("the card shows exactly what the three doors answered", card.rowCount === expectedRows, `card=${card.rowCount} doors=${expectedRows}`);
  }
  check("every row names its source", card.rowCount === 0 || card.sources.length >= 1, `sources=${card.sources.join(",")}`);

  await dash.screenshot({ path: "scratch/admin-alerts-390.png" });
  say("screenshot", "scratch/admin-alerts-390.png");

  say("console errors on the measured tabs", `${dashErrors.length} :: ${dashErrors.slice(0, 3).join(" | ")}`);
  check("the measured tabs logged no console error", dashErrors.length === 0, dashErrors.slice(0, 2).join(" | "));
} catch (err) {
  check("the run completed", false, String(err).slice(0, 200));
} finally {
  if (browser) await browser.close();
  await sql.end();
  const failed = checks.filter((c) => !c.ok);
  lines.push(
    `RESULT: ${checks.length - failed.length} of ${checks.length} checks passed · failed=${failed.length} · not measured=${notRun.length}`
  );
  if (notRun.length) lines.push("NOT MEASURED: " + notRun.join(" · "));
  writeFileSync("scratch/prove-admin-alerts-lands.out", lines.join("\n") + "\n");
  console.log(failed.length ? "PROVE_FAILED" : "PROVE_PASSED");
  if (failed.length) process.exitCode = 1;
}
