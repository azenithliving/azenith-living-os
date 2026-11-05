import fs from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * Who is still writing English on his screen.
 *   node scratch/census-residue.mjs [base] [agent]
 *
 * The render pass took 159 Latin words down to 40. Before fixing anything this prints every word
 * that survived, with the sentence it lives in, so each one gets attributed: a checker answering in
 * English, a site slug from the store's own data, or the model's own prose.
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

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" })).newPage();
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

  await page.goto(`${BASE}/admin/v2/agents/ops?agent=${AGENT}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(11000);

  const rows = await page.evaluate(async (agent) => {
    const res = await fetch(`/api/admin/agents/messages?agent_key=${agent}`);
    const data = await res.json();
    return (data?.data || [])
      .filter((m) => m.sender_type === "agent")
      .map((m) => ({ at: m.created_at, tool: m.context?.tool || null, content: String(m.content || "") }));
  }, AGENT);

  const strip = (s) => s.replace(/https?:\/\/\S+/g, " ").replace(/\/[A-Za-z0-9\-_./]{4,}/g, " ").replace(/`[^`]*`/g, " ");
  // Only the words the published screen still shows (measured by check-owner-voice-live.mjs).
  const SURVIVORS = new Set(["Keyboard", "Navigation", "Verified", "Contrast", "Ratio", "normal", "VIP", "image", "fix", "kitchens", "curate", "gallery", "identity", "hero", "text", "gscqueries", "draftlist", "confirmed"]);
  let shown = 0;
  for (const row of rows) {
    const free = strip(row.content);
    const hits = [...free.matchAll(/[A-Za-z][A-Za-z0-9'’-]{2,}/g)].filter((h) => SURVIVORS.has(h[0]));
    if (!hits.length) continue;
    shown += 1;
    const words = hits.map((h) => h[0]);
    const sample = hits.slice(0, 5).map((h) => free.slice(Math.max(0, h.index - 55), h.index + h[0].length + 35).replace(/\s+/g, " ").trim());
    console.log(`\n[${row.at}] tool=${row.tool ?? "بدون أداة"} · ${words.length} كلمة: ${[...new Set(words)].slice(0, 14).join(", ")}`);
    for (const s of sample) console.log(`    …${s}…`);
  }
  console.log(`\nrows ${rows.length} · rows carrying a survivor ${shown}`);
} finally {
  await browser.close();
}
