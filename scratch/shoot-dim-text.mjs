import { chromium } from "@playwright/test";

/**
 * Look at what the contrast fix changed: the footer's facts and the style chips.
 *
 * Raising a dim tone is only right if the page still reads as the store's own dark, warm look rather
 * than turning washed out. This photographs both at the owner's width and prints the colour each one
 * actually renders with, plus the measured ratio, so the judgement is made from the picture and the
 * number together.
 *
 *   node scratch/shoot-dim-text.mjs
 */
const BASE = "https://azenith-living.vercel.app";

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();

const measure = () => {
  const parse = (value) => {
    const m = String(value).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b2, a = 1] = m[1].split(",").map((x) => Number.parseFloat(x.trim()));
    return { r, g, b: b2, a };
  };
  const lum = ({ r, g, b: bl }) => {
    const lin = (c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl);
  };
  const hexToRgb = (hex) => {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
    const n = Number.parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  };
  const splitLayers = (image) => {
    const out = [];
    let depth = 0;
    let cur = "";
    for (const ch of image) {
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      if (ch === "," && depth === 0) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };
  const backOf = (el) => {
    let node = el;
    let acc = { r: 255, g: 255, b: 255, a: 1 };
    const stacks = [];
    while (node) {
      const style = getComputedStyle(node);
      const solid = parse(style.backgroundColor);
      const image = style.backgroundImage;
      if (image && image !== "none" && image.includes("gradient")) {
        let local = solid && solid.a > 0.9 ? solid : acc;
        for (const layer of splitLayers(image).reverse()) {
          for (const raw of layer.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/gi) ?? []) {
            const stop = raw.startsWith("#") ? hexToRgb(raw) : parse(raw);
            if (!stop) continue;
            const a = stop.a ?? 1;
            local = { r: stop.r * a + local.r * (1 - a), g: stop.g * a + local.g * (1 - a), b: stop.b * a + local.b * (1 - a), a: 1 };
          }
        }
        return local;
      }
      if (solid && solid.a > 0.9) return solid;
      node = node.parentElement;
      if (node) acc = solid && solid.a > 0.9 ? solid : acc;
    }
    void stacks;
    return acc;
  };

  const report = (el) => {
    const style = getComputedStyle(el);
    const fg = parse(style.color);
    const bg = backOf(el);
    if (!fg || !bg) return null;
    const l1 = lum(fg);
    const l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return {
      text: (el.textContent ?? "").trim().slice(0, 34),
      color: style.color,
      size: style.fontSize,
      ratio: Math.round(ratio * 100) / 100,
    };
  };

  const footer = document.querySelector("footer");
  const footerNodes = footer
    ? [...footer.querySelectorAll("h2, span, a, p")]
        .filter((el) => (el.textContent ?? "").trim().length > 2 && el.getBoundingClientRect().height > 4)
        .slice(0, 14)
        .map(report)
        .filter(Boolean)
    : [];

  const chips = [...document.querySelectorAll("button")]
    .filter((el) => /مودرن|كلاسيك|صناعي|سكاندينافي/.test(el.textContent ?? ""))
    .map(report)
    .filter(Boolean);

  return { footerNodes, chips };
};

await p.goto(`${BASE}/rooms/living-room`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(12000);
const roomFacts = await p.evaluate(measure);
const chipHandle = await p.evaluateHandle(() => [...document.querySelectorAll("button")].find((el) => /مودرن/.test(el.textContent ?? "")));
const chipEl = chipHandle.asElement();
if (chipEl) {
  await chipEl.scrollIntoViewIfNeeded();
  await p.waitForTimeout(900);
  const box = await chipEl.boundingBox();
  if (box) await p.screenshot({ path: "scratch/style-chips-390.png", clip: { x: Math.max(0, box.x - 120), y: box.y - 30, width: 390, height: 90 } });
}

await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(11000);
await p.evaluate(() => document.querySelector("footer")?.scrollIntoView({ block: "end" }));
await p.waitForTimeout(2500);
const homeFacts = await p.evaluate(measure);
const footerHandle = await p.evaluateHandle(() => document.querySelector("footer"));
const footerEl = footerHandle.asElement();
if (footerEl) {
  await footerEl.screenshot({ path: "scratch/footer-390.png" });
}

console.log("## شيبات الطرازات (صفحة الغرفة)");
for (const row of roomFacts.chips) console.log(`  ${String(row.ratio).padStart(6)}:1 · ${row.size} · ${row.color} · «${row.text}»`);
console.log("\n## الفوتر (الواجهة)");
for (const row of homeFacts.footerNodes) console.log(`  ${String(row.ratio).padStart(6)}:1 · ${row.size} · ${row.color} · «${row.text}»`);
console.log("\nصور: scratch/style-chips-390.png · scratch/footer-390.png");

await b.close();
