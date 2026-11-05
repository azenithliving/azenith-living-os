import fs from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * The ten-second brief, pressed for real on the published cockpit.
 *   node scratch/check-voice-brief.mjs [base]
 *
 * A headless browser usually has no speech voices at all, and that is not a dead end — it is the
 * failure state the button must handle: press it, and it must say why nothing was read instead of
 * sitting there silently. What this cannot prove is the sound itself: that needs his ears, and the
 * report says so.
 */
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "").trim()])
);

let failed = false;
const say = (label, ok, detail = "") => {
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" })).newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 90)));
page.on("pageerror", (e) => errors.push(String(e).slice(0, 90)));

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
  say("signed in", page.url().includes("/admin"));

  await page.goto(`${BASE}/admin/v2/agents/ops?agent=ops-lead`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(9000);

  const voices = await page.evaluate(() =>
    typeof window.speechSynthesis === "undefined"
      ? { supported: false, arabic: 0, total: 0 }
      : {
          supported: true,
          total: window.speechSynthesis.getVoices().length,
          arabic: window.speechSynthesis.getVoices().filter((v) => v.lang?.startsWith("ar")).length,
        }
  );
  console.log(`     voices on this browser: ${JSON.stringify(voices)}`);

  const button = page.locator("[data-voice-brief]").first();
  say("the brief button is on screen", (await button.count()) > 0);
  const label = (await button.innerText()).trim();
  say("it is labelled in his Arabic", /ملخص|بأقرأ/.test(label) && !/[A-Za-z]{4,}/.test(label), `«${label}»`);

  await button.click();
  const seen = [];
  for (const wait of [500, 1500, 2500, 4000]) {
    await page.waitForTimeout(wait);
    seen.push(await button.getAttribute("data-voice-brief"));
  }
  const state = seen.at(-1);
  const after = await page.evaluate(() => ({
    total: window.speechSynthesis.getVoices().length,
    arabic: window.speechSynthesis.getVoices().filter((v) => v.lang?.startsWith("ar")).length,
    speaking: window.speechSynthesis.speaking,
  }));
  console.log(`     states seen: ${seen.join(" → ")} · after: ${JSON.stringify(after)}`);
  say("pressing it reached a final state", state === "speaking" || state === "unavailable", `state ${state}`);
  if (state === "speaking") {
    say("and a real Arabic voice was behind it", after.arabic > 0 || after.speaking, JSON.stringify(after));
  }
  if (state === "unavailable") {
    const note = await page.locator("[data-voice-note]").first().innerText().catch(() => "");
    say("and it named what the phone has", /صوت/.test(note) && /[٠-٩]/.test(note) || /ما بيعرفش/.test(note), note.replace(/\s+/g, " ").slice(0, 90));
    say("the note is its own line, not squeezed in the row", (await page.locator("[data-voice-note]").count()) > 0);
  }

  if (state === "unavailable") {
    const reason = await page.locator("[data-voice-brief-reason]").count();
    say("and it said why, instead of silence", reason > 0, `${reason} reason line(s)`);
  }

  // The picker: every Arabic voice on this device, and the choice must survive a reload.
  await page.locator("[data-voice-picker-toggle]").first().click();
  await page.waitForTimeout(800);
  const pickerOpen = (await page.locator("[data-voice-picker]").count()) > 0;
  say("the voice picker opens", pickerOpen);
  const options = await page.locator("[data-voice-option]").count();
  const listed = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-voice-option]")).map((el) => el.getAttribute("data-voice-option"))
  );
  console.log(`     voices offered: ${options} ${JSON.stringify(listed)}`);
  if (options > 0) {
    await page.locator("[data-voice-option]").first().click();
    await page.waitForTimeout(1200);
    const saved = await page.evaluate(() => localStorage.getItem("azenith-voice-name") ?? "");
    say("picking one saves it on this device", saved.length > 0, `«${saved}»`);
    const chosen = await page.locator("[data-voice-option]").first().getAttribute("data-voice-chosen");
    say("and marks it as the chosen voice", chosen === "1", `data-voice-chosen ${chosen}`);
  } else {
    const empty = await page.locator("[data-voice-picker]").innerText().catch(() => "");
    say("with none to offer, it says so usefully", /مفيش صوت عربي/.test(empty), empty.replace(/\s+/g, " ").slice(0, 80));
  }

  // The store's own voice, end to end through the admin gate.
  const door = await page.evaluate(async () => {
    const res = await fetch("/api/admin/speech?text=" + encodeURIComponent("صباح الخير. عندك 3 قرارات مستنية، أفتحها الأول؟"));
    const buf = await res.arrayBuffer();
    return { status: res.status, type: res.headers.get("content-type") || "", bytes: buf.byteLength };
  });
  say(
    "the store's own voice answers with real audio",
    door.status === 200 && /audio/.test(door.type) && door.bytes > 512,
    JSON.stringify(door)
  );

  say("nothing threw in his browser", errors.length === 0, errors.slice(0, 2).join(" | "));
  const empty = await page.evaluate(async () => {
    const res = await fetch("/api/admin/speech?text=");
    return { status: res.status };
  });
  say("and the door refuses a brief with nothing to say", empty.status === 400, JSON.stringify(empty));

  await page.screenshot({ path: "scratch/voice-brief-phone.png", fullPage: false });
  console.log("screenshot: scratch/voice-brief-phone.png");
  console.log("note: whether it SOUNDS right cannot be measured headlessly — that part is his ears.");
} catch (error) {
  say("the walk completed", false, String(error?.message || error).slice(0, 200));
} finally {
  await browser.close();
  if (failed) process.exitCode = 1;
}
