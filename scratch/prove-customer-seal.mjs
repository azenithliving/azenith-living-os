import fs from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import sharp from "sharp";

/**
 * The refused-paper seal, proven on the published store.
 *   node scratch/prove-customer-seal.mjs [base]
 *
 * Tonight the cloud reader refuses every paper, which is exactly the condition this rule exists for:
 * the customer must still be able to seal his own sheet with his own numbers — and the answer must
 * say which witness did it, instead of pretending two agreed.
 */
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const PHONE = "01099999992";
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "").trim()])
);

const svg = `<svg width="900" height="620" xmlns="http://www.w3.org/2000/svg">
  <rect width="900" height="620" fill="#f7f4ec"/>
  <rect x="120" y="120" width="640" height="360" fill="none" stroke="#222" stroke-width="6"/>
  <text x="440" y="100" font-family="Arial" font-size="46" text-anchor="middle" fill="#111">4.50</text>
  <text x="300" y="530" font-family="Arial" font-size="46" text-anchor="middle" fill="#111">3.20</text>
</svg>`;
const png = (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");

let failed = false;
const say = (label, ok, detail = "") => {
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

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

  const made = await page.evaluate(async ([img, phone]) => {
    const res = await fetch("/api/admin/ops/sketch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_base64: img, mime: "image/png", customer_key: `phone:${phone}` }),
    });
    return { http: res.status, body: await res.json().catch(() => null) };
  }, [png, PHONE]);
  const path = made.body?.passport_path;
  say("ورقة اتسجلت واتعملها عنوان", Boolean(path), `http=${made.http} · ${path ?? JSON.stringify(made.body ?? {}).slice(0, 120)}`);
  if (!path) throw new Error("مفيش ورقة");

  const before = await page.evaluate(async ([p]) => {
    const res = await fetch(`/api/passport/${p.split("/").pop()}`, { headers: { "x-visit-key": "sealproof0000001" } });
    const d = await res.json();
    return { ok: d?.sheet?.ok, failure: d?.sheet?.failure ?? null, dims: d?.sheet?.dimensions?.length ?? 0, confirmed: Boolean(d?.sheet?.confirmed_at) };
  }, [path]);
  console.log(`  حالة الورقة قبل: ok=${before.ok} · أرقام=${before.dims} · مقفولة=${before.confirmed} · ${String(before.failure ?? "").slice(0, 90)}`);

  const seal = await page.evaluate(async ([p, phone]) => {
    const res = await fetch(`/api/passport/${p.split("/").pop()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dimensions: [4.5, 3.2], customer_phone: phone }),
    });
    const d = await res.json().catch(() => null);
    return { http: res.status, sealedBy: d?.sealedBy ?? null, matched: d?.matched ?? null, message: d?.message ?? d?.error ?? null, ok: d?.success };
  }, [path, PHONE]);
  say("العميل قفل ورقته بنفسه", seal.ok === true && seal.matched === true, `http=${seal.http} · sealedBy=${seal.sealedBy} · ${String(seal.message ?? "").slice(0, 90)}`);
  say("والردّ قال أنهي شاهد قفلها", seal.sealedBy === "customer-only" || before.ok === true, `sealedBy=${seal.sealedBy}`);

  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(9000);
  const after = await page.evaluate(async ([p]) => {
    const res = await fetch(`/api/passport/${p.split("/").pop()}`, { headers: { "x-visit-key": "sealproof0000001" } });
    const d = await res.json();
    return { confirmed: Boolean(d?.sheet?.confirmed_at), dims: d?.sheet?.dimensions ?? [], sealed: d?.sheet?.sealed };
  }, [path]);
  const labels = after.dims.map((d) => d?.label).filter(Boolean);
  say("القفل مسجّل في القاعدة", after.confirmed === true, `مقفولة=${after.confirmed} · عدد الأرقام=${after.dims.length}`);
  say("والأرقام متسمية مصدرها", labels.length === 0 || labels.every((l) => /العميل/.test(l)), labels.join(" · ") || "مفيش labels");

  await page.screenshot({ path: "scratch/customer-seal-phone.png" });
  console.log("screenshot: scratch/customer-seal-phone.png");
} catch (err) {
  say("المشي كامل", false, String(err?.message ?? err).slice(0, 180));
} finally {
  await b.close();
  if (failed) process.exitCode = 1;
}
