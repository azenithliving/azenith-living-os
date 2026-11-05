/**
 * measure-quality-door.mjs — which door the quality metrics panel asks, and what it answers.
 *
 * The settings desk logged «Quality metrics error: TypeError: Failed to fetch» once, on the first
 * load after a publish, and not on a later load. This names the request, its status and the panel.
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
  const consoleTexts = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleTexts.push(m.text().slice(0, 200));
  });
  const net = [];
  page.on("response", (r) => {
    if (r.status() >= 400 || /quality|metrics/.test(r.url())) {
      net.push(`${r.status()} ${r.url().replace(SITE, "")}`);
    }
  });

  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !String(u).includes("/gate/login"), { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(1500);

  for (const path of ["/admin/v2/settings", "/admin/v2"]) {
    consoleTexts.length = 0;
    net.length = 0;
    await page.goto(`${SITE}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    say(`== ${path}`);
    say("   responses >=400 or quality-named: " + (net.length ? net.slice(0, 8).join(" | ") : "none"));
    say("   console errors: " + (consoleTexts.length ? consoleTexts.slice(0, 4).join(" | ") : "none"));
    const panel = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll("*")).find((n) => /Quality metrics/i.test(n.textContent || "") && n.children.length === 0);
      return el ? (el.textContent || "").slice(0, 120) : null;
    });
    say("   panel text: " + (panel ?? "none"));
  }

  // The same door from the shell, with the session's own cookie.
  const door = await page.evaluate(async () => {
    const tries = ["/api/admin/quality-metrics", "/api/admin/quality", "/api/admin/metrics/quality"];
    const out = [];
    for (const url of tries) {
      try {
        const r = await fetch(url);
        const text = await r.text();
        out.push(`${url} → ${r.status} ${text.slice(0, 90).replace(/\s+/g, " ")}`);
      } catch (e) {
        out.push(`${url} → threw ${String(e && e.message ? e.message : e).slice(0, 60)}`);
      }
    }
    return out;
  });
  say("== direct probes");
  door.forEach((d) => say("   " + d));
} finally {
  await browser.close().catch(() => {});
  writeFileSync("scratch/measure-quality-door.out", lines.join("\n") + "\n");
}
