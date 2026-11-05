#!/usr/bin/env node
/**
 * prove-m2-lands.mjs — the cockpit's own line about the copy, at phone width.
 *
 * The doors are proven by restore-drill.mjs. What is left to prove is the owner's view: the canvas
 * must show «آخر نسخة · N جدول» read from the door, in his numerals, with no console error — and if
 * the door refuses, the line must say so instead of disappearing.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { chromium } from "@playwright/test";

const SITE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(1 + l.indexOf("=")).trim().replace(/^["']|["']$/g, "")]),
);

const lines = [];
const checks = [];
const say = (label, value) => {
  lines.push(`${label}: ${value}`);
  console.log(`${label}: ${value}`);
};
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok) });
  const s = `${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${String(detail).slice(0, 140)}` : ""}`;
  lines.push(s);
  console.log(s);
};

let browser = null;
try {
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const gate = await ctx.newPage();
  await gate.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await gate.waitForTimeout(1500);
  await gate.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await gate.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  await gate.click('button[type="submit"]');
  await gate.waitForURL((u) => !String(u).includes("/gate/login"), { timeout: 40000 }).catch(() => {});

  const consoleErrors = [];
  const canvas = await ctx.newPage();
  canvas.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });
  await canvas.goto(`${SITE}/admin/v2`, { waitUntil: "domcontentloaded" });
  await canvas.waitForSelector("[data-backup-line], [data-backup-refused]", { timeout: 40000 }).catch(() => {});
  const seen = await canvas.evaluate(() => {
    const line = document.querySelector("[data-backup-line]");
    const refused = document.querySelector("[data-backup-refused]");
    const node = line ?? refused;
    return { kind: line ? "line" : refused ? "refused" : "none", text: node ? node.textContent.replace(/\s+/g, " ").trim() : null };
  });
  say("cockpit copy line", JSON.stringify(seen));
  check("the cockpit shows the copy's line", seen.kind === "line" && seen.text.includes("آخر نسخة"), seen.text ?? "ولا سطر");
  check("the line carries no Latin digit", !/[0-9]/.test(seen.text ?? ""), (seen.text ?? "").slice(0, 80));
  check("the line names the table count", /جدول/.test(seen.text ?? ""), (seen.text ?? "").slice(0, 80));
  check("the measured tab logged no console error", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
  await canvas.screenshot({ path: "scratch/m2-cockpit-390.png" });
  say("screenshot", "scratch/m2-cockpit-390.png");
} catch (err) {
  check("the run completed", false, String(err).slice(0, 200));
} finally {
  if (browser) await browser.close();
  const failed = checks.filter((c) => !c.ok);
  lines.push(`RESULT: ${checks.length - failed.length} of ${checks.length} checks passed · failed=${failed.length}`);
  if (failed.length) lines.push("FAILED CHECKS: " + failed.map((f) => f.name).join(" · "));
  writeFileSync("scratch/prove-m2-lands.out", lines.join("\n") + "\n");
  console.log(failed.length ? "PROVE_FAILED" : "PROVE_PASSED");
  if (failed.length) process.exitCode = 1;
}
