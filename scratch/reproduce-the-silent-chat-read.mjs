import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * Phase 1 evidence for the sales office chat that went quiet: where does the failure die?
 *
 * The owner saw the conversation open with nothing in it once, and only the browser console knew.
 * This measures the read path on his published site at his width, three times, on the same screen:
 *
 *   ١) as it is — the door answers, the bubbles are there;
 *   ٢) the door cut off mid-air (a network failure, the family of «aborted while navigating»);
 *   ٣) the door answering honestly with its own 500 («خطأ في السيرفر»).
 *
 * The question each case answers is the same one: when the record did not answer, does his screen say
 * so — or does it show the «start a conversation» panel as if the shop had nothing to tell him?
 *
 *   node scratch/reproduce-the-silent-chat-read.mjs
 */

const BASE = "https://azenith-living.vercel.app";
const DOOR = "**/api/admin/agents/messages**";
const EMPTY_LINE = "ابدأ محادثة تشغيلية";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const p = await ctx.newPage();
const consoleLines = [];
p.on("console", (m) => m.type() === "error" && consoleLines.push(m.text().slice(0, 120)));
p.on("pageerror", (e) => consoleLines.push("pageerror: " + String(e).slice(0, 120)));

async function signIn() {
  await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(4000);
  await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
  await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
  await p.click("button[type=submit]");
  await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
  const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
  await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
  await p.click("button[type=submit]");
  for (let i = 0; i < 20 && !p.url().includes("/admin"); i += 1) await p.waitForTimeout(2000);
  console.log(`sources · signed in, landed on ${p.url().replace(BASE, "")}`);
}

async function readScreen(label) {
  const body = await p.locator("body").innerText();
  const state = await p.locator("[data-thread-area]").getAttribute("data-chat-read-state").catch(() => null);
  const facts = {
    label,
    saysStartAConversation: body.includes(EMPTY_LINE),
    hasArabicFailureLine: /ما جابش|ما ردّش|السجل ما جاوبش|حاول تاني/.test(body),
    readState: state ?? "no such attribute",
  };
  console.log(
    `case · ${label} · empty-panel=${facts.saysStartAConversation} · failure-line=${facts.hasArabicFailureLine} · read-state=${facts.readState} · console-errors=${consoleLines.length}`,
  );
  await p.screenshot({ path: `scratch/silent-chat-${label.replace(/[^a-z]/gi, "-")}.png` });
  return facts;
}

await signIn();

// ١) the screen as it is today
await p.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(7000);
const live = await readScreen("door-answers");

// ٢) the door cut off mid-air
await p.route(DOOR, (route) => route.abort("failed"));
await p.reload({ waitUntil: "domcontentloaded" });
await p.waitForTimeout(7000);
const cut = await readScreen("door-cut");
await p.unroute(DOOR);

// ٣) the door answering with its own honest 500
await p.route(DOOR, (route) =>
  route.fulfill({
    status: 500,
    contentType: "application/json",
    body: JSON.stringify({ success: false, error: "خطأ في السيرفر" }),
  }),
);
await p.reload({ waitUntil: "domcontentloaded" });
await p.waitForTimeout(7000);
const refused = await readScreen("door-500");
await p.unroute(DOOR);

console.log(`\n== الكونسول (${consoleLines.length}) ==`);
for (const line of [...new Set(consoleLines)].slice(0, 10)) console.log(`· ${line}`);

const silent = [cut, refused].filter((c) => !c.hasArabicFailureLine);
console.log(`\n== الخلاصة ==`);
console.log(`· المحادثة فيها سطور فعلية؟ لوحة «ابدأ محادثة» ظهرت=${live.saysStartAConversation} (معناها مفيش سطور معروضة)`);
console.log(`· لما السجل ما ردّش: ${silent.length} من ٢ حالات ما قالتش حاجة على الشاشة (العيّب صامت)`);
console.log(`· read-state على الشاشة: ${[live, cut, refused].map((c) => c.readState).join(" | ")}`);

await b.close();
