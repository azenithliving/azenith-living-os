import { chromium } from "@playwright/test";

/**
 * What voices does this Chromium actually hand out, and which of them are Arabic?
 * Printed as name / language / remote-or-local / sample rate — the ranking in `pickArabicVoice`
 * should be built on this list, not on what browsers are supposed to provide.
 */
const browser = await chromium.launch({ headless: false, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await (await browser.newContext()).newPage();
await page.goto("about:blank");

const read = () =>
  page.evaluate(() =>
    (window.speechSynthesis?.getVoices() ?? []).map((v) => ({
      name: v.name,
      lang: v.lang,
      remote: !v.localService,
      default: v.default,
    }))
  );

let voices = await read();
for (let i = 0; i < 8 && voices.length === 0; i += 1) {
  await page.waitForTimeout(700);
  voices = await read();
}
console.log("count:", voices.length);
for (const v of voices) console.log(`  ${v.name} · ${v.lang} · ${v.remote ? "remote (Google network)" : "local (installed on the machine)"}${v.default ? " · default" : ""}`);
const arabic = voices.filter((v) => (v.lang ?? "").startsWith("ar"));
console.log("arabic:", arabic.length, arabic.map((v) => `${v.name}[${v.lang}${v.remote ? ",remote" : ""}]`).join(" | ") || "none");
await browser.close();
