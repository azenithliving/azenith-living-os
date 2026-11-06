#!/usr/bin/env node
/**
 * prove-settings-desk-lands.mjs — «غيّر إعداد المتجر» and its rollback, measured on the published site.
 *
 * Measured before this run: the employee tool inserted its history into a drawer the record has never
 * had (PGRST205) and then tried to filter a column that does not exist, so the tool failed on every
 * call, and the rollback button in the owner's chat answered «Invalid rollback type» because the door
 * had no branch for the id the chat actually sends.
 *
 * The instrument writes ONE setting under its own marker key, reads it back from the record, rolls it
 * back through the door the owner's chat calls, reads it back again, asks for the same rollback twice
 * (the second must be refused, not silently re-run), deletes exactly the row it created, and prints
 * what is left. The history rows stay: an append-only trail that gets edited is not a trail.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { chromium } from "@playwright/test";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";
const MARKER_KEY = "qa_settings_desk_marker";

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
  lines.push(`${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${String(detail).slice(0, 180)}` : ""}`);
  console.log(`${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${String(detail).slice(0, 180)}` : ""}`);
};

const sql = postgres(env.DIRECT_URL, { max: 1 });
let browser = null;

const readRow = async () =>
  (await sql`select value, updated_by, updated_at from public.site_settings where key = ${MARKER_KEY}`)[0] ?? null;

try {
  const before = await readRow();
  say("row before", JSON.stringify(before));

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
  check("the gate opened for the instrument", !page.url().includes("/gate/login"), page.url());

  const newValue = { primary: "ذهبي-قياس" };

  const execRes = await ctx.request.fetch(`${SITE}/api/admin/agent/tools/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify({
      toolName: "setting_update",
      params: { key: MARKER_KEY, value: newValue, reason: "قياس مكتب الإعدادات", autoApprove: true },
      skipApproval: true,
    }),
  });
  const execBody = await execRes.json().catch(() => ({}));
  say("tool answer", `status=${execRes.status()} success=${execBody.success} message=${String(execBody.message ?? "").slice(0, 120)}`);
  const executionId = execBody.executionId ?? null;
  check(
    "the employee tool changed the setting and said so in measured words",
    execRes.status() === 200 && execBody.success === true && typeof executionId === "string",
    `status=${execRes.status()} success=${execBody.success}`,
  );
  check("the tool says the change can be rolled back", execBody.canRollback === true, `canRollback=${execBody.canRollback}`);

  const applied = await readRow();
  say("row after the change", JSON.stringify({ value: applied?.value, by: applied?.updated_by }));
  check("the record holds the new value", JSON.stringify(applied?.value ?? null) === JSON.stringify(newValue), JSON.stringify(applied?.value));
  // `updated_by` is a uuid with a foreign key to `users(id)` (measured in the live schema), so the
  // desk does not write it — the actor belongs to the history row. Asserting a name landed in the
  // uuid column is how this proof failed its first run, and the refusal was correct.
  check("the desk left the uuid column alone", applied?.updated_by === null, `updated_by=${applied?.updated_by}`);

  const history = await sql`
    select details, actor from public.audit_log
    where event_type = 'setting_change' and details->>'executionId' = ${executionId}
    order by timestamp desc limit 5`;
  say("history rows for the execution", history.length);
  check("the change landed in the history drawer the store already keeps", history.length >= 1, `rows=${history.length}`);
  check(
    "the history row carries the old value, the new one and the key",
    history.some((h) => h.details?.settingKey === MARKER_KEY && h.details?.status === "applied" && h.details?.newValue),
    JSON.stringify(history[0]?.details ?? null).slice(0, 160),
  );
  check("the history row names who changed it", Boolean(history[0]?.actor), history[0]?.actor ?? "(none)");

  const rollback = await ctx.request.fetch(`${SITE}/api/admin/agent/rollback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify({ executionId }),
  });
  const rollbackBody = await rollback.json().catch(() => ({}));
  say("rollback answer", `status=${rollback.status()} success=${rollbackBody.success} message=${String(rollbackBody.message ?? rollbackBody.error ?? "").slice(0, 140)}`);
  check("the door the owner's chat calls rolled the change back", rollback.status() === 200 && rollbackBody.success === true, `status=${rollback.status()}`);

  const restored = await readRow();
  say("row after the rollback", JSON.stringify(restored?.value ?? null));
  check("the value went back to what it was", restored === null || JSON.stringify(restored.value) === JSON.stringify(before?.value ?? null), JSON.stringify(restored?.value));

  const secondRollback = await ctx.request.fetch(`${SITE}/api/admin/agent/rollback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify({ executionId }),
  });
  const secondBody = await secondRollback.json().catch(() => ({}));
  say("second rollback", `status=${secondRollback.status()} error=${String(secondBody.error ?? "").slice(0, 120)}`);
  check(
    "pressing rollback twice is refused in words, not run again",
    secondRollback.status() === 404 && String(secondBody.error ?? "").includes("مفيش تغيير مسجّل"),
    `status=${secondRollback.status()}`,
  );

  const blankKey = await ctx.request.fetch(`${SITE}/api/admin/agent/tools/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify({ toolName: "setting_update", params: { key: "   ", value: 1, autoApprove: true }, skipApproval: true }),
  });
  const blankBody = await blankKey.json().catch(() => ({}));
  check("a blank setting name is refused", blankKey.status() < 500 && blankBody.success === false, `status=${blankKey.status()} success=${blankBody.success}`);

  await page.goto(`${SITE}/admin/v2/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "scratch/settings-desk-390.png", fullPage: false });
  say("settings screen screenshot", "scratch/settings-desk-390.png");
  check("the settings office logged no console error", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
} catch (err) {
  check("the run completed", false, String(err).slice(0, 220));
} finally {
  const removed = await sql`delete from public.site_settings where key = ${MARKER_KEY} returning key`;
  say("own row deleted", removed.length);
  const leftovers = await sql`select count(*)::int as n from public.site_settings where key = ${MARKER_KEY}`;
  say("marker rows left", leftovers[0].n);
  check("the store keeps no test setting at the end", leftovers[0].n === 0, `left=${leftovers[0].n}`);

  if (browser) await browser.close();
  await sql.end();
  const failed = checks.filter((c) => !c.ok);
  const result = `RESULT: ${checks.length - failed.length} of ${checks.length} checks passed · failed=${failed.length}`;
  lines.push(result);
  if (failed.length) lines.push("FAILED CHECKS: " + failed.map((f) => f.name).join(" · "));
  writeFileSync("scratch/prove-settings-desk-lands.out", lines.join("\n") + "\n");
  console.log(result);
  console.log(failed.length ? "PROVE_FAILED" : "PROVE_PASSED");
  if (failed.length) process.exitCode = 1;
}
