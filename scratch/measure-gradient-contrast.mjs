import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * The contrast axe could not decide, measured off the painted pixels.
 *
 * axe refuses ten nodes on the studio screen for one reason every time: "background color could not
 * be determined due to a background gradient". That is a limit of the tool, not a clean bill — and on
 * this site, where cards are painted with gradients over a dark canvas, the only honest reading is the
 * one taken from the pixels his phone actually renders.
 *
 * How it works: run axe, take every undecided contrast node with its text colour, font size and box;
 * screenshot the page; decode the PNG; inside each box sample a grid of pixels and take the darkest
 * half as the background (glyphs are a minority of the pixels in a line of small text); composite the
 * text colour's alpha over that background; then report the WCAG ratio against the floor that applies
 * to that size — 4.5 for normal text, 3.0 for large.
 *
 *   node scratch/measure-gradient-contrast.mjs
 */
const BASE = "https://azenith-living.vercel.app";
// Git Bash rewrites a leading-slash argument into a Windows path, so the screen comes from
// the environment, not argv.
const PATH = "/" + String(process.env.PATH_SCREEN ?? "admin/v2/ops").replace(/^\/+/, "");
// A violation is the same problem as an undecided node — the first the tool judged, the second it
// could not. Both are measured off the pixels here.
const KINDS = ["incomplete", "violations"];
const FLOOR_RULES = new Set(["color-contrast"]);
const axeSource = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const composite = (fg, bg) => ({
  r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
  g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
  b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)),
});
const luminance = ({ r, g, b }) => {
  const ch = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
const ratio = (a, b) => {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const p = await ctx.newPage();
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

await p.goto(`${BASE}${PATH}`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(12000);
await p.addScriptTag({ content: axeSource });

const nodes = await p.evaluate(async () => {
  const res = await window.axe.run(document, { resultTypes: ["incomplete", "violations"] });
  const wanted = ["color-contrast"];
  const groups = [...res.incomplete, ...res.violations].filter((v) => wanted.includes(v.id));
  const out = [];
  for (const n of groups.flatMap((g) => g.nodes)) {
    let el = null;
    try {
      el = document.querySelector(n.target.join(" "));
    } catch {
      el = null;
    }
    if (!el) continue;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    // The computed colour is often `oklch(...)` on this site's Tailwind build, which no rgb() regex
    // reads — and a colour that fails to parse silently becomes "no contrast at all". Resolve it by
    // painting the same colour over black and over white, which gives red, green, blue and alpha
    // back in plain numbers whatever the input syntax was.
    const resolve = (css) => {
      const c = document.createElement("canvas");
      c.width = 1;
      c.height = 1;
      const g = c.getContext("2d", { willReadFrequently: true });
      if (!g) return null;
      const paint = (back) => {
        g.globalCompositeOperation = "source-over";
        g.fillStyle = back;
        g.fillRect(0, 0, 1, 1);
        g.fillStyle = css;
        g.fillRect(0, 0, 1, 1);
        return [...g.getImageData(0, 0, 1, 1).data];
      };
      const onBlack = paint("#000000");
      const onWhite = paint("#ffffff");
      // Painting over black gives rgb·a, over white gives rgb·a + 255·(1−a) — so the difference
      // between the two is the transparent part, not the opaque one.
      const alpha = 1 - (onWhite[0] - onBlack[0]) / 255;
      if (alpha <= 0.01) return { r: 0, g: 0, b: 0, a: 0 };
      return { r: Math.round(onBlack[0] / alpha), g: Math.round(onBlack[1] / alpha), b: Math.round(onBlack[2] / alpha), a: alpha };
    };
    const ink = resolve(style.color);
    out.push({
      target: String(n.target[0]).slice(0, 60),
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
      color: style.color,
      ink,
      size: Number.parseFloat(style.fontSize),
      weight: Number(style.fontWeight) || 400,
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    });
  }
  return out;
});
console.log(`${PATH} · عقد تباين (محكوم + غير محكوم): ${nodes.length}`);

const shot = PNG.sync.read(await p.screenshot({ fullPage: true }));
const at = (x, y) => {
  const i = (shot.width * Math.round(y) + Math.round(x)) << 2;
  return { r: shot.data[i], g: shot.data[i + 1], b: shot.data[i + 2] };
};

let fails = 0;
for (const n of nodes) {
  const samples = [];
  for (let sy = n.y + 1; sy < n.y + n.h - 1; sy += 2) {
    for (let sx = n.x + 1; sx < n.x + n.w - 1; sx += 2) {
      if (sx < 0 || sy < 0 || sx >= shot.width || sy >= shot.height) continue;
      samples.push(at(sx, sy));
    }
  }
  if (samples.length < 4) {
    console.log(`  تخطي (صندوق صغير أو خارج الصفحة): ${n.target}`);
    continue;
  }
  // The darkest half is the card's own paint; the brighter pixels are the glyphs.
  const byLum = [...samples].sort((a, b) => luminance(a) - luminance(b));
  const background = byLum[Math.floor(byLum.length * 0.25)];
  const fg = n.ink && n.ink.a > 0 ? n.ink : null;
  if (!fg) {
    console.log(`  ما اتحلش اللون: ${n.target} — ${n.color}`);
    continue;
  }
  const ink = composite(fg, background);
  const value = ratio(ink, background);
  const large = n.size >= 18.66 || (n.size >= 14 && n.weight >= 700);
  const floor = large ? 3 : 4.5;
  const ok = value >= floor;
  if (!ok) fails += 1;
  console.log(
    `  ${ok ? "يقرا  " : "ما يقراش"} | ${value.toFixed(2)} مقابل ${floor} | ${n.size.toFixed(1)}pt وزن ${n.weight} | «${n.text}» | ${n.target}`,
  );
}
console.log(fails ? `\nنتيجة: ${fails} من ${nodes.length} سطر تحت الحد` : `\nنتيجة: كل الـ ${nodes.length} سطرين فوق الحدّ — الفاحص ما كانش قادر يحكم، البكسل حكم`);
await b.close();
