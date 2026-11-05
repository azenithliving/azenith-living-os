#!/usr/bin/env node
/**
 * prove-m3-lands.mjs — the phase-three ruler must be visible, not just computed.
 *
 * The silent-refusal count is the number this store keeps mistaking for an answer, so it has to sit
 * on the owner's screen with the same honesty rule as the rest: measured, in his digits, and named as
 * «ما اتقارش» when the scan or the column map did not run.
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
  const anon = await chromium.launch();
  const anonRes = await (await anon.newContext()).request.get(`${SITE}/api/admin/ruler`);
  const anonBody = await anonRes.text();
  check("a stranger gets no refusal numbers either", anonRes.status() >= 400 && !anonBody.includes("رفض صامت"), `status=${anonRes.status()}`);
  await anon.close();

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const gate = await ctx.newPage();
  await gate.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await gate.waitForTimeout(1500);
  await gate.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await gate.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  await gate.click('button[type="submit"]');
  await gate.waitForURL((u) => !String(u).includes("/gate/login"), { timeout: 40000 }).catch(() => {});

  const tab = await ctx.newPage();
  await tab.goto(`${SITE}/admin`, { waitUntil: "domcontentloaded" });
  await tab.waitForTimeout(2500);
  const door = await tab.evaluate(async () => {
    const res = await fetch("/api/admin/ruler");
    const body = await res.json().catch(() => null);
    return { status: res.status, refusalLine: typeof body?.refusalLine === "string" ? body.refusalLine : null };
  });
  say("door refusal line", door.refusalLine ?? "(null)");
  check("the door answers the refusal line", door.status === 200 && !!door.refusalLine, door.status);
  check("the refusal line is either counted or named", /رفض صامت|ما اتقارش/.test(door.refusalLine ?? ""), door.refusalLine ?? "");
  check("the refusal line carries no Latin digit", !/[0-9]/.test(door.refusalLine ?? ""), door.refusalLine ?? "");

  const consoleErrors = [];
  const screen = await ctx.newPage();
  screen.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });
  await screen.goto(`${SITE}/admin/v2/ruler`, { waitUntil: "domcontentloaded" });
  await screen.waitForTimeout(6000);
  const text = await screen.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
  check("the screen shows the silent-refusal card", text.includes("الرفض الصامت"), text.slice(0, 80));
  check("the screen shows the line the door answered", !!door.refusalLine && text.includes(door.refusalLine.slice(0, 40)), text.slice(0, 120));
  check("the measured tab logged no console error", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
  await screen.screenshot({ path: "scratch/m3-ruler-390.png", fullPage: true });
  say("screenshot", "scratch/m3-ruler-390.png");

  // The card itself, framed — a full-page shot buries the thing the phase is about.
  const card = screen.locator("div", { hasText: "الرفض الصامت" }).last();
  await card.screenshot({ path: "scratch/m3-refusal-card-390.png" });
  say("card screenshot", "scratch/m3-refusal-card-390.png");
} catch (err) {
  check("the run completed", false, String(err).slice(0, 200));
} finally {
  if (browser) await browser.close();
  const failed = checks.filter((c) => !c.ok);
  lines.push(`RESULT: ${checks.length - failed.length} of ${checks.length} checks passed · failed=${failed.length}`);
  if (failed.length) lines.push("FAILED CHECKS: " + failed.map((f) => f.name).join(" · "));
  writeFileSync("scratch/prove-m3-lands.out", lines.join("\n") + "\n");
  console.log(failed.length ? "PROVE_FAILED" : "PROVE_PASSED");
  if (failed.length) process.exitCode = 1;
}
