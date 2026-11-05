import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * Does he still read the buried name when he scrolls his own chat?
 *
 * The claim being measured is about stored history, so the proof has to be a rendered history row: the
 * cockpit chat, at his width, on the published site. The build marker is the repair itself — the drafts
 * list that used to read «— —» now carries the kind's Arabic name, and only the new build can produce
 * it from the same stored row.
 *
 *   node scratch/prove-history-scrub-live.mjs
 */
const BASE = "https://azenith-living.vercel.app";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const CHATS = ["/admin/v2/agents/ops", "/admin/v2/ops", "/admin/agents", "/admin/v2/sales"];

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
const consoleErrors = [];
p.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 140)));

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

let live = false;
for (let attempt = 0; attempt < 30 && !live; attempt++) {
  await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(9000);
  live = await p.evaluate(() => !/قيّم الدار|قيم الدار/.test(document.body.innerText));
  console.log(live ? "new build live (no retired name in the chat)" : `waiting for the new build (attempt ${attempt + 1})`);
  if (!live) await p.waitForTimeout(20000);
}

let retired = 0;
let draftNamed = 0;
for (const path of CHATS) {
  await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(9000);
  const seen = await p.evaluate(() => {
    const text = document.body.innerText;
    return {
      retired: (text.match(/قيّم الدار|قيم الدار/g) ?? []).length,
      emptyKind: /—\s*—/.test(text),
      namedKind: /تنظيم المعرض|تصحيح الصورة|تصحيح الهوية/.test(text),
    };
  });
  retired += seen.retired;
  if (seen.namedKind) draftNamed += 1;
  console.log(`  ${path}: الاسم المتقاعد ${seen.retired} · نوع المسودة مسمّى: ${seen.namedKind} · فاصل فاضي: ${seen.emptyKind}`);
}

await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
await p.waitForTimeout(6000);
await p.screenshot({ path: "scratch/history-scrub-390.png" });

console.log(`\nمجموع الاسم المتقاعد على أربع شاشات محادثة: ${retired}`);
console.log(`شاشات فيها نوع مسودة مسمّى بالعربي: ${draftNamed}`);
console.log(`خطأ كونسول: ${consoleErrors.length}`);
console.log("لقطة: scratch/history-scrub-390.png");
await b.close();
