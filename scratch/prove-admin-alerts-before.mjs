/**
 * prove-admin-alerts-before.mjs — what the published site answers before this repair lands.
 *
 * The claim under attack: the login door filters the attempts table on a column the table has
 * never had, so the record refuses the query, the count is always zero, and the security alert
 * can never reach his screen. This reads the door as it is published right now.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const SITE = "https://azenith-living.vercel.app";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(1 + l.indexOf("=")).trim().replace(/^["']|["']$/g, "")]),
);

const lines = [];
const say = (s) => {
  lines.push(s);
  console.log(s);
};

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !String(u).includes("/gate/login"), { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(2000);
  say("after login: " + page.url());

  const stats = await page.evaluate(async () => {
    const r = await fetch("/api/admin/mastermind/stats", { cache: "no-store" });
    const text = await r.text();
    let j = null;
    try {
      j = JSON.parse(text);
    } catch (_) {}
    const body = j?.data ?? j ?? {};
    return {
      status: r.status,
      warnings: Array.isArray(body.warnings) ? body.warnings : [],
      failedAttempts24h: body?.security?.failedAttempts24h ?? null,
      has2FA: body?.security?.has2FA ?? null,
      head: text.slice(0, 120),
    };
  });
  say("MASTERMIND_STATUS=" + stats.status);
  say("MASTERMIND_WARNINGS=" + stats.warnings.length + " :: " + stats.warnings.join(" | ").slice(0, 300));
  say("MASTERMIND_FAILED_ATTEMPTS_24H=" + String(stats.failedAttempts24h));
  say(
    "ATTEMPTS_REFUSAL_NAMED=" +
      (stats.warnings.some((w) => /failed_login_attempts/.test(String(w))) ? "yes" : "no")
  );

  const door = await page.evaluate(async () => {
    const r = await fetch("/api/admin/notifications?limit=20", { cache: "no-store" });
    const j = await r.json().catch(() => null);
    return {
      status: r.status,
      success: j?.success ?? null,
      rows: Array.isArray(j?.data) ? j.data.length : -1,
      unreadCount: j?.unreadCount ?? null,
      rest: j?.restingLine == null ? "null" : String(j.restingLine),
    };
  });
  say("NOTIFICATIONS_DOOR=" + JSON.stringify(door));

  const watch = await page.evaluate(async () => {
    const r = await fetch("/api/system-health", { cache: "no-store" });
    const j = await r.json().catch(() => null);
    return {
      status: r.status,
      ok: j?.ok ?? null,
      pending: Array.isArray(j?.pendingAlerts) ? j.pendingAlerts.length : -1,
      severities: Array.isArray(j?.pendingAlerts) ? j.pendingAlerts.map((a) => a.severity).join(",") : "",
      problemHead: Array.isArray(j?.pendingAlerts) && j.pendingAlerts.length ? String(j.pendingAlerts[0].problem).slice(0, 80) : "",
    };
  });
  say("WATCHER_DOOR=" + JSON.stringify(watch));

  // The block is built in the browser, so the HTML the server sends says nothing about it —
  // the reading has to come from the rendered card.
  const home = await ctx.newPage();
  await home.goto(`${SITE}/admin`, { waitUntil: "domcontentloaded" });
  await home.waitForTimeout(9000);
  const card = await home.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((x) => x.textContent?.includes("أهم التنبيهات"));
    if (!h) return { found: 0 };
    const box = h.parentElement;
    const text = (box?.textContent || "").replace(/\s+/g, " ").trim();
    return {
      found: 1,
      bytes: text.length,
      latinDigits: (text.match(/[0-9]/g) || []).length,
      arabicDigits: (text.match(/[٠-٩]/g) || []).length,
      inventedEmpty: /لا توجد تنبيهات حالية/.test(text),
      requiresAttention: /تنبيهات تتطلب الانتباه/.test(text),
      head: text.slice(0, 220),
    };
  });
  say("HOME_CARD=" + JSON.stringify(card));
  await home.screenshot({ path: "scratch/admin-alerts-before-390.png" });
  say("screenshot: scratch/admin-alerts-before-390.png");
} finally {
  await browser.close();
  writeFileSync("scratch/admin-alerts-before-live.out", lines.join("\n") + "\n");
}
