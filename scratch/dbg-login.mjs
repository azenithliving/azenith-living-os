import fs from "node:fs";
import { chromium } from "@playwright/test";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
p.on("console", (m) => { if (m.type() === "error") console.log("console error:", m.text().slice(0, 200)); });
p.on("pageerror", (e) => console.log("page error:", String(e.message).slice(0, 200)));
await p.goto(process.argv[2] + "/gate/login", { waitUntil: "networkidle", timeout: 120000 });
await p.waitForSelector('input[type="email"]', { timeout: 60000 });
await p.waitForTimeout(6000);
console.log("hydrated:", JSON.stringify(await p.evaluate(() => {
  const i = document.querySelector('input[name="gate-email"]');
  return { reactKeys: Object.keys(i ?? {}).filter((k) => k.startsWith("__react")).length, hasReact: typeof window.React !== "undefined" };
})));
console.log("inputs:", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll("input")].map((i) => ({ type: i.type, id: i.id, name: i.name })))));
await p.locator('input[type="email"]').click();
await p.keyboard.type(env.ADMIN_GATE_EMAIL.trim(), { delay: 25 });
await p.locator('input[type="password"]').click();
await p.keyboard.type(env.ADMIN_GATE_PASSWORD.trim(), { delay: 25 });
await p.waitForTimeout(1500);
console.log(
  "button disabled:",
  await p.evaluate(() => document.querySelector('button[type="submit"]')?.disabled),
  "values:",
  JSON.stringify(await p.evaluate(() => [...document.querySelectorAll("input")].map((i) => i.value.length)))
);
await b.close();
