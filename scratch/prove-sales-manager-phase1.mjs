/**
 * Phase one of «مدير المبيعات», measured on the real database through a built server.
 *
 * Four questions, all answered with counts:
 *  1. can the owner reach the office from the old house's menu at all?
 *  2. is the office named after the employee, and does his face sit on it?
 *  3. does a chip on his face answer with the same customer number the office shows?
 *  4. does any forbidden trade word appear on his screen?
 *
 * Prints counts and the sentences it found. Screenshots to scratch/.
 */
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import fs from "node:fs";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const BASE = process.argv.find((a) => a.startsWith("http")) || "http://localhost:3111";
const results = [];
const say = (k, v) => { results.push(`${k}: ${v}`); console.log(`${k}: ${v}`); };

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('input[placeholder="000000"]', { timeout: 60000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click('button[type=submit]');
for (let i = 0; i < 25 && !p.url().includes("/admin"); i++) await p.waitForTimeout(1500);
say("logged into", p.url().replace(BASE, ""));

// ── 1. the door in the old house ───────────────────────────────────────
await p.goto(`${BASE}/admin/sales`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(7000);
const door = p.locator('aside a[href="/admin/v2/sales"]');
const doorCount = await door.count();
const doorText = doorCount ? (await door.first().innerText()).replace(/\s+/g, " ") : "(none)";
say("old-house door to the office", `${doorCount} — «${doorText}»`);
if (doorCount) {
  await door.first().click();
  for (let i = 0; i < 20 && !p.url().includes("/admin/v2/sales"); i++) await p.waitForTimeout(1000);
  say("clicking it lands on", p.url().replace(BASE, ""));
}

// ── 2. the office, its name and its face ───────────────────────────────
await p.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(10000);
const body = await p.locator("body").innerText();
say("header carries his name", String(/مدير المبيعات/.test(body)));
say("the room name is gone", String(!/مكتب المبيعات/.test(body)));
const placeholder = /اكتب بلهجتك العادية لـ ([^\n]*)/.exec(body);
say("his chat asks for", placeholder ? `«${placeholder[1].trim()}»` : "(no chat input found)");
const chips = ["اعرض قائمة العملاء", "اعرض العملاء المشتريين", "اعرض العملاء اللي مستنيين رد"]
  .filter((c) => body.includes(c));
say("chips on his face", `${chips.length} of 3`);
const forbidden = [...body.matchAll(/عربون|أمر بيع|هامش|المخزن|الورشة|VIP/g)];
say("forbidden trade words on screen", forbidden.length ? JSON.stringify([...new Set(forbidden.map((f) => f[0]))]) : "0");

// how many customers does the office show?
const officeCards = await p.locator('div[class*="hover:bg-white/"]').count();
say("cards rendered on his desk", String(officeCards));

// ── 3. press a chip and compare the numbers ────────────────────────────
const before = await p.evaluate(async () => {
  const r = await (await fetch("/api/admin/customers", { cache: "no-store" })).json();
  return r.totals?.customers ?? null;
});
say("the roll answers", String(before));

const input = p.locator('textarea, input[placeholder*="اكتب"]').first();
await input.fill("اعرض قائمة العملاء");
await p.keyboard.press("Enter");
let reply = "";
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(3000);
  const text = await p.locator("body").innerText();
  const line = /(\d+)\s*عميل[^\n]*/.exec(text);
  if (line) { reply = line[0]; break; }
  if (/الدفتر ما ردّش|فشلت|خطأ/.test(text)) { reply = text.match(/.*(الدفتر ما ردّش|فشلت|خطأ).*/)?.[0] ?? "error"; break; }
}
say("his answer", reply || "(no answer within 2 minutes)");
const answered = parseInt(reply, 10);
say("same number as the office", answered === before ? "yes" : `NO — office ${before}, chat ${answered}`);
await p.screenshot({ path: "scratch/sales-manager-office.png" });

// ── 4. the quick action is now a door, not a second counter ────────────
await p.goto(`${BASE}/admin/agents`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(8000);
const tiles = await p.locator('a[href="/admin/v2/sales"]').count();
const agentsBody = await p.locator("body").innerText();
say("agents centre links into the office", `${tiles}`);
say("the agents centre still counts customers itself", /(\d+)\s*عميل\/lead/.test(agentsBody) ? "YES (defect)" : "no");

say("console errors", String(errors.length));
if (errors.length) say("first errors", JSON.stringify(errors.slice(0, 3)));
await b.close();
