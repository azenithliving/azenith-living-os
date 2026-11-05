import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import postgres from "postgres";
import { config } from "dotenv";

/**
 * Proof on his published screens at his width: the settings desk says what answers, counts what does
 * not, and never carries the alert bot's credential to a browser.
 *
 *   node scratch/proof-settings-live.mjs
 */
config({ path: ".env.local" });
const BASE = "https://azenith-living.vercel.app";
const MARKER = "اللي بيتحكّم في حاجة فعلًا";
const MASK = "«مخفي — بيتحفظ في الخزانة مش على الشاشة»";

const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1, connect_timeout_ms: 25000 });
const stored = await sql`select value->>'botToken' as token from site_settings where key='telegram_config'`;
const realToken = stored[0]?.token ?? "";
await sql.end();
if (!realToken) {
  console.log("REFUSING: the credential is not in the record, so the leak test proves nothing.");
  process.exit(1);
}
console.log(`credential present in the record: yes (${realToken.length} chars, never printed)`);

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 140)));
p.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(4000);
await p.fill("input[type=email]", process.env.ADMIN_GATE_EMAIL);
await p.fill("input[type=password]", process.env.ADMIN_GATE_PASSWORD);
await p.click("button[type=submit]");
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = process.env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click("button[type=submit]");
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(2000);

await p.goto(`${BASE}/admin/v2/settings`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForSelector(`text=${MARKER}`, { timeout: 40000 }).catch(() => {});
await p.waitForTimeout(2500);
const html = await p.content();
const factCards = await p.locator("[data-setting]").count();
const residueLine = await p.getByText(/قيمة مسجّلة وما بيقرأهاش أي سطح/).count();
const telegramState = await p.getByText(/التنبيهات (شغالة|مقفولة)/).count();
const tokenOnScreen = html.includes(realToken);
await p.screenshot({ path: "scratch/settings-desk-390.png" });
console.log(`desk: facts=${factCards} residue line=${residueLine} telegram state=${telegramState} credential in the page=${tokenOnScreen}`);

// the door itself, read as the browser reads it
const listRes = await p.request.get(`${BASE}/api/admin/settings`);
const listBody = await listRes.text();
const maskedInList = listBody.includes(MASK);
const tokenInList = listBody.includes(realToken);
console.log(`door GET (all): status=${listRes.status()} masked=${maskedInList} credential present=${tokenInList}`);

const oneRes = await p.request.get(`${BASE}/api/admin/settings?key=telegram_config`);
const oneBody = await oneRes.text();
console.log(`door GET (one): status=${oneRes.status()} masked=${oneBody.includes(MASK)} credential present=${oneBody.includes(realToken)}`);

// Saving the mask back must be refused. Probed on a harmless key, never on the live credential:
// if the guard were missing, the probe would wipe the alert bot and his messages would stop.
const themeBefore = await (async () => {
  const s = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1, connect_timeout_ms: 25000 });
  const r = await s`select value::text as v from site_settings where key='theme'`;
  await s.end();
  return r[0]?.v ?? null;
})();
const saveRes = await p.request.post(`${BASE}/api/admin/settings`, {
  data: { key: "theme", value: { probe: MASK } },
});
const saveBody = await saveRes.json().catch(() => ({}));
const themeAfter = await (async () => {
  const s = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1, connect_timeout_ms: 25000 });
  const r = await s`select value::text as v from site_settings where key='theme'`;
  await s.end();
  return r[0]?.v ?? null;
})();
console.log(
  `door POST carrying the mask: status=${saveRes.status()} error=«${String(saveBody.error ?? "")}» · ` +
    `the record is untouched=${themeBefore === themeAfter} (${themeBefore ?? "null"})`
);

await b.close();

const passed =
  factCards === 3 && residueLine === 1 && telegramState === 1 && !tokenOnScreen &&
  maskedInList && !tokenInList && oneBody.includes(MASK) && !oneBody.includes(realToken) &&
  saveRes.status() === 400 && themeBefore === themeAfter && errors.length === 0;
console.log(`console errors: ${errors.length}${errors.length ? " → " + errors.slice(0, 3).join(" | ") : ""}`);
console.log(passed ? "PROVED" : "NOT PROVED — read the numbers above");
process.exit(passed ? 0 : 1);
