import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

/**
 * a11y-gradient-contrast.mjs — the ten cockpit places axe could not decide, measured instead of assumed.
 *
 * axe refuses to judge text over a gradient, and this store's dashboard is built on gradients, so an
 * «undecided» node is a blank box, not a pass. The measurement here is a real one:
 *   1. read the text's own computed colour and font size/weight from the live page;
 *   2. screenshot the element's box while its text is hidden — that picture IS the composited background,
 *      gradient, overlays and alpha included;
 *   3. decode the picture inside the browser and compute WCAG contrast for every pixel;
 *   4. report the WORST pixel, because a label that is unreadable on one corner is unreadable.
 *
 *   node scratch/a11y-gradient-contrast.mjs
 */
const BASE = "https://azenith-living.vercel.app";
const axeSource = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const SCREENS = ["/admin/v2/ops", "/admin/v2/agents/ops"];
const AA_NORMAL = 4.5;
const AA_LARGE = 3;

const b = await chromium.launch({ headless: true });
const seed = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
await seed.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await seed.waitForTimeout(4000);
await seed.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await seed.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await seed.click("button[type=submit]");
for (let i = 0; i < 20 && !seed.url().includes("/admin"); i++) await seed.waitForTimeout(2000);
if (seed.url().includes("/gate/login")) {
  await seed.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
  const { default: speakeasy } = await import("speakeasy");
  const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
  await seed.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
  await seed.click("button[type=submit]");
  for (let i = 0; i < 20 && !seed.url().includes("/admin"); i++) await seed.waitForTimeout(2000);
}
const state = await seed.context().storageState();
await b.close();

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: state, viewport: { width: 390, height: 900 }, locale: "ar-EG" });

const results = [];
for (const path of SCREENS) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(9000);
  await p.addScriptTag({ content: axeSource });
  const found = await p.evaluate(async () => {
    const res = await window.axe.run(document, { resultTypes: ["incomplete"] });
    const out = [];
    let n = 0;
    for (const rule of res.incomplete) {
      if (rule.id !== "color-contrast") continue;
      for (const node of rule.nodes) {
        const el = document.querySelector(node.target.join(" "));
        if (!el) continue;
        // Tag the exact node axe flagged: a class selector can match a twin elsewhere, and then the
        // probe photographs the wrong card and reports it as the right one.
        const probeId = "a11y-probe-" + n++;
        el.dataset.a11yProbeId = probeId;
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        out.push({
          selector: '[data-a11y-probe-id="' + probeId + '"]',
          asWritten: node.target.join(" "),
          color: cs.color,
          fontSize: parseFloat(cs.fontSize),
          fontWeight: cs.fontWeight,
          text: (el.textContent || "").trim().slice(0, 40),
          box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        });
      }
    }
    return out;
  });

  for (const item of found) {
    if (item.box.width < 2 || item.box.height < 2) continue;
    // A clip outside the viewport photographs blank white, and white-on-white reads as a perfect
    // contrast failure. Bring the node in front of the lens and take its box again, after the scroll.
    const box = await p.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }, item.selector);
    if (!box || box.width < 2 || box.height < 2) continue;
    await p.waitForTimeout(350);
    const clip = {
      x: Math.max(0, Math.round(box.x)),
      y: Math.max(0, Math.round(box.y)),
      width: Math.min(390 - Math.max(0, Math.round(box.x)), Math.round(box.width)),
      height: Math.round(box.height),
    };
    if (clip.width < 2 || clip.height < 2) continue;

    // Hide the node's text AND every descendant's: a child span carrying its own colour class survives
    // a change to the parent, and then the darkest pixel measured is a glyph, not the canvas behind it.
    const hideRule = item.selector + ", " + item.selector + " * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }";
    const styleHandle = await p.evaluateHandle((css) => {
      const tag = document.createElement("style");
      tag.dataset.a11yProbe = "1";
      tag.textContent = css;
      document.head.appendChild(tag);
      return tag;
    }, hideRule);
    await p.waitForTimeout(250);
    const shot = await p.screenshot({ clip });
    await p.evaluate((tag) => tag.remove(), styleHandle);
    const shotWithText = await p.screenshot({ clip });
    const visible = await p.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return "مفيش عقدة";
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return "مقفولة";
      if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return "بره الشاشة";
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit || !el.contains(hit)) return "مستورة تحت غيرها";
      return "ظاهرة";
    }, item.selector);
    if (shot.equals(shotWithText)) {
      console.log(`${path} · ${item.asWritten.slice(0, 44)} · ${visible === "ظاهرة" ? "المقياس مرفوض: إخفاء النص ما غيّر الصورة" : "مش محسوبة: " + visible}`);
      continue;
    }

    const judged = await p.evaluate(
      async ({ png, color, fontSize, fontWeight, need }) => {
        const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const c2d = canvas.getContext("2d", { willReadFrequently: true });
        c2d.drawImage(bitmap, 0, 0);
        const data = c2d.getImageData(0, 0, canvas.width, canvas.height).data;
        const lum = (r, g, b2) => {
          const f = (v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b2);
        };
        // Tailwind v4 hands back `oklab(...)`/`oklch(...)`, so a digit-scan of the string is not a
        // colour. The browser itself resolves any CSS colour when it paints — ask it instead.
        const resolve = (c) => {
          const cv = document.createElement("canvas");
          cv.width = cv.height = 1;
          const x = cv.getContext("2d", { willReadFrequently: true });
          x.clearRect(0, 0, 1, 1);
          x.fillStyle = c;
          x.fillRect(0, 0, 1, 1);
          const d = x.getImageData(0, 0, 1, 1).data;
          return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
        };
        const text = resolve(color);
        let worst = Infinity;
        let worstPixel = null;
        for (let i = 0; i < data.length; i += 4) {
          const pa = data[i + 3] / 255;
          // The screenshot is composited over white by the browser when alpha < 1; flatten it first.
          const br = data[i] * pa + 255 * (1 - pa);
          const bg = data[i + 1] * pa + 255 * (1 - pa);
          const bb = data[i + 2] * pa + 255 * (1 - pa);
          // Then lay the text on top of that pixel, because its own alpha is part of the reading.
          const fr = text.r * text.a + br * (1 - text.a);
          const fg = text.g * text.a + bg * (1 - text.a);
          const fb = text.b * text.a + bb * (1 - text.a);
          const bgL = lum(br, bg, bb);
          const fgL = lum(fr, fg, fb);
          const ratio = (Math.max(fgL, bgL) + 0.05) / (Math.min(fgL, bgL) + 0.05);
          if (ratio < worst) {
            worst = ratio;
            worstPixel = [Math.round(br), Math.round(bg), Math.round(bb)];
          }
        }
        const large = fontSize >= 24 || (fontSize >= 18.66 && Number(fontWeight) >= 700);
        return { worst, need, large, worstPixel, textRgb: [text.r, text.g, text.b, +text.a.toFixed(2)], pixels: data.length / 4 };
      },
      { png: shot.toString("base64"), color: item.color, fontSize: item.fontSize, fontWeight: item.fontWeight, need: item.fontSize >= 24 || (item.fontSize >= 18.66 && Number(item.fontWeight) >= 700) ? AA_LARGE : AA_NORMAL }
    );

    results.push({ path, ...item, ...judged });
    console.log(
      `${path} · ${item.selector.slice(0, 46)} · خط ${item.fontSize}px/${item.fontWeight} · أسوأ تباين ${judged.worst.toFixed(2)} مقابل المطلوب ${judged.need} · ${judged.worst >= judged.need ? "مقبول" : "مرفوض"} · أغمق بكسل ${JSON.stringify(judged.worstPixel)} · خط ${JSON.stringify(judged.textRgb)} · بكسلات ${judged.pixels}`
    );
  }
  await p.close();
}

await browser.close();

const failing = results.filter((r) => r.worst < r.need);
console.log(`\nمقاس: ${results.length} موضع · مقبول ${results.length - failing.length} · مرفوض ${failing.length}`);
for (const f of failing) console.log(`مرفوض: ${f.path} :: ${f.selector} :: ${f.worst.toFixed(2)} < ${f.need}`);
console.log(JSON.stringify(results.map((r) => ({ path: r.path, selector: r.selector, worst: +r.worst.toFixed(2), need: r.need, ok: r.worst >= r.need })), null, 1));
