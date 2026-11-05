import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import speakeasy from "speakeasy";

/**
 * The mute window, proved on the published host at the owner's width.
 *
 * The sentence «و١ تنبيه مكتوم لحد …» can only come from the new code, so arming a short window on the
 * condition that already exists doubles as the build marker: we wait for the published door to say it,
 * then measure three things there — the sighting count must hold still while the window is open, the
 * alert must stay visible in the list, and both must return to normal the minute the window ends.
 *
 * Nothing is deleted and no row is invented: the same ledger row the review button writes is armed and
 * then aged past its deadline, and the four-minute window closes long before the owner wakes.
 *
 *   node scratch/prove-mute-live.mjs
 */
const BASE = "https://azenith-living.vercel.app";
const KEY = "api:xai";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && !/ERR_FAILED|Failed to load/i.test(m.text()) && errors.push(m.text().slice(0, 90)));

async function armMute(minutesFromNow) {
  const until = new Date(Date.now() + minutesFromNow * 60_000).toISOString();
  const { data, error } = await db
    .from("system_alert_mutes")
    .upsert({ dedupe_key: KEY, muted_until: until }, { onConflict: "dedupe_key" })
    .select("muted_until")
    .single();
  if (error) throw new Error(`arm failed: ${error.message}`);
  return data.muted_until;
}

async function readDoor() {
  return p.evaluate(async () => {
    const res = await fetch("/api/system-health", { cache: "no-store" });
    const body = await res.json().catch(() => null);
    const alert = (body?.pendingAlerts ?? []).find((a) => a.category === "api") ?? null;
    return { status: res.status, note: body?.health?.logNote ?? null, occurrences: alert?.occurrences ?? null, listed: Boolean(alert) };
  });
}

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(4000);
await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await p.click("button[type=submit]");
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click("button[type=submit]");
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(2000);

const until = await armMute(6);
console.log(`window armed until ${until}`);

// The deploy takes longer than one window, and the old code ignores the ledger, so the window is
// re-armed on every attempt: whenever the new build answers, it answers to a live mute.
let door = null;
let sawMute = false;
for (let attempt = 0; attempt < 45; attempt++) {
  await armMute(6);
  door = await readDoor();
  if (door.note && door.note.includes("مكتوم")) {
    sawMute = true;
    break;
  }
  console.log(`waiting for the new build (attempt ${attempt + 1}) — note: ${door.note ?? `status ${door.status}`}`);
  await p.waitForTimeout(20000);
}
if (!sawMute) {
  console.log(`\nverdict: the published door never reported the mute — the new build was not live inside the wait`);
  await armMute(-1);
  await b.close();
  process.exit(1);
}
console.log(`\npublished door while muted: occurrences = ${door.occurrences} · listed = ${door.listed}`);
console.log(`note: ${door.note}`);

const first = door.occurrences;
await p.waitForTimeout(25000);
const second = await readDoor();
console.log(`second reading while muted: occurrences = ${second.occurrences} · listed = ${second.listed}`);

await p.goto(`${BASE}/admin/database`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(14000);
const section = await p.evaluate(() => {
  const target = [...document.querySelectorAll("section")].find((s) => /التنبيهات التي تحتاج/.test(s.innerText));
  if (!target) return null;
  target.scrollIntoView({ block: "start" });
  return { text: target.innerText, latin: (target.innerText.match(/[A-Za-z0-9]/g) ?? []).length };
});
if (section) {
  console.log(`\nscreen section: latin chars = ${section.latin}`);
  console.log(section.text);
  await p.waitForTimeout(700);
  const handle = await p.evaluateHandle(() => [...document.querySelectorAll("section")].find((s) => /التنبيهات التي تحتاج/.test(s.innerText)));
  const element = handle.asElement();
  if (element) await element.screenshot({ path: "scratch/mute-window-390.png" });
} else {
  console.log("the alert section did not render");
}

const aged = await armMute(-1);
console.log(`\nwindow aged past its deadline: ${aged}`);
let resumed = null;
for (let attempt = 0; attempt < 10; attempt++) {
  await p.waitForTimeout(8000);
  resumed = await readDoor();
  if (resumed.occurrences > first) break;
}
console.log(`after the window: occurrences = ${resumed.occurrences} (was ${first}) · note = ${resumed.note}`);

console.log(`\nverdict: held still while muted = ${second.occurrences === first} · stayed listed = ${second.listed}`);
console.log(`         wrote again after the window = ${resumed.occurrences > first} · note went quiet again = ${!resumed.note.includes("مكتوم")}`);
console.log(`console errors = ${errors.length}${errors.length ? `: ${errors.join(" | ")}` : ""}`);

await b.close();
await db.dispose?.();
