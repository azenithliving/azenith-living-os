import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import speakeasy from "speakeasy";

/**
 * The alert card itself, at the owner's width.
 *
 * The published admin page scrolls inside its own container, so a full-page shot only ever catches
 * the top of it. This one finds the section that carries the alert, scrolls it into view, prints its
 * exact text, and photographs that section — because the claim being proved lives there, not in the
 * metric cards above it.
 *
 *   node scratch/prove-alert-card.mjs
 */
const BASE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && !/ERR_FAILED|Failed to load/i.test(m.text()) && errors.push(m.text().slice(0, 90)));

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(4000);
await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await p.click("button[type=submit]");
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click("button[type=submit]");
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(2000);

await p.goto(`${BASE}/admin/database`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(15000);

const found = await p.evaluate(() => {
  const sections = [...document.querySelectorAll("section")];
  const target = sections.find((s) => /التنبيهات التي تحتاج/.test(s.innerText));
  if (!target) return null;
  target.scrollIntoView({ block: "start" });
  return {
    text: target.innerText,
    box: (() => { const r = target.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })(),
    buttons: [...target.querySelectorAll("button")].map((btn) => btn.innerText.trim()),
  };
});

if (!found) {
  console.log("the alert section was NOT rendered");
} else {
  console.log(`section box = ${found.box.w}x${found.box.h}px · buttons = ${JSON.stringify(found.buttons)}`);
  console.log("--- exact text as he reads it ---");
  console.log(found.text);
  console.log("--- checks ---");
  console.log(`latin digits = ${(found.text.match(/[0-9]/g) ?? []).length}`);
  console.log(`latin words = ${JSON.stringify((found.text.match(/[A-Za-z]{2,}/g) ?? []).slice(0, 10))}`);
  console.log(`machine ids = ${/api|database|memory|external|cache/.test(found.text) ? "PRESENT — defect" : "none"}`);
  await p.waitForTimeout(700);
  const handle = await p.evaluateHandle(() =>
    [...document.querySelectorAll("section")].find((s) => /التنبيهات التي تحتاج/.test(s.innerText)));
  const element = handle.asElement();
  if (element) await element.screenshot({ path: "scratch/alert-card-390.png" });
}

console.log(`console errors = ${errors.length}${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await b.close();
