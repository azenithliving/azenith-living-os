import { chromium } from "@playwright/test";
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const logs = [];
p.on("console", (m) => { if (m.type() === "error") logs.push(m.text().slice(0, 120)); });
p.on("pageerror", (e) => logs.push("pageerror: " + String(e).slice(0, 120)));
await p.goto("https://azenith-living.vercel.app/rooms/living-room", { waitUntil: "networkidle", timeout: 120000 });
await p.waitForFunction(() => [...document.querySelectorAll("button")].some((x) => x.textContent?.includes("أعجبني")), null, { timeout: 90000 });
const state = await p.evaluate(() => {
  const btns = [...document.querySelectorAll("button")].filter((x) => x.textContent?.includes("أعجبني"));
  const imgs = [...document.querySelectorAll("img")].map((i) => i.currentSrc || i.src).filter(Boolean);
  return { likes: btns.length, images: imgs.length, firstImage: (imgs[0] ?? "").slice(0, 60) };
});
console.log("state:", JSON.stringify(state));
await p.locator("button", { hasText: "أعجبني" }).first().click();
await p.waitForTimeout(9000);
const after = await p.evaluate(() => ({
  modal: [...document.querySelectorAll("div")].some((d) => String(d.className).includes("fixed") && d.querySelector("img") && d.innerText.length > 20),
  text: ([...document.querySelectorAll("div")].find((d) => String(d.className).includes("fixed") && d.querySelector("img"))?.innerText ?? "").replace(/\s+/g, " ").slice(0, 160),
}));
console.log("after click:", JSON.stringify(after));
console.log("console errors:", JSON.stringify(logs.slice(0, 5)));
await b.close();
