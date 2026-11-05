/**
 * The big loop, second pass: the customer's journey on the published site at his width, with every
 * station judged by the handle the page really uses and by a number, not by a click that returned.
 *   node scratch/run-customer-journey.mjs [base]
 *
 * Stations: دخول ← (منطقة) ← لوحة مزاج ← ورقة ← جواز ← تصويت ← تنبيه ← مكالمة.
 * A station that cannot be reached prints why instead of passing quietly. Rows are written (a test
 * paper, votes, a test phone as the owner pointer); nothing is deleted — the pointer is printed.
 */
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import sharp from "sharp";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const BASE = process.argv[2] ?? "https://azenith-living.vercel.app";
const PHONE = "01099999991";
const VOTERS = ["مريم", "أحمد"];
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
const png = await sharp(Buffer.from(svg)).png().toBuffer();

const results = [];
const station = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok === true ? "ok  " : ok === false ? "FAIL" : "—   "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
const p = await ctx.newPage();
const errors = [];
const badResponses = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 90)));
// A console 404 names no URL; the response does. Both are printed so a failure is findable.
p.on("response", (r) => r.status() >= 400 && badResponses.push(`${r.status()} ${r.url().replace(BASE, "")}`));

const text = async (page) => (((await page.locator("main").textContent().catch(() => "")) || "").replace(/\s+/g, " ").trim());
const store = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
/** The stamp is the store's fact, not the customer page's — read it where it lives. */
const stampFromStore = async (token) => {
  const { data } = await store.from("room_sketches").select("pulse_sent_at").like("token", `${token.slice(0, 6)}%`).maybeSingle();
  return data?.pulse_sent_at ?? null;
};
const tokenOf = (path) => path.split("/").pop();
const readSheet = (page, path) =>
  page.evaluate(async ([token, key]) => {
    const res = await fetch(`/api/passport/${token}`, { headers: { "x-visit-key": key } });
    const data = await res.json();
    return data?.sheet ?? null;
  }, [tokenOf(path), "journeyprobe00001"]);

try {
  // ── 1. دخول — the customer's four choices ──────────────────────────────────────────────
  await p.goto(`${BASE}/start`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(7000);
  const tapped = [];
  for (let step = 0; step < 4; step += 1) {
    // An option is a button whose own label carries Arabic; a language switch or an arrow does not.
    const option = p
      .locator("button")
      .filter({ hasText: /[\u0600-\u06FF]{3,}/ })
      .filter({ hasNotText: /التالي|التالى|رجوع|السابق|احجز|أرسل|إرسال/ })
      .first();
    if (!(await option.count())) break;
    tapped.push(((await option.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim().slice(0, 26));
    await option.click().catch(() => {});
    await p.waitForTimeout(900);
    const next = p.locator("button").filter({ hasText: /التالي|التالى|التالي|إتمام|أرسل|إرسال/ }).first();
    if (await next.count()) await next.click().catch(() => {});
    await p.waitForTimeout(1200);
  }
  await p.screenshot({ path: "scratch/journey-1-start.png" });
  const stored = await p.evaluate(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("azenith-session") || "{}");
      const s = raw?.state || raw;
      return [s?.roomType, s?.budget, s?.style, s?.serviceType].filter(Boolean).join(" · ");
    } catch {
      return "";
    }
  });
  station("١ دخول — أربع اختيارات اتسجلت في الجلسة", tapped.length >= 3 && stored.length > 4, `دوسات: ${tapped.join(" | ")} · المحفوظ: ${stored || "ولا حاجة"}`);

  // ── the front door: can a customer ever reach his own sheet? ────────────────────────────
  await p.goto(`${BASE}/request`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(7000);
  // The card is the door; the link only exists after he sends his photo, so the door is judged by
  // the card and its handles — not by a link that cannot be there yet.
  const card = await p.locator("[data-own-sheet-card]").count();
  const cardParts = {
    phone: await p.locator("[data-own-sheet-phone]").count(),
    file: await p.locator("[data-own-sheet-file]").count(),
    send: await p.locator("[data-own-sheet-send]").count(),
  };
  await p.screenshot({ path: "scratch/journey-2-request.png" });
  station(
    "بوابة العميل لجوازه موجودة في صفحة الطلب",
    card > 0 && cardParts.phone > 0 && cardParts.file > 0 && cardParts.send > 0,
    `كروت: ${card} · ${JSON.stringify(cardParts)}`
  );

  // ── 4. ورقة — the owner files the paper, which mints the passport ───────────────────────
  await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
  await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
  await p.click("button[type=submit]");
  await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
  const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
  await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
  await p.click("button[type=submit]");
  for (let i = 0; i < 20 && !p.url().includes("/admin"); i += 1) await p.waitForTimeout(1500);
  station("دخول المالك على البوابة", p.url().includes("/admin"), p.url());

  const made = await p.evaluate(
    async ([base64, phone]) => {
      const res = await fetch("/api/admin/ops/sketch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64, mime: "image/png", customer_key: `phone:${phone}` }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    [png.toString("base64"), PHONE]
  );
  const passportPath = made.body?.passport_path || made.body?.data?.passport_path;
  station("٤ ورقة — الورقة اتسجلت واتعملها عنوان سرّي", Boolean(passportPath), `http=${made.status} · ${passportPath ?? JSON.stringify(made.body ?? {}).slice(0, 140)}`);
  if (!passportPath) throw new Error("الرحلة وقفت هنا: مفيش جواز اتعمل");

  // ── 5. جواز — the customer opens it with no account ─────────────────────────────────────
  const sheet = await ctx.newPage();
  await sheet.goto(`${BASE}${passportPath}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await sheet.waitForTimeout(10000);
  const first = await readSheet(sheet, passportPath);
  const images = await sheet.locator("img").count();
  await sheet.screenshot({ path: "scratch/journey-3-passport.png" });
  station("٥ جواز — فتح بغير حساب وفيه صور", images > 1 && Boolean(first), `صور: ${images} · أرقام مقروءة: ${JSON.stringify(first?.dimensions ?? []).slice(0, 40)}`);

  // He confirms numbers. Two real paths: the reader brought some and he agrees, or the reader was
  // refused and he writes his own — which is the witness the store ships with today.
  const dims = (first?.dimensions ?? []).map((d) => String(typeof d === "number" ? d : d?.value ?? "")).filter(Boolean);
  const phoneBox = sheet.locator("[data-contact-phone]").first();
  if (await phoneBox.count()) await phoneBox.fill(PHONE).catch(() => {});
  const fields = sheet.locator("[data-dim-input]");
  const fieldCount = await fields.count();
  const written = [];
  if (fieldCount) {
    const wanted = dims.length ? dims.slice(0, fieldCount) : ["4.5", "3.2"].slice(0, fieldCount);
    for (let i = 0; i < fieldCount; i += 1) {
      const value = wanted[i] ?? wanted[wanted.length - 1];
      await fields.nth(i).fill(String(value)).catch(() => {});
      written.push(String(value));
    }
    await sheet.locator("[data-confirm-dims]").first().click().catch(() => {});
    await sheet.waitForTimeout(8000);
  }
  const after = await readSheet(sheet, passportPath);
  const sealed = Boolean(after?.confirmed_at ?? after?.sealed);
  const sealSource = dims.length ? "أرقام القارئ اتأكدت" : "أرقام هو اللي كتبها";
  station(
    "٥ جواز — أرقامه قفلت الورقة",
    sealed,
    sealed
      ? `${sealSource} · مقاسات مخزّنة: ${(after?.dimensions ?? []).length} · ختم: ${String(after?.confirmed_at).slice(11, 19)}`
      : fieldCount
        ? `مفيش قفل رغم إنه كتب (${written.join(",")}): ${String(after?.failure ?? "مفيش سبب مسجّل").slice(0, 90)}`
        : `مفيش خانات مقاسات على الورقة أصلًا (${JSON.stringify(first?.dimensions ?? []).slice(0, 40)})`
  );

  // ── 3. لوحة مزاج — the colour picks the sheet really offers ─────────────────────────────
  const swatches = sheet.locator("[data-colour-swatch]");
  const swatchCount = await swatches.count();
  if (swatchCount >= 4) {
    for (let i = 0; i < 4; i += 1) await swatches.nth(i).click().catch(() => {});
    await sheet.waitForTimeout(5000);
    const picked = ((await readSheet(sheet, passportPath))?.colour_picks ?? []).length;
    const disabled = await sheet.locator("[data-colour-swatch][disabled]").count();
    const full = await sheet.locator("[data-colour-full]").count();
    await sheet.screenshot({ path: "scratch/journey-4-colours.png" });
    station("٣ لوحة مزاج — تلاتة يتسجلوا والرابع يقفل", picked === 3 && (disabled > 0 || full > 0), `مختار: ${picked} · مقفول: ${disabled} · إشارة الامتلاء: ${full} · متاح: ${swatchCount}`);
  } else {
    station("٣ لوحة مزاج", null, `مصفوفة الألوان ما ظهرتش (خانات: ${swatchCount}) — الورقة من غير رقم مقاس مقروء أو البنك فاضي`);
  }

  // ── 6. تصويت — two family members on the same link ─────────────────────────────────────
  const people = [];
  for (const voter of VOTERS) {
    const fam = await ctx.newPage();
    await fam.goto(`${BASE}${passportPath}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await fam.waitForTimeout(10000);
    const nameBox = fam.locator("[data-family-name]").first();
    const voteButton = fam.locator("[data-family-vote]").first();
    if (!(await nameBox.count()) || !(await voteButton.count())) {
      people.push(`${voter}: مفيش غرفة قرار (${await nameBox.count()} خانة اسم / ${await voteButton.count()} زر)`);
      await fam.close();
      continue;
    }
    await nameBox.fill(voter);
    await voteButton.click().catch(() => {});
    await fam.waitForTimeout(5000);
    const tally = await fam.evaluate(async (token) => {
      const res = await fetch(`/api/passport/${token}/votes`);
      const data = await res.json();
      return { http: res.status, people: data?.people ?? null, tallies: (data?.tallies ?? []).length };
    }, tokenOf(passportPath));
    people.push(`${voter}: ${JSON.stringify(tally)}`);
    const listed = await tally.people;
    if (listed?.includes(voter)) people[people.length - 1] += " ✓";
    await fam.screenshot({ path: `scratch/journey-5-vote-${voter}.png` });
    await fam.close();
  }
  console.log(people.map((x) => `     ${x}`).join("\n"));
  let votersOnSheet = [];
  try {
    const parsed = JSON.parse(people[people.length - 1].replace(/^[^:]+:\s*/, "").replace(/ ✓$/, ""));
    if (Array.isArray(parsed?.people)) votersOnSheet = parsed.people;
  } catch {
    console.log("     آلة القراءة ما فهمتش آخر رد — بتحكم على اللي قبله");
  }
  station("٦ تصويت — اتنين صوّتوا على نفس الرابط", VOTERS.every((v) => votersOnSheet.includes(v)), `الصوّتين المسجلين: ${JSON.stringify(votersOnSheet)}`);

  // ── 7. تنبيه — did the heat stamp land on the sheet? ────────────────────────────────────
  // The customer's own reply does not carry the stamp (it is not his fact to read), so the stamp is
  // read from the store itself. Reading it off the sheet payload reported "empty" on a sheet that
  // had been stamped 87 seconds after it was made — an instrument defect, recorded 2026-10-07.
  const stamped = await readSheet(sheet, passportPath);
  const pulse = await stampFromStore(tokenOf(passportPath));
  station("٧ تنبيه — ختم النبضة نزل على الورقة", Boolean(pulse), pulse ? `الورقة اتنبّهت عند ${new Date(pulse).toISOString().slice(11, 19)} ز` : `مفيش ختم — ردّ العميل نفسه قال: ${String(stamped?.failure ?? "مفيش سبب مسجّل").slice(0, 80)}`);

  // ── 8. مكالمة — the dossier the owner reads before calling ──────────────────────────────
  await p.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(10000);
  const search = p.locator("[data-dossier-search]").first();
  if (await search.count()) {
    await search.fill(PHONE);
    await p.waitForTimeout(7000);
    const pick = p.locator("[data-dossier-pick]").first();
    if (await pick.count()) {
      await pick.click().catch(() => {});
      await p.waitForTimeout(11000);
    }
  }
  // Read the dossier panel only. Reading the whole page let this station pass on chat text that
  // had nothing to do with the customer — a green assertion that proved nothing (measured 2026-10-07).
  const dossierText = await p
    .locator("[data-dossier-panel]")
    .first()
    .innerText()
    .then((t) => t.replace(/\s+/g, " ").trim())
    .catch(() => "");
  await p.screenshot({ path: "scratch/journey-6-dossier.png" });
  const foundVoters = VOTERS.filter((v) => dossierText.includes(v));
  const foundDims = /٤\.٥|4\.5|٣\.٢|3\.2/.test(dossierText);
  station(
    "٨ مكالمة — الملف قبل المكالمة حامل الرحلة",
    foundVoters.length > 0 || foundDims,
    `صوّتين ظاهرين: ${JSON.stringify(foundVoters)} · مقاسات ظاهرة: ${foundDims ? "أيوه" : "لأ"} · طول الملف: ${dossierText.length} حرف · ${dossierText.slice(0, 70)}`
  );

  station("كونسول نظيف طوال الرحلة", errors.length === 0 && badResponses.length === 0, [...new Set([...errors, ...badResponses])].slice(0, 4).join(" | "));
} catch (err) {
  station("الرحلة اكتملت", false, String(err?.message || err).slice(0, 180));
} finally {
  const done = results.filter((r) => r.ok === true).length;
  const broken = results.filter((r) => r.ok === false).length;
  console.log(`\n══ المحطات: ${done} ثبتت · ${broken} وقفت · ${results.length - done - broken} لا يوجد لها مسار ══`);
  console.log(`دليل الملف التجريبي: phone:${PHONE}`);
  await b.close();
}
