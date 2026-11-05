import fs from "node:fs";
import { chromium } from "@playwright/test";

/**
 * The three published atoms, measured on the published site at 390px.
 *   node scratch/check-live-three.mjs [base]
 *
 *  ١ the line under each employee's name, read off the cards themselves;
 *  ٢ the day's report, asked the way the owner asks it — through the assistant door;
 *  ٣ the picture a customer likes, and what the screen says when the store cannot read it.
 *
 * Credentials come from the environment and are never printed.
 */
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const latinIn = (text) => (String(text).match(/[A-Za-z0-9]/g) ?? []).length;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

try {
  await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('input[type="email"]', { timeout: 60000 });
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL.trim());
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD.trim());
  await page.waitForFunction(() => {
    const b = document.querySelector('button[type="submit"]');
    return Boolean(b) && !b.disabled;
  }, null, { timeout: 40000 });
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  if ((await page.evaluate(() => document.body.innerText)).includes("التحقق بخطوتين")) {
    const { default: speakeasy } = await import("speakeasy");
    const code = speakeasy.totp({ secret: env.ADMIN_GATE_2FA_SECRET.trim().toUpperCase(), encoding: "base32" });
    await page.locator('input:not([type="hidden"])').last().fill(code);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4500);
  }

  // ١ — the cockpit cards.
  await page.goto(`${BASE}/admin/v2`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("[data-employee-card]", { timeout: 90000 });
  await page.waitForFunction(() => !document.querySelector("[data-inboxes-loading]"), null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll("[data-employee-card]")].map((c) => ({
      name: c.querySelector("h3")?.textContent?.trim().slice(0, 24) ?? "?",
      teaser: c.querySelector("p.line-clamp-2")?.textContent?.trim() ?? "",
    }))
  );
  const badCards = cards.filter((c) => latinIn(c.teaser) > 0);
  console.log(`١ الكابينة: ${cards.length} كارت · ${cards.filter((c) => c.teaser).length} فيها سطر · ${badCards.length} فيها حرف أجنبي`);
  for (const c of badCards) console.log(`   LATIN · ${c.name} · ${c.teaser.slice(0, 70)}`);
  await page.screenshot({ path: "scratch/live-cards.png" });

  // ٢ — the day's report, asked the way the brain recognises it. The stats phrasing stops at a
  // plan line; this one reaches the report itself and writes only a chat row.
  const asked = await context.request.post(`${BASE}/api/admin/assistant`, {
    data: { message: "التقرير اليومي" },
    timeout: 120000,
  });
  const body = await asked.json().catch(() => null);
  const reply = String(body?.reply ?? "");
  console.log(`٢ التقرير: status ${asked.status()} · ${reply.length} حرف · ${latinIn(reply)} حرف لاتيني`);
  console.log(`   reached the report: ${/تقرير|المتجر بيرد/.test(reply) ? "yes" : "NO — the reply was something else"}`);
  console.log(`   ${reply.replace(/\s+/g, " ").slice(0, 300)}`);

  // ٣ — the customer's picture.
  // The room page needs the network to settle before the like button answers: clicking during
  // hydration produced a run that reported «no request fired» on a page that works — an
  // instrument lie, not a product one.
  await page.goto(`${BASE}/rooms/living-room`, { waitUntil: "networkidle", timeout: 120000 });
  await page
    .waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent?.includes("أعجبني")), null, { timeout: 90000 })
    .catch(() => {});
  const likes = page.locator("button", { hasText: "أعجبني" });
  const likeCount = await likes.count();
  if (likeCount === 0) {
    console.log("٣ الصورة: مافيش زرار إعجاب على الصفحة — مش متقاس");
  } else {
    const fired = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/analyze-image")) fired.push(r.method());
    });
    await likes.first().scrollIntoViewIfNeeded();
    await likes.first().click();
    await page
      .waitForFunction(() => [...document.querySelectorAll("div")].some((d) => String(d.className).includes("fixed") && d.querySelector("img")), null, { timeout: 90000 })
      .catch(() => {});
    const modal = await page.evaluate(() => {
      const dialog = [...document.querySelectorAll("div")].find((d) => String(d.className).includes("fixed") && d.querySelector("img"));
      const text = dialog?.innerText ?? "";
      const badge = [...(dialog?.querySelectorAll("div") ?? [])].find((d) => String(d.className).includes("absolute") && String(d.className).includes("rounded-full"));
      return { found: Boolean(dialog), badge: badge?.textContent?.trim() ?? null, excerpt: text.replace(/\s+/g, " ").slice(0, 220) };
    });
    console.log(`٣ الصورة: ${likeCount} زرار إعجاب · طلبات الباب: ${JSON.stringify(fired)} · ${modal.found ? "النافذة ظهرت" : "مافيش نافذة"} · الشارة: ${modal.badge ?? "ولا شارة"} · ${latinIn(modal.excerpt)} حرف لاتيني · تدّعي ذوق: ${modal.excerpt.includes("ذوقك") ? "أيوه" : "لأ"}`);
    console.log(`   ${modal.excerpt}`);
    await page.screenshot({ path: "scratch/live-photo.png" });
  }

  const verdict = {
    cardsClean: badCards.length === 0 && cards.filter((c) => c.teaser).length > 0,
    reportAsked: asked.status() === 200 && reply.length > 0,
    reportNoLatin: latinIn(reply) === 0,
  };
  console.log("verdict:", JSON.stringify(verdict, null, 1));
} finally {
  await browser.close();
}
