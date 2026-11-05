import fs from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * Does his chat actually read in his language now, on the published site?
 *   node scratch/check-owner-voice-live.mjs [base] [agent]
 *
 * The same thread is measured twice: as the store keeps it (the door's own rows) and as his screen
 * draws it (the rendered text, with links excluded because a web address is allowed as its own
 * element). The number that matters is the pair, not a verdict — and the retired key must be zero
 * on the screen whatever the store holds.
 */
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const AGENT = process.argv[3] || "ops-lead";
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

const stripUrls = (s) => s.replace(/https?:\/\/\S+/g, " ").replace(/\/[A-Za-z0-9\-_./]{4,}/g, " ").replace(/`[^`]*`/g, " ");
const latinIn = (s) => (stripUrls(s).match(/[A-Za-z]{3,}/g) ?? []);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 140));
});

const readRendered = () =>
  page.evaluate(() => {
    const area = document.querySelector("[data-thread-area]");
    if (!area) return null;
    // A link or a code span is evidence he reads as its own element; everything else is prose,
    // and prose is what his law says must be Arabic.
    const evidence = [...area.querySelectorAll("a, code, pre")].map((e) => e.textContent || "").join(" ");
    const clone = area.cloneNode(true);
    clone.querySelectorAll("a, code, pre").forEach((e) => e.remove());
    const bubbles = [...area.querySelectorAll("[data-thread-area] > div")];
    return {
      prose: clone.textContent || "",
      evidence,
      bubbles: bubbles.length,
      firstBubbles: bubbles.slice(0, 6).map((b) => (b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90)),
    };
  });

const bundleHas = (needle) =>
  page.evaluate(async (token) => {
    const urls = performance.getEntriesByType("resource").map((r) => r.name).filter((u) => u.endsWith(".js"));
    for (const url of urls) {
      try {
        if ((await (await fetch(url)).text()).includes(token)) return { hit: true, url: url.split("/").pop() };
      } catch {}
    }
    return { hit: false, url: "" };
  }, needle);

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
  say("signed in", page.url().includes("/admin"), page.url());

  await page.goto(`${BASE}/admin/v2/agents/ops?agent=${AGENT}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(11000);

  let shipped = await bundleHas("يتطوّر");
  for (let i = 0; i < 10 && !shipped.hit; i += 1) {
    console.log(`waiting for the pushed bundle (try ${i + 1})`);
    await page.waitForTimeout(30000);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(9000);
    shipped = await bundleHas("يتطوّر");
  }
  say("the published cockpit is running the pushed build", shipped.hit === true, shipped.url);

  const rows = await page.evaluate(async (agent) => {
    const res = await fetch(`/api/admin/agents/messages?agent_key=${agent}`);
    const data = await res.json();
    return (data?.data || []).filter((m) => m.sender_type === "agent").map((m) => String(m.content || ""));
  }, AGENT);

  const rendered = await readRendered();
  if (!rendered) throw new Error("the thread never rendered");

  const storedWords = rows.flatMap(latinIn);
  const proseWords = latinIn(rendered.prose);
  const evidenceWords = latinIn(rendered.evidence);
  const storedRetired = rows.filter((r) => /qayyim/i.test(r)).length;
  const screenRetired = /qayyim/i.test(rendered.prose + rendered.evidence) ? 1 : 0;
  const reduction = storedWords.length ? Math.round((1 - proseWords.length / storedWords.length) * 100) : 0;

  console.log(`agent rows ${rows.length} · stored Latin words ${storedWords.length} · left in his prose ${proseWords.length} · in links and code ${evidenceWords.length}`);
  console.log(`what is left in the prose: ${JSON.stringify([...new Set(proseWords)].slice(0, 18))}`);
  console.log(`rows carrying the retired key ${storedRetired} · on the screen ${screenRetired}`);

  say("the prose carries fewer Latin words than the store", proseWords.length < storedWords.length, `${storedWords.length} → ${proseWords.length}`);
  say("at least seven in ten of them are gone from the prose", reduction >= 70, `reduction ${reduction}٪`);
  say("the retired key never reaches him", screenRetired === 0, `screen ${screenRetired} of stored ${storedRetired}`);

  const passRow = rows.findIndex((r) => /\bPass\b/.test(r));
  if (passRow >= 0) {
    say("a passing check reads in Arabic", rendered.prose.includes("ناجح") && !latinIn(rendered.prose).includes("Pass"));
  } else {
    console.log("note: no «Pass» row in this page of the thread — nothing to compare");
  }

  const digitRow = rows.findIndex((r) => /(^|[^0-9])[0-9]{2,}([^0-9]|$)/.test(stripUrls(r)));
  if (digitRow >= 0) say("his numerals appear where the store keeps Latin ones", /[٠-٩]/.test(rendered.prose));

  rendered.firstBubbles.forEach((b) => console.log(`  bubble: ${b}`));
  await page.screenshot({ path: "scratch/owner-voice-phone.png" });
  console.log("screenshot: scratch/owner-voice-phone.png");

  const mark = consoleErrors.length;
  await page.waitForTimeout(9000);
  say("a whole poll cycle with no new console error", consoleErrors.length === mark, consoleErrors.slice(mark, mark + 2).join(" | "));
} catch (error) {
  say("the walk completed", false, String(error?.message || error).slice(0, 200));
} finally {
  await browser.close();
  if (failed) process.exitCode = 1;
}
