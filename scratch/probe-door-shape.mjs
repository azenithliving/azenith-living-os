import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();
await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(4000);
await page.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await page.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await page.click("button[type=submit]");
for (let i = 0; i < 25 && !page.url().includes("/admin"); i++) await page.waitForTimeout(2000);

const res = await page.request.post(`${BASE}/api/admin/agent/tools/execute`, {
  data: { toolName: "backup_restore", params: { backupId: "latest", confirmRestore: false } },
  headers: { "content-type": "application/json" },
  timeout: 180000,
});
const body = await res.json().catch(() => null);
console.log("حالة الرد: " + res.status());
console.log("الرد: " + JSON.stringify(body).slice(0, 400));
await browser.close();
