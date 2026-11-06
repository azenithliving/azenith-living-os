#!/usr/bin/env node
/**
 * prove-2fa-truths-land.mjs — the protection door must say what it measured, on the published site.
 *
 * Two owner words are being checked here, both measured 2026-11-06:
 *  - «الورقة القديمة تتمسح»: the retired code-2FA row is gone, so the door must answer that the code
 *    lock is off because the drawer answered and held nothing — not because it refused.
 *  - «المفتاح أيوه»: the key desk is not installed yet, so the door must name the refusal
 *    («the record did not answer») instead of reporting `hasPublicKey:false` as a fact.
 *
 * Read-only: it signs in and asks one GET. It writes no rows, so there is nothing to clean up.
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
  const s = `${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${String(detail).slice(0, 160)}` : ""}`;
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

  const res = await ctx.request.fetch(`${SITE}/api/admin/2fa/status`);
  const body = await res.json().catch(() => null);
  say("door answer", JSON.stringify(body ?? null).slice(0, 300));

  check("the door answers the signed-in owner", res.status() === 200 && !!body, `status=${res.status()}`);
  check("the retired code lock now reads off, not unmeasured", body?.twoFactorState === "off", body?.twoFactorState ?? "(none)");
  check("the door does not claim the code lock is on", body?.enabled === false, body?.enabled ?? "(none)");
  check("the missing key desk is named as unmeasured, not as no key", body?.publicKeyState === "not-measured", body?.publicKeyState ?? "(none)");
  check("the refusal carries its own Arabic sentence", typeof body?.publicKeyNote === "string" && body.publicKeyNote.includes("ما ردّش"), body?.publicKeyNote ?? "(none)");
  check("a refusal is never printed as a reassuring boolean", body && !("hasPublicKey" in body), Object.keys(body ?? {}).join(","));

  const screen = await ctx.newPage();
  const consoleErrors = [];
  screen.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });
  await screen.goto(`${SITE}/admin/v2/settings`, { waitUntil: "domcontentloaded" });
  await screen.waitForTimeout(6000);
  check("the settings screen opens with no console error", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
  await screen.screenshot({ path: "scratch/2fa-truths-settings-390.png", fullPage: true });
  say("screenshot", "scratch/2fa-truths-settings-390.png");
} catch (err) {
  check("the run completed", false, String(err).slice(0, 200));
} finally {
  if (browser) await browser.close();
  const failed = checks.filter((c) => !c.ok);
  const result = `RESULT: ${checks.length - failed.length} of ${checks.length} checks passed · failed=${failed.length}`;
  lines.push(result);
  if (failed.length) lines.push("FAILED CHECKS: " + failed.map((f) => f.name).join(" · "));
  writeFileSync("scratch/prove-2fa-truths-land.out", lines.join("\n") + "\n");
  console.log(result);
  console.log(failed.length ? "PROVE_FAILED" : "PROVE_PASSED");
  if (failed.length) process.exitCode = 1;
}
