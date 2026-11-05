import fs from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * The live proof the render pass cannot give: does the employee ANSWER in Arabic by itself?
 *   node scratch/check-live-report-arabic.mjs [base]
 *
 * Two real questions are asked in his own chat on the published site, and the reply is judged as it
 * is STORED — before the screen's voice pass gets a chance to clean it. That is the honest stage:
 * if the desks and the prompt rule worked, the model has no English to echo in the first place.
 * The rows stay in his thread as evidence, on his word.
 */
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const AGENT = "ops-lead";
const QUESTIONS = process.argv.slice(3).length ? process.argv.slice(3) : ["وريني عالم الدار", "اعرض المسودات المعلقة"];
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

const proseOf = (s) =>
  String(s)
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/(^|\s)\/[A-Za-z0-9\-_./#%]{2,}/g, " ")
    .replace(/`[^`]*`/g, " ");
const latinIn = (s) => (proseOf(s).match(/[A-Za-z]{2,}/g) ?? []);

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" })).newPage();
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 140));
});

const ask = async (text) => {
  const t0 = Date.now();
  const sent = await page.evaluate((message) => {
    if (typeof window.__opsSend !== "function") return false;
    window.__opsSend(message);
    return true;
  }, text);
  if (!sent) throw new Error("window.__opsSend is not on the page — the chat has no send handle");
  console.log(`sent «${text}»`);

  for (let i = 0; i < 48; i += 1) {
    await page.waitForTimeout(5000);
    const rows = await page.evaluate(async ([agent, since]) => {
      const res = await fetch(`/api/admin/agents/messages?agent_key=${agent}`);
      const data = await res.json();
      return (data?.data || [])
        .filter((m) => m.sender_type === "agent" && new Date(m.created_at).getTime() > since)
        .map((m) => ({ at: m.created_at, tool: m.context?.tool || null, content: String(m.content || "") }));
    }, [AGENT, t0]);
    const newest = rows[rows.length - 1];
    if (newest && newest.content.trim().length > 40) {
      console.log(`  answered after ~${(i + 1) * 5}s (tool=${newest.tool ?? "بدون أداة"}), ${newest.content.length} char`);
      return newest;
    }
  }
  return null;
};

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

  for (const question of QUESTIONS) {
    const answer = await ask(question);
    if (!answer) {
      say(`«${question}» got an answer`, false, "no agent row appeared in four minutes");
      continue;
    }
    const latin = latinIn(answer.content);
    console.log(`\n── ردّ حيّ (مخزّن، قبل طبقة الصوت) ──\n${answer.content.slice(0, 700)}`);
    say(`the stored answer carries no Latin prose`, latin.length === 0, latin.slice(0, 12).join(", ") || "0 كلمة");
    say(`the retired name is absent`, !/qayyim/i.test(answer.content));
    say(`the answer came out of a desk, not out of prose`, Boolean(answer.tool), `tool=${answer.tool ?? "بدون أداة"}`);
  }

  await page.waitForTimeout(4000);
  const rendered = await page.evaluate(() => {
    const area = document.querySelector("[data-thread-area]");
    if (!area) return "";
    const kids = [...area.querySelectorAll("[data-thread-area] > div")];
    return kids.slice(-4).map((k) => k.textContent || "").join("\n");
  });
  console.log(`\n── آخر أربع فقاعات كما تُرسم ──\n${rendered.slice(0, 700)}`);
  await page.screenshot({ path: "scratch/live-report-arabic-phone.png" });
  console.log("screenshot: scratch/live-report-arabic-phone.png");
  say("his numerals in what is drawn", /[٠-٩]/.test(rendered));
  const mark = consoleErrors.length;
  await page.waitForTimeout(9000);
  say("a whole poll cycle with no new console error", consoleErrors.length === mark, consoleErrors.slice(mark, mark + 2).join(" | "));
} catch (error) {
  say("the walk completed", false, String(error?.message || error).slice(0, 200));
} finally {
  await browser.close();
  if (failed) process.exitCode = 1;
}
