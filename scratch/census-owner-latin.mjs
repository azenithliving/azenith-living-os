import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * Every Latin token on every owner screen, counted from the screen itself.
 *
 * The rule is his: no machine identifier reaches his eyes. Two rounds of that rule were enforced by
 * grepping source strings, and the grep cannot see what a model wrote into a stored row, what a key
 * constant renders to, or what a component prints when the data is real. This measures the rendered
 * page instead: it walks the visible text of each owner screen and reports every Latin token with the
 * element and the sentence it sits in, so the next fix goes to the place that wrote it.
 *
 * Tokens are grouped, not just listed: an email or a phone number is a customer's own data and belongs
 * on the screen; `lead_list` and `OPS-LEAD` are machine names wearing a customer's clothes.
 *
 *   node scratch/census-owner-latin.mjs
 */
const BASE = "https://azenith-living.vercel.app";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const SCREENS = [
  "/admin",
  "/admin/v2",
  "/admin/v2/ops",
  "/admin/v2/sales",
  "/admin/v2/work",
  "/admin/v2/sketches",
  "/admin/v2/keys",
  "/admin/v2/agents/ops",
  "/admin/database",
  "/admin/agents",
];

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();

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

// The build marker is the repair itself: only the new naming module answers the sales employee in
// Arabic on the dashboard, and only the last commit stops the old house printing a row's key.
let live = false;
for (let attempt = 0; attempt < 30 && !live; attempt++) {
  await p.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(9000);
  const cleanDashboard = await p.evaluate(
    () => !/\bvanguard\b/i.test(document.body.innerText) && document.body.innerText.includes("تفاعلات المساعد"),
  );
  await p.goto(`${BASE}/admin/agents`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(9000);
  const cleanHouse = await p.evaluate(() => !/(^|[^-\w])(ops-lead|ops-visual|ops-content|VANGUARD|ANALYST)(?![\w-])/m.test(document.body.innerText));
  // The newest build also puts the owner-voice boundary on the task titles stored in the database,
  // so «Command: …» must have become his word for it.
  await p.goto(`${BASE}/admin/agents`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(6000);
  const spokenTitles = await p.evaluate(() => !/Command:/.test(document.body.innerText));
  live = cleanDashboard && cleanHouse && spokenTitles;
  console.log(`dashboard clean: ${cleanDashboard} · old house clean: ${cleanHouse} · titles spoken: ${spokenTitles} (attempt ${attempt + 1})`);
  if (!live) await p.waitForTimeout(20000);
}
if (!live) console.log("MARKER NEVER APPEARED — these numbers are the old build");

const totals = new Map();
const buckets = new Map();
const bucketOf = (text, words) => {
  const t = text.trim();
  if (/^\/[A-Za-z0-9\-_./]+$/.test(t) || /^https?:\/\//.test(t)) return "عنوان أو مسار موقع";
  if (t.includes("@") && /\./g.test(t)) return "إيميل عميل";
  if (/^(AIza|sk-|sk_|gsk_|tgp_|AQ\.)/.test(t)) return "مقدمة مفتاح";
  if (words.every((w) => /^[A-Za-z][A-Za-z0-9+.-]{2,}\.(com|ai|io|dev|net|org|google\.com)$|^[a-z0-9.-]+\.(com|ai|io|dev)$/.test(w))) return "عنوان مزود";
  return "كلمة إنجليزي في كلام منسوب للدار";
};
for (const path of SCREENS) {
  await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(9000);
  const ended = p.url().replace(BASE, "") || "/";
  const found = await p.evaluate(() => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.nodeValue ?? "").trim();
      if (text.length < 2) continue;
      const el = node.parentElement;
      if (!el) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const words = text.match(/[A-Za-z][A-Za-z0-9_./+-]{1,}/g) ?? [];
      if (!words.length) continue;
      out.push({
        words: [...new Set(words)].slice(0, 8),
        text: text.slice(0, 110),
        tag: el.tagName.toLowerCase(),
        cls: String(el.className ?? "").slice(0, 60),
      });
    }
    return out;
  });
  const flat = new Map();
  for (const row of found) for (const w of row.words) flat.set(w, (flat.get(w) ?? 0) + 1);
  for (const row of found) {
    const bucket = bucketOf(row.text, row.words);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + row.words.length);
  }
  for (const [w, n] of flat) totals.set(w, (totals.get(w) ?? 0) + n);
  console.log(`\n===== ${path} → ${ended}: ${found.length} سطر عليه لاتيني · ${flat.size} كلمة مختلفة =====`);
  for (const row of found.slice(0, 18)) {
    console.log(`  [${row.tag}.${row.cls}] ${JSON.stringify(row.words)}`);
    console.log(`      «${row.text}»`);
  }
  if (found.length > 18) console.log(`  … و${found.length - 18} سطر تاني`);
}

console.log("\n=== مواضع لكل نوع، بعد التلميح ===");
for (const [b, n] of [...buckets.entries()].sort((a, c) => c[1] - a[1])) console.log(`  ${String(n).padStart(4)} · ${b}`);

console.log("\n=== أكتر الكلمات اللاتينية تكرارًا على شاشات المالك ===");
for (const [w, n] of [...totals.entries()].sort((a, c) => c[1] - a[1]).slice(0, 45)) {
  console.log(`  ${String(n).padStart(4)} × ${w}`);
}
console.log(`\nشاشات: ${SCREENS.length} · كلمات لاتينية مختلفة: ${totals.size} · مجموع المواضع: ${[...totals.values()].reduce((a, c) => a + c, 0)}`);
await b.close();
