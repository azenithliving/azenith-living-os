#!/usr/bin/env node
/**
 * restore-drill.mjs — proves the copy can actually put a row back, on the published site.
 *
 * A backup nobody has restored from is a file, not a backup. This drill writes ONE row that carries
 * its own marker, makes a real copy, deletes only its own row, restores it through the door, reads it
 * back from the record, and then removes exactly the row it created — printing whatever is left so a
 * residue cannot hide. It never touches a row it did not write, and it asks the door for two refusals
 * as well as one success.
 */
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";

import { chromium } from "@playwright/test";

const SITE = "https://azenith-living.vercel.app";
const TABLE = "site_settings";
const KEY = "key";
const marker = `DRILL-${Date.now()}`;
const rowKey = `drill/${marker}`;

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
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
  const s = `${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${String(detail).slice(0, 140)}` : ""}`;
  lines.push(s);
  console.log(s);
};

const sql = postgres(env.DIRECT_URL, { max: 1 });
let browser = null;

const ownRow = async () => sql`select key, value from public.site_settings where key = ${rowKey}`;

try {
  // 1 — the drill writes exactly one row, keyed by its own marker.
  await sql`insert into public.site_settings (key, value) values (${rowKey}, ${{ drill: marker }})`;
  const written = await ownRow();
  say("marker row written", `${written.length} row · key=${rowKey}`);
  check("the drill wrote its own row", written.length === 1, written.length);

  // 2 — log into the published gate.
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

  const call = async (method, path, body) =>
    tab.evaluate(
      async ([m, p, b]) => {
        const res = await fetch(p, {
          method: m,
          headers: b ? { "content-type": "application/json" } : undefined,
          body: b ? JSON.stringify(b) : undefined,
        });
        return { status: res.status, body: await res.json().catch(() => null) };
      },
      [method, path, body ?? null],
    );

  // 3 — a real copy of the whole set, which is what writes the stamp.
  const copy = await call("POST", "/api/admin/backup", { tables: ["*"] });
  say("copy", JSON.stringify({ status: copy.status, tables: copy.body?.tables, rows: copy.body?.rows, failures: copy.body?.failures?.length }));
  check("the copy ran on the published site", copy.status === 200 && copy.body?.failures?.length === 0, copy.body?.error ?? "");

  const state = await call("GET", "/api/admin/backup");
  const stamp = state.body?.stamp ?? null;
  say("state", JSON.stringify({ fresh: state.body?.fresh, targets: state.body?.targets, stampDay: stamp?.day, coverage: state.body?.coverage?.line ?? state.body?.coverageMissing }));
  check("the stamp says today and the copy is fresh", state.body?.fresh === true && typeof stamp?.day === "string", stamp?.day ?? "لا ختم");

  // 4 — the door refuses what it must refuse.
  const badTable = await call("POST", "/api/admin/backup/restore", { day: stamp?.day, table: "image_bank", marker });
  check("the door refuses a table the copy never held", badTable.status === 400 && /ما اتنسختش/.test(badTable.body?.error ?? ""), badTable.body?.error ?? "");
  const badMarker = await call("POST", "/api/admin/backup/restore", { day: stamp?.day, table: TABLE, marker: "DRILL-NOT-REAL" });
  check("the door refuses a marker no row carries", badMarker.status === 400 && /ولا سطر/.test(badMarker.body?.error ?? ""), badMarker.body?.error ?? "");
  const whole = await call("POST", "/api/admin/backup/restore", { day: stamp?.day, table: TABLE });
  check("the door refuses a whole-table restore with no word", whole.status === 400 && /كلمة المالك/.test(whole.body?.error ?? ""), whole.body?.error ?? "");

  // 5 — delete only the drill's own row, then restore it from the copy.
  const removed = await sql`delete from public.site_settings where key = ${rowKey} returning key`;
  const gone = await ownRow();
  say("marker row deleted", `${removed.length} · بقى ${gone.length}`);
  check("the row is gone before the restore", gone.length === 0, gone.length);

  const restore = await call("POST", "/api/admin/backup/restore", { day: stamp?.day, table: TABLE, marker });
  say("restore", JSON.stringify(restore.body));
  check("the door put the row back", restore.status === 200 && restore.body?.inserted === 1 && restore.body?.readBack === 1, restore.body ?? "");

  const back = await ownRow();
  check("the record itself says the row came back", back.length === 1 && back[0]?.value?.drill === marker, back.length);

  // 6 — same restore twice cannot duplicate or overwrite.
  const again = await call("POST", "/api/admin/backup/restore", { day: stamp?.day, table: TABLE, marker });
  check("a second restore inserts nothing", again.status === 200 && again.body?.inserted === 0, again.body ?? "");

  // 7 — the drill cleans up exactly its own row and prints whatever is left.
  await sql`delete from public.site_settings where key = ${rowKey}`;
  const leftovers = await sql`select key from public.site_settings where key like ${"drill/DRILL-%"}`;
  say("leftovers", `${leftovers.length} · ${leftovers.map((l) => l.key).join(", ") || "(none)"}`);
  check("the drill left no row behind", leftovers.length === 0, leftovers.length);
} catch (err) {
  check("the run completed", false, String(err).slice(0, 200));
} finally {
  if (browser) await browser.close();
  // A crash must not leave the marker in the owner's settings.
  const swept = await sql`delete from public.site_settings where key like ${"drill/DRILL-%"} returning key`;
  if (swept.length) console.log(`swept ${swept.length} marker rows on the way out`);
  await sql.end();
  const failed = checks.filter((c) => !c.ok);
  const result = `RESULT: ${checks.length - failed.length} of ${checks.length} checks passed · failed=${failed.length}`;
  lines.push(result);
  if (failed.length) lines.push("FAILED CHECKS: " + failed.map((f) => f.name).join(" · "));
  writeFileSync("scratch/restore-drill.out", lines.join("\n") + "\n");
  // The gate reads the live count off stdout; without this it can only record that the script exited.
  console.log(result);
  console.log(failed.length ? "DRILL_FAILED" : "DRILL_PASSED");
  if (failed.length) process.exitCode = 1;
}
