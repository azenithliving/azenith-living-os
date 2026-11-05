import fs from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * What the deployed runtime itself sees about Telegram, and one real test send from inside the app.
 *   node scratch/telegram-status-test.mjs [base]
 */
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "").trim()])
);

const b = await chromium.launch({ headless: true });
const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" })).newPage();
try {
  await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
  await page.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
  const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
  await page.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
  await page.click("button[type=submit]");
  for (let i = 0; i < 20 && !page.url().includes("/admin"); i += 1) await page.waitForTimeout(1500);
  console.log(`signed in: ${page.url().includes("/admin")}`);

  const out = await page.evaluate(async () => {
    const get = async (path) => {
      const res = await fetch(path);
      return { http: res.status, body: await res.json().catch(() => null) };
    };
    const status = await get("/api/admin/telegram/status");
    const cfgRes = await fetch("/api/admin/telegram/config");
    const cfgBody = await cfgRes.json().catch(() => null);
    console.log("CONFIG " + JSON.stringify(cfgBody).slice(0, 500));
    const chats = (cfgBody?.config?.chats ?? cfgBody?.chats ?? []).map((c) => c.chatId).filter(Boolean);
    const sent = [];
    for (const one of chats) {
      const res = await fetch("/api/admin/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: String(one), message: "🧪 اختبار التنبيه من رحلة العميل — لو وصلت دي فالباب شغال" }),
      });
      const body = await res.json().catch(() => null);
      sent.push({ tail: `…${String(one).slice(-4)}`, http: res.status, body });
    }
    const test = { chatsTried: chats.length, sent };
    return { status, config: cfgBody, test };
  });
  console.log(`\n── إعدادات الباب ──\n${JSON.stringify(out.config).slice(0, 700)}`);
  console.log(`\n── ما يراه التطبيق المنشور ──\n${JSON.stringify(out.status).slice(0, 700)}`);
  console.log(`\n── رسالة الاختيار من داخل التطبيق ──\n${JSON.stringify(out.test).slice(0, 700)}`);
} catch (err) {
  console.log(`FAIL ${String(err?.message || err).slice(0, 200)}`);
  process.exitCode = 1;
} finally {
  await b.close();
}
