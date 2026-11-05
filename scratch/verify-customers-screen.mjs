/**
 * The customers screen as the owner sees it: log in, open the new sales office, count the
 * cards on the screen and check that a customer with no conversation is shown as one.
 *
 * Prints counts only. Screenshots go to scratch/.
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

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click('button[type=submit]');
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(1500);

await p.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(9000);

const cards = await p.locator('div[class*="hover:bg-white/"]').count();
const body = await p.locator("body").innerText();
const quiet = (body.match(/مفيش محادثة/g) || []).length;
const phones = (body.match(/01\d{9}/g) || []).length;
const waiting = /محتاجين رد دلوقتى/.test(body);
await p.screenshot({ path: "scratch/customers-screen-one-rule.png", fullPage: false });

// Open a card the way the notification deep link does it, with the key the door itself
// handed back — one for a customer with no conversation, one for a customer with a chat.
const keys = await p.evaluate(async () => {
  const j = await (await fetch("/api/admin/leads", { cache: "no-store" })).json();
  const quiet = (j.leads || []).find((l) => !l.session_id);
  const talked = (j.leads || []).find((l) => l.session_id);
  return { quiet: quiet?.id ?? null, talked: talked?.id ?? null };
});

const openWith = async (key, label) => {
  await p.goto(`${BASE}/admin/v2/sales?expand=${encodeURIComponent(key)}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(8000);
  const text = await p.locator("body").innerText();
  console.log(`${label} — card opened:`, /الميزانية/.test(text));
  return text;
};

const quietText = await openWith(keys.quiet, "the customer with no conversation");
console.log("  says he has no conversation:", /مفيش محادثة/.test(quietText));
console.log("  says how to reach him:", /مفيش وسيلة تواصل|تواصل عبر واتساب|البريد/.test(quietText));
await p.screenshot({ path: "scratch/customers-card-open.png", fullPage: false });

const talkedText = await openWith(keys.talked, "the customer with a chat");
console.log("  still offers the conversation:", /المحادثة الأصلية/.test(talkedText));
console.log("  can still be deleted:", (await p.locator('button:has(svg)').count()) > 0);
await p.screenshot({ path: "scratch/customers-card-with-chat.png", fullPage: false });

console.log("screen:", p.url());
console.log("cards rendered:", cards);
console.log("phones shown:", phones);
console.log("customers shown as having no conversation:", quiet);
console.log("the waiting chip is there:", waiting);
console.log("console errors:", errors.length ? errors.slice(0, 3) : "none");
await b.close();
