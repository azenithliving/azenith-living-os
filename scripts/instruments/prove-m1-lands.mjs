#!/usr/bin/env node
/**
 * prove-m1-lands.mjs — the live gate for M1: the ruler as a door and as a screen.
 *
 * The phase is only delivered when the owner can read it on the published site at phone width, the
 * door answers with the same numbers the screen shows, an intruder gets an Arabic refusal, and a
 * source that is not in the hosted build is named instead of zeroed.
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
const checks = [];
const say = (label, value) => {
  const s = `${label}: ${value}`;
  lines.push(s);
  console.log(s);
};
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok) });
  const s = `${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${detail.slice(0, 120)}` : ""}`;
  lines.push(s);
  console.log(s);
};

let browser = null;
try {
  // 1 — an intruder, before the gate, gets refused and gets no numbers. The wording of that refusal
  // is the outer gate's own (English today, and M5 owns it); what this screen proves is that a
  // stranger cannot read the ruler.
  const anon = await chromium.launch();
  const anonCtx = await anon.newContext();
  const anonRes = await anonCtx.request.get(`${SITE}/api/admin/ruler`);
  const anonBody = await anonRes.text();
  check(
    "the ruler door refuses a stranger and answers no numbers",
    anonRes.status() >= 400 && !anonBody.includes("المرحلة") && !anonBody.includes("باب يتيم"),
    `status=${anonRes.status()} · ${anonBody.slice(0, 90)}`,
  );
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

  // 2 — the door answers the twelve phases from inside the dashboard.
  const tab = await ctx.newPage();
  await tab.goto(`${SITE}/admin`, { waitUntil: "domcontentloaded" });
  await tab.waitForTimeout(3000);
  const door = await tab.evaluate(async () => {
    const res = await fetch("/api/admin/ruler");
    const body = await res.json().catch(() => null);
    return {
      status: res.status,
      phases: Array.isArray(body?.phases) ? body.phases.length : null,
      line: typeof body?.line === "string" ? body.line : null,
      deadLine: typeof body?.deadLine === "string" ? body.deadLine : null,
      missing: Array.isArray(body?.missing) ? body.missing : null,
    };
  });
  say("door", JSON.stringify(door));
  check("the door answers the twelve phases", door.status === 200 && door.phases === 12, `phases=${door.phases}`);
  check("the door's line carries no Latin digit", typeof door.line === "string" && !/[0-9]/.test(door.line), door.line ?? "");

  // 3 — the screen renders at phone width and agrees with the door.
  const consoleErrors = [];
  const screen = await ctx.newPage();
  screen.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });
  await screen.goto(`${SITE}/admin/v2/ruler`, { waitUntil: "domcontentloaded" });
  await screen.waitForTimeout(6000);
  const text = await screen.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
  say("screen text at 390px", `${text.length} chars`);
  check("the screen shows the ruler line the door answered with", typeof door.line === "string" && text.includes(door.line.slice(0, 40)), text.slice(0, 80));
  check("the screen names what the hosted build cannot measure", text.includes("ما اتقارش"), text.slice(0, 120));
  check("the screen logged no console error", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
  await screen.screenshot({ path: "scratch/m1-ruler-390.png", fullPage: true });
  say("screenshot", "scratch/m1-ruler-390.png");
} catch (err) {
  check("the run completed", false, String(err).slice(0, 200));
} finally {
  if (browser) await browser.close();
  const failed = checks.filter((c) => !c.ok);
  lines.push(`RESULT: ${checks.length - failed.length} of ${checks.length} checks passed · failed=${failed.length}`);
  if (failed.length) lines.push("FAILED CHECKS: " + failed.map((f) => f.name).join(" · "));
  writeFileSync("scratch/prove-m1-lands.out", lines.join("\n") + "\n");
  console.log(failed.length ? "PROVE_FAILED" : "PROVE_PASSED");
  if (failed.length) process.exitCode = 1;
}
