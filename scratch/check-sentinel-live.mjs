import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import speakeasy from "speakeasy";

/**
 * Live read of the health door on the published site: what does the watcher actually answer,
 * and does any English survive in the sentences it returns? Also counts the alerts it reports —
 * the number is the finding, not the wording.
 *   node scratch/check-sentinel-live.mjs
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
p.on("console", (m) => m.type() === "error" && !/ERR_FAILED|Failed to load/i.test(m.text()) && errors.push(m.text().slice(0, 70)));

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

// Three separate requests, because the store is in memory: if the same instance answers,
// the count should hold; across instances it cannot.
const reads = [];
for (let i = 0; i < 3; i++) {
  const out = await p.evaluate(async () => {
    const res = await fetch("/api/system-health", { cache: "no-store" });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* keep the raw text */
    }
    return { status: res.status, json, raw: text.slice(0, 160) };
  });
  reads.push(out);
  await p.waitForTimeout(2500);
}

for (const [i, r] of reads.entries()) {
  const body = r.json ?? {};
  const alerts = body.alerts ?? body.health?.alerts ?? [];
  const recs = body.recommendations ?? body.health?.recommendations ?? [];
  const sentences = [...(alerts ?? []).flatMap((a) => [a.problem, a.rootCause, a.proposedFix]), ...(recs ?? [])].filter(Boolean);
  const latin = sentences.filter((s) => /[A-Za-z]{3,}/.test(String(s)));
  console.log(
    `قراية ${i + 1}: حالة ${r.status} · تنبيهات ${Array.isArray(alerts) ? alerts.length : "?"} · توصيات ${
      Array.isArray(recs) ? recs.length : "?"
    } · جُمل إنجليزية ${latin.length}`
  );
  if (Array.isArray(recs) && recs.length) console.log(`   توصيات: ${recs.map((x) => `«${x}»`).join(" | ")}`);
  if (!r.json) console.log(`   الرد مش JSON: ${r.raw}`);
}

await p.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(14000);
const card = await p.evaluate(() => {
  const text = document.body.innerText;
  const hit = text.match(/[^\n]*(صحة النظام|حالة النظام|الصحة العامة)[^\n]*/i);
  return { line: hit ? hit[0].trim().slice(0, 120) : null, hasEnglishAlert: /may be rate-limited|Manual investigation|External API error/i.test(text) };
});
console.log(`\nكارت الصحة على شاشة الإدارة: ${card.line ? `«${card.line}»` : "مش لاقي كارت"}`);
console.log(`أي جُملة إنجليزية قديمة على الشاشة؟ ${card.hasEnglishAlert ? "أيوه — ده الغلط" : "لأ"}`);
await p.screenshot({ path: "scratch/sentinel-admin.png" });
console.log(`أخطاء الكنسول: ${errors.length}${errors.length ? " — " + errors.slice(0, 2).join(" || ") : ""}`);
await b.close();
