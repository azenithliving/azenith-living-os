#!/usr/bin/env node
/**
 * prove-2fa-truths-land.mjs — the protection door must agree with the record, on the published site.
 *
 * Owner's words 2026-11-06: «الورقة القديمة تتمسح» and «المفتاح أيوه». This instrument asks the door
 * what it says, counts the record's own rows beside it, and fails if the two disagree — because the
 * defect this desk keeps dying of is a refusal or a locked drawer answering as «nothing here». A door
 * that reads with the browser key passes while the record holds rows, and that is what the comparison
 * catches.
 *
 * Read-only: one signed GET and two counts. It writes no rows, so there is nothing to clean up.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { chromium } from "@playwright/test";
import postgres from "postgres";

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

  // The record's own count, read beside the door's answer: if the door ever goes back to the browser
  // key it will say «none» while rows exist, and this comparison is what catches it.
  const sql = postgres(env.DIRECT_URL, { max: 1 });
  const rows = await sql`select count(*)::int as n from public.user_public_keys`;
  const codeRows = await sql`select count(*)::int as n from public.user_2fa`;
  await sql.end();
  const expectedKeyState = rows[0].n === 0 ? "none" : "enrolled";
  const expectedCodeState = codeRows[0].n === 0 ? "off" : "on";
  say("record counts", `keys=${rows[0].n} code-rows=${codeRows[0].n}`);

  check("the door answers the signed-in owner", res.status() === 200 && !!body, `status=${res.status()}`);
  check("the code lock answer matches the record's own rows", body?.twoFactorState === expectedCodeState, `${body?.twoFactorState} vs ${expectedCodeState}`);
  check("the key answer matches the record's own rows", body?.publicKeyState === expectedKeyState, `${body?.publicKeyState} vs ${expectedKeyState}`);
  check("a measured empty is printed as a boolean, a refusal never is", body?.publicKeyState === "not-measured" ? !("hasPublicKey" in body) : body?.hasPublicKey === (body?.publicKeyState === "enrolled"), Object.keys(body ?? {}).join(","));

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
