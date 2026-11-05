#!/usr/bin/env node
/**
 * prove-ruler-lands.mjs — the live gate for the ruler itself.
 *
 * A tooling phase still owes the owner a look at the published site: the ruler must answer with
 * real numbers, must refuse to invent them when a source is missing, and the dashboard must still
 * render at phone width after the tooling landed.
 */
import { execFileSync } from "node:child_process";
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

let browser = null;
try {
  // 1 — the ruler answers from the three sources, in his digits.
  const rulerOut = execFileSync("node", ["scripts/gate.mjs", "--ruler-only"], { encoding: "utf8" });
  const rulerLine = rulerOut.split(/\r?\n/).filter((l) => l.includes("المرحلة")).at(-1) ?? "";
  say("ruler line", rulerLine);
  check("the ruler prints the phase count of ١٢", rulerLine.includes("من ١٢"), rulerLine.slice(0, 40));
  check("the ruler prints no Latin digit", !/[0-9]/.test(rulerLine), "");

  // 2 — a missing source is named, never replaced with a zero.
  const starved = execFileSync("node", ["-e", `
    import('./lib/build/ruler.ts').then(async (m) => {
      const f = await import('node:fs');
      const line = m.formatRulerLine(m.readRuler({ masterListPath: 'does-not-exist.md', ledgerDir: 'does-not-exist' }), { phase: 0, tests: null });
      console.log(line);
    });
  `], { encoding: "utf8" });
  const starvedLine = starved.split(/\r?\n/).filter((l) => l.includes("المرحلة")).at(-1) ?? "";
  say("starved ruler line", starvedLine);
  check("a missing source is named, not zeroed", /ما اتقارش/.test(starvedLine) && !/البند ٠ من/.test(starvedLine), starvedLine.slice(0, 80));

  // 3 — the published dashboard still renders at phone width after the tooling landed.
  browser = await chromium.launch();
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

  const dash = await ctx.newPage();
  dash.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });
  await dash.goto(`${SITE}/admin/v2`, { waitUntil: "domcontentloaded" });
  await dash.waitForTimeout(7000);
  const body = await dash.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
  say("cockpit text at 390px", `${body.length} chars`);
  check("the cockpit still paints something", body.length > 200, `chars=${body.length}`);
  check("the measured tab logged no console error", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
  await dash.screenshot({ path: "scratch/ruler-cockpit-390.png" });
  say("screenshot", "scratch/ruler-cockpit-390.png");
} catch (err) {
  check("the run completed", false, String(err).slice(0, 200));
} finally {
  if (browser) await browser.close();
  const failed = checks.filter((c) => !c.ok);
  lines.push(`RESULT: ${checks.length - failed.length} of ${checks.length} checks passed · failed=${failed.length}`);
  if (failed.length) lines.push("FAILED CHECKS: " + failed.map((f) => f.name).join(" · "));
  writeFileSync("scratch/prove-ruler-lands.out", lines.join("\n") + "\n");
  console.log(failed.length ? "PROVE_FAILED" : "PROVE_PASSED");
  if (failed.length) process.exitCode = 1;
}
