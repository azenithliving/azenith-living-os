import fs from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * The owner's word «ابعت»: one live alert through the store's OWN command path, then one real
 * vote through the customer's door, and the sheet is read back for the stamp.
 *   node scratch/send-live-alert.mjs [base] [passport-path]
 *
 * Two numbers come out of this: what the command layer says when it sends, and whether the sheet
 * that woke two voters carries a pulse stamp afterwards. If the command lands and the vote does
 * not, the fault is inside the vote door, not in the bot.
 */
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const SHEET = process.argv[3] || "/passport/GbKYqCIzusXMNUYCWx188jBK";
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

  const alert = await page.evaluate(async () => {
    const res = await fetch("/api/admin/mastermind/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "send_notification تجربة التنبيه من رحلة العميل — لو وصلت دي فالتنبيه شغال" }),
    });
    return { http: res.status, body: await res.json().catch(() => null) };
  });
  console.log(`\n── أمر التنبيه من مسار التطبيق ──\nhttp=${alert.http} · ${JSON.stringify(alert.body).slice(0, 500)}`);

  const vote = await page.evaluate(
    async ([path]) => {
      const token = path.split("/").pop();
      const res = await fetch(`/api/passport/${token}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_key: "i-live-alert", image_url: `${location.origin}${path}`, voter: "تنبيه حي", liked: true }),
      });
      const data = await res.json();
      const after = await fetch(`/api/passport/${token}`, { headers: { "x-visit-key": "livealertprobe001" } });
      const sheet = (await after.json())?.sheet ?? null;
      return { http: res.status, people: data?.people ?? null, pulse: sheet?.pulse_sent_at ?? null };
    },
    [SHEET]
  );
  console.log(`\n── تصويت حي على ورقة التجربة ──\nhttp=${vote.http} · الصوّتين: ${JSON.stringify(vote.people)} · ختم النبضة: ${vote.pulse ?? "فاضي"}`);

  const ok = Boolean(vote.pulse);
  console.log(`\nVERDICT: ${ok ? "التنبيه من مسار التصويت ختم الورقة — المحطة ثبتت" : "التنبيه ما ختمش الورقة — العيب جوه باب التصويت مش في البوت"}`);
} catch (err) {
  console.log(`FAIL ${String(err?.message || err).slice(0, 200)}`);
  process.exitCode = 1;
} finally {
  await b.close();
}
