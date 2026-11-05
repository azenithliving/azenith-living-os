import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import postgres from "postgres";

/**
 * Proof on the published site, after the record was locked: every surface still answers.
 *
 * The lock takes the store's record away from the public browser key — the fix for what the privacy
 * audit measured on 2026-10-15 (69 of 155 tables answering a stranger, and a stored function that ran
 * any statement they typed). A lock that silences the store would be a worse bug than the hole, so this
 * walks every surface that used to read the record through the visitor's own key and requires it to
 * answer anyway, on the alias, at his width, with the console listened to and the picture looked at:
 *
 *   · the customer's pages: the home, the shelf, the catalogue's call button, the advisor's answer,
 *     his own paper filed and sealed with his own digits;
 *   · the owner's house: the cockpit, the sales office, the settings desk, the shelf desk, and the
 *     admin preview page — which reads its section through the session client, the exact path the
 *     lock was about to silence;
 *   · every door the browser called on the way, with its status, and every console error by name.
 *
 *   node scratch/prove-surfaces-after-the-lock.mjs
 */

const URL = "https://azenith-living.vercel.app";
const HIS_LOCAL = "01090819584";
const HIS_INTL = "201090819584";
const PROBE_PHONE = "01000000007";
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
const checks = [];
const claim = (label, ok, detail = "") => {
  checks.push({ label, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} · ${label}${detail ? ` · ${detail}` : ""}`);
};

const b = await chromium.launch({ headless: true });
const errors = [];
const doorCalls = [];

function watch(page, who) {
  page.on("console", (m) => m.type() === "error" && errors.push(`${who}: ${m.text().slice(0, 140)}`));
  page.on("pageerror", (e) => errors.push(`${who}: ${String(e).slice(0, 140)}`));
  page.on("response", async (res) => {
    const u = res.url();
    if (!u.includes("/api/")) return;
    const status = res.status();
    if (status >= 400) doorCalls.push(`${who} ${status} ${u.replace(URL, "")}`);
  });
}

// ---------------------------------------------------------------- the customer, with no passport to the owner's house
const anon = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
watch(anon, "customer");

await anon.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
await anon.waitForTimeout(4500);
const homeText = await anon.locator("body").innerText();
claim("the home page still renders in his Arabic", homeText.includes("أزينث") || homeText.includes("الدار"), `chars=${homeText.length}`);
claim("and still carries the store's own number in his digits", homeText.includes("٠١٠٩٠٨١٩٥٨٤") || homeText.includes(HIS_LOCAL));
await anon.screenshot({ path: "scratch/lock-home-390.png" });

await anon.goto(`${URL}/shop`, { waitUntil: "domcontentloaded", timeout: 90000 });
await anon.waitForTimeout(3500);
const shopState = await anon.locator("[data-shelf-state]").count();
const shopText = await anon.locator("body").innerText();
claim("the shelf still says what it is: empty, and soon", shopState > 0 && shopText.includes("قريبًا"), `panel=${shopState}`);

await anon.goto(`${URL}/furniture`, { waitUntil: "domcontentloaded", timeout: 90000 });
await anon.waitForTimeout(3500);
const waLinks = await anon.locator('a[href*="wa.me"]').evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
claim("the catalogue's call button still opens his number", waLinks.length > 0 && waLinks.every((h) => h.includes(HIS_INTL)), `links=${waLinks.length}`);

// the advisor: the door that was reading five tables through the visitor's key
const sessionId = `lockproof-${Date.now()}`;
const asked = await anon.request.post(`${URL}/api/consultant`, {
  data: { message: "عايز أسفرة مودرن لصالتي", sessionId },
  headers: { "content-type": "application/json" },
});
const askedBody = await asked.text();
claim("the advisor still answers a customer", asked.status() === 200 && /[\u0600-\u06FF]/.test(askedBody), `status=${asked.status()} bytes=${askedBody.length}`);

// his own paper: filed, then sealed on the numbers he typed himself
const filed = await anon.request.post(`${URL}/api/sheet`, { data: { image: PNG, phone: PROBE_PHONE }, headers: { "content-type": "application/json" } });
const filedBody = await filed.json();
const token = String(filedBody?.passport_path ?? "").split("/").pop() ?? "";
claim("a customer can still file his paper and get his address", filed.status() === 200 && token.length >= 20, `token=${token.slice(0, 4)}…`);

const wrote = await anon.request.post(`${URL}/api/passport/${token}`, {
  data: { dimensions: [4.17, 3.29], customer_phone: PROBE_PHONE },
  headers: { "content-type": "application/json" },
});
const wroteBody = await wrote.json();
claim("his own numbers are accepted, and the store says which witness sealed them", wrote.status() === 200 && wroteBody?.matched === true, `sealedBy=${wroteBody?.sealedBy ?? "not stated"} message=${String(wroteBody?.message ?? "").slice(0, 44)}`);

const stored = await sql`select customer_dimensions, confirmed_at, ok from room_sketches where token = ${token}`;
claim("and the record really holds them", Boolean(stored[0]?.confirmed_at) && stored[0]?.ok === true && (stored[0]?.customer_dimensions ?? []).length === 2, `stored=${JSON.stringify(stored[0]?.customer_dimensions ?? null)}`);

await anon.goto(`${URL}/passport/${token}`, { waitUntil: "domcontentloaded", timeout: 90000 });
await anon.waitForTimeout(5000);
const sheetText = await anon.locator("body").innerText();
claim("his sheet on screen says the drawing is agreed, not disputed", sheetText.includes("اتفقنا عليه") || sheetText.includes("اتقفلت"), `chars=${sheetText.length}`);
await anon.screenshot({ path: "scratch/lock-sheet-sealed-390.png" });

// ---------------------------------------------------------------- the owner, through his own gate
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const p = await ctx.newPage();
watch(p, "owner");
await p.goto(`${URL}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(4000);
await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await p.click("button[type=submit]");
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click("button[type=submit]");
for (let i = 0; i < 20 && !p.url().includes("/admin"); i += 1) await p.waitForTimeout(2000);
claim("the gate still lets its owner in", p.url().includes("/admin"), `landed on ${p.url().replace(URL, "")}`);
await p.screenshot({ path: "scratch/lock-gate-390.png" });

const screens = [
  { href: "/admin/v2/ops", marker: "الاستوديو", label: "the studio cockpit" },
  { href: "/admin/v2/sales", marker: "مدير المبيعات", label: "the sales office" },
  { href: "/admin/v2/settings", marker: "أرقام التواصل", label: "the settings desk" },
  { href: "/admin/v2/shop", marker: "رفّ الجاهز", label: "the shelf desk" },
];
for (const s of screens) {
  await p.goto(`${URL}${s.href}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(5000);
  const text = await p.locator("body").innerText();
  claim(`${s.label} still answers with its own Arabic`, text.includes(s.marker), `chars=${text.length}`);
}
await p.screenshot({ path: "scratch/lock-cockpit-390.png" });

const section = await sql`select id from room_sections order by id limit 1`;
if (section.length) {
  await p.goto(`${URL}/preview/section/${section[0].id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(4000);
  const previewText = await p.locator("body").innerText();
  claim(
    "the admin preview still reads its section through the session client",
    previewText.includes("معاينة إدارية") && !previewText.includes("404"),
    `chars=${previewText.length}`,
  );
  await p.screenshot({ path: "scratch/lock-preview-390.png" });
}

// ---------------------------------------------------------------- what the instrument leaves behind
const erased = await sql`delete from room_sketches where token = ${token} returning id`;
const still = await sql`select count(*)::int as n from room_sketches where token = ${token}`;
console.log(`sources · the instrument's paper removed: ${erased.length} row · still holding: ${still[0].n}`);

console.log(`\n== doors the browser called that answered 4xx or 5xx (${doorCalls.length}) ==`);
for (const d of [...new Set(doorCalls)].slice(0, 20)) console.log(`· ${d}`);
console.log(`\n== console errors (${errors.length}) ==`);
for (const e of [...new Set(errors)].slice(0, 20)) console.log(`· ${e}`);

const failed = checks.filter((c) => !c.ok);
console.log(`\n== الخلاصة ==\n${checks.length - failed.length} راجع من ${checks.length} قياس · فاشل ${failed.length} · أخطاء كونسول ${errors.length} · أبواب مرفوضة ${doorCalls.length}`);

await b.close();
await sql.end();
process.exit(failed.length || errors.length ? 1 : 0);
