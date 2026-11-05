/**
 * Is the cockpit actually the owner's front door now, on his phone?
 *   node scratch/check-cockpit-v2.mjs [base]
 *
 * Signs in as the store's own admin, opens the new house's overview at 390px, and reads back
 * what is on it: the store's pulse, one card per employee who exists, the department headings,
 * and whether any page still says its content is coming later. Then it opens the menu the way a
 * phone does with a thumb, takes the two sidebar doors, and follows one card into the chat.
 *
 * Credentials are read from the environment and never printed.
 */
import fs from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.argv[2] || "http://localhost:3222";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const SHELL = /سيُنقل|على نظيف|فاضية/;

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();

try {
  await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL.trim());
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD.trim());
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3500);
  if ((await page.evaluate(() => document.body.innerText)).includes("التحقق بخطوتين")) {
    const speakeasy = (await import("speakeasy")).default;
    const code = speakeasy.totp({ secret: env.ADMIN_GATE_2FA_SECRET.trim().toUpperCase(), encoding: "base32" });
    await page.locator('input:not([type="hidden"])').last().fill(code);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
  }

  await page.goto(`${BASE}/admin/v2`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-employee-card]", { timeout: 60000 });
  await page.waitForTimeout(4000);

  const canvas = await page.evaluate(() => {
    const shellPattern = /سيُنقل|على نظيف|فاضية/;
    const pulse = [...document.querySelectorAll('[aria-label="نبض المتجر"] div.grid > div')].map((n) =>
      n.innerText.replace(/\s+/g, " ").trim()
    );
    return {
      heading: document.querySelector("h1")?.innerText.trim(),
      departments: [...document.querySelectorAll("h2")].map((n) => n.innerText.trim()),
      cards: [...document.querySelectorAll("[data-employee-card]")].map((n) => n.getAttribute("data-employee-card")),
      cardNames: [...document.querySelectorAll("[data-employee-card] h3")].map((n) => n.innerText.trim()),
      pulse,
      shell: shellPattern.test(document.body.innerText),
      shellLine: (document.body.innerText.match(/.{0,40}(سيُنقل|على نظيف|فاضية).{0,40}/) || [""])[0],
      doorsInSidebar: !!document.querySelector("[data-cockpit-doors]"),
    };
  });
  console.log(`h1                     : ${canvas.heading}`);
  console.log(`departments on canvas  : ${canvas.departments.length} · ${canvas.departments.join(" / ")}`);
  console.log(`employee cards         : ${canvas.cards.length} · ${canvas.cardNames.join(" | ")}`);
  console.log(`pulse                  : ${canvas.pulse.join(" || ")}`);
  console.log(`shell sentence present : ${canvas.shell ? "YES → " + canvas.shellLine : "no"}`);
  console.log(`sidebar doors in DOM   : ${canvas.doorsInSidebar}`);
  await page.screenshot({ path: "scratch/cockpit-v2-canvas.png", fullPage: true });

  const burger = page.locator("button.lg\\:hidden, [aria-label*=\"القائمة\"], header button").first();
  await burger.click();
  await page.waitForTimeout(1500);
  const drawer = await page.evaluate(() => {
    const doors = document.querySelector("[data-cockpit-doors]");
    return {
      doorsVisible: !!doors && doors.getBoundingClientRect().width > 0,
      doorLines: doors ? doors.innerText.replace(/\s+/g, " ").trim().slice(0, 160) : "",
    };
  });
  console.log(`thumb menu → doors     : ${drawer.doorsVisible ? "open" : "NOT VISIBLE"} · ${drawer.doorLines}`);
  await page.screenshot({ path: "scratch/cockpit-v2-sidebar.png" });

  await page.goto(`${BASE}/admin/v2`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-employee-card]", { timeout: 60000 });
  await page.locator("[data-employee-card]").first().click();
  await page.waitForTimeout(6000);
  const chat = await page.evaluate(() => {
    const seen = (sel) => {
      const n = document.querySelector(sel);
      return !!n && n.getBoundingClientRect().width > 0;
    };
    const thread = document.querySelector("[data-thread-area]");
    return {
      url: location.pathname + location.search,
      composer: seen("[data-chat-composer]"),
      header: seen("[data-chat-header]"),
      thread: !!thread,
      turns: thread ? thread.querySelectorAll("p, li").length : 0,
      actionsDrawer: seen("[data-actions-toggle]"),
      decisionsDoor: seen("[data-decisions-toggle]"),
    };
  });
  console.log(`card tap lands         : ${chat.url}`);
  console.log(`chat surface           : header=${chat.header} composer=${chat.composer} thread=${chat.thread} turns=${chat.turns}`);
  console.log(`in-chat doors          : quick actions=${chat.actionsDrawer} decisions=${chat.decisionsDoor}`);
  await page.screenshot({ path: "scratch/cockpit-v2-chat.png" });

  for (const section of ["work", "system", "database", "elite", "owner-dashboard"]) {
    await page.goto(`${BASE}/admin/v2/${section}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2000);
    const read = await page.evaluate(() => ({
      h1: document.querySelector("h1")?.innerText.trim(),
      body: document.body.innerText.replace(/\s+/g, " ").trim(),
      links: [...document.querySelectorAll("a[href^='/admin']")].map((a) => a.getAttribute("href")),
    }));
    const shellHit = SHELL.test(read.body);
    const dead = [];
    for (const href of read.links) {
      const res = await page.evaluate(async (h) => {
        const r = await fetch(h, { method: "GET" });
        return r.status;
      }, href);
      if (res >= 400) dead.push(`${href}=${res}`);
    }
    console.log(`/${section.padEnd(15)} h1=${read.h1} shell=${shellHit ? "YES" : "no"} doors=${read.links.length} dead=${dead.join(",") || "—"}`);
    console.log(`   ${read.body.slice(0, 150)}`);
  }
  await page.goto(`${BASE}/admin/v2/work`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "scratch/cockpit-v2-section.png" });
} catch (err) {
  console.log("FAILED", String(err.message || err).slice(0, 240));
} finally {
  await browser.close();
}
