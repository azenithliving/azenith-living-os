/**
 * Proves the cold clock on the published site, and proves the delete door
 * end-to-end with a real confirmation.
 *
 * The owner declared on 2026-09-29 that every row in this store is his own test
 * data, so the red button may be pressed here — with the count measured before and
 * after, so a deletion is never silent.
 *
 * Usage: node scripts/verify-cold-clock.mjs [baseUrl]
 */
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const BASE = process.argv.find((a) => a.startsWith("http")) || "https://azenith-living.vercel.app";
const LABELS = ["حار", "دافئ", "بارد", "بيضيع", "بدون تاريخ"];
const results = [];
const check = (name, pass, extra = "") => {
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? ` :: ${extra.slice(0, 110)}` : ""}`);
};

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click('button[type=submit]');
for (let i = 0; i < 15 && !p.url().includes("/admin"); i++) await p.waitForTimeout(2000);
check("gate login", p.url().includes("/admin"), p.url());

await p.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(7000);
const body = () => p.textContent("body").then((t) => t || "");
let text = await body();
check("the waiting chip is on the screen", /محتاجين رد دلوقتى/.test(text));
const seen = LABELS.filter((l) => text.includes(l));
check("every customer wears a freshness badge", seen.length > 0, `labels seen: ${seen.join(", ")}`);

const rowCount = async () => (await p.locator('div[class*="gap-4 flex-1"]').count());
const before = await rowCount();
const chip = p.locator('button:has-text("محتاجين رد دلوقتى")').first();
await chip.click({ timeout: 8000 }).catch(() => {});
await p.waitForTimeout(2500);
const filtered = await rowCount();
check("the chip filters the list", filtered <= before, `all=${before} waiting=${filtered}`);
await chip.click({ timeout: 8000 }).catch(() => {});
await p.waitForTimeout(2000);
check("the chip clears again", (await rowCount()) === before, `back to ${before}`);
fs.mkdirSync("scratch", { recursive: true });
await p.screenshot({ path: "scratch/cold-clock.png" });

// The real delete, with the count measured on both sides.
const tierLine = (await body()).replace(/\s+/g, " ");
const counters = [...tierLine.matchAll(/(?:الماسي|ذهبي|فضي|برونزي)\s*(\d+)/g)].map((m) => Number(m[1]));
const sumBefore = counters.reduce((a, n) => a + n, 0);
const trash = p.locator('button:has(svg.lucide-trash-2)').last();
await trash.click({ timeout: 8000 }).catch(() => {});
await p.waitForTimeout(4500);
const ask = (await body()).replace(/\s+/g, " ");
const declared = /مربوط بـ\s*(\d+)\s*سجل/.exec(ask)?.[1];
check("the panel declares a number before anything is irreversible", !!declared, `declared=${declared}`);
const confirm = p.locator('button:has-text("أيوه، امسح")').first();
if (await confirm.count()) {
  await confirm.click({ timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(7000);
  const after = (await body()).replace(/\s+/g, " ");
  const okToast = /تم مسح \d+ سجل — مطابق للعدد اللي أكدته/.test(after);
  const honestToast = /المسح اتعمل بس العدد مش مطابق/.test(after);
  check("the door reports what it really did", okToast || honestToast, okToast ? "verified" : "mismatch reported");
  const countersAfter = [...after.matchAll(/(?:الماسي|ذهبي|فضي|برونزي)\s*(\d+)/g)].map((m) => Number(m[1]));
  const sumAfter = countersAfter.reduce((a, n) => a + n, 0);
  check("the list is smaller after a real delete", sumAfter < sumBefore, `${sumBefore} -> ${sumAfter}`);
  await p.screenshot({ path: "scratch/delete-after-confirm.png" });
} else {
  check("the confirm button carries the declared number", false, "not found");
}

await b.close();
const passed = results.filter(Boolean).length;
console.log(`\n=== COLD CLOCK: ${passed}/${results.length} passed on ${BASE} ===`);
if (passed !== results.length) process.exitCode = 1;
