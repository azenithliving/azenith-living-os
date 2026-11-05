import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * The accessibility number the owner asked for, measured on the published site.
 *
 * He asked when the store becomes "AAA" with no defects left. Nobody can answer that without measuring,
 * and nothing about it has ever been measured here. So: axe-core (already a development dependency of
 * this repository, injected at run time — nothing of it ships to a visitor) audits every page it can
 * reach at the width he browses at, and a second pass computes text contrast itself, because the AAA
 * bar (7 to 1 for ordinary text) is stricter than the check axe reports.
 *
 *   node scratch/measure-accessibility.mjs
 */
const BASE = "https://azenith-living.vercel.app";
const axeSource = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const PAGES = [
  { path: "/", label: "الواجهة", admin: false },
  { path: "/rooms/living-room", label: "غرفة معيشة", admin: false },
  { path: "/request", label: "طلب العميل", admin: false },
  { path: "/terms", label: "الشروط", admin: false },
  { path: "/admin/v2/ops", label: "كابينة القائد", admin: true },
  { path: "/admin/database", label: "حالة النظام", admin: true },
];

/**
 * Contrast, computed here rather than trusted to a rule: every visible text node, its own colour over
 * the first non-transparent background behind it, measured against both bars — 4.5 (the usual one) and
 * 7 (the one he asked for).
 */
const CONTRAST_PROBE = () => {
  const parse = (value) => {
    const m = String(value).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(",").map((p) => Number.parseFloat(p.trim()));
    const [r, g, b, a = 1] = parts;
    return { r, g, b, a };
  };
  const lum = ([r, g, b]) => {
    const lin = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const blend = (fg, bg) => {
    const a = fg.a ?? 1;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
  };
  const ratio = (fg, bg) => {
    const l1 = lum([fg.r, fg.g, fg.b]);
    const l2 = lum([bg.r, bg.g, bg.b]);
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
  };
  const hexToRgb = (hex) => {
    const h = String(hex).replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = Number.parseInt(full.slice(0, 6), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  };

  const splitLayers = (image) => {
    const out = [];
    let depth = 0;
    let current = "";
    for (const ch of image) {
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      if (ch === "," && depth === 0) {
        out.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) out.push(current.trim());
    return out;
  };

  const stopsOf = (layer) =>
    (layer.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/gi) ?? [])
      .map((value) => (value.startsWith("#") ? hexToRgb(value) : parse(value)))
      .filter(Boolean);

  /**
   * Every colour this text could be sitting on, composited the way the browser composites it.
   *
   * The storefront paints its canvas with a gradient stack, not a background colour — measured on the
   * published page: body's `background-color` is fully transparent and its `background-image` is
   * `radial-gradient(rgba(197,160,89,.18), transparent 32%)` over
   * `linear-gradient(rgb(22,22,23), rgb(26,26,27))`. Both axe and a naive walk up the tree go blind
   * there: the first pass reported 1:1 for nearly every line because it took the 18%-alpha gold tint as
   * if it were an opaque background. So the layers are composited back to front and the WORST resulting
   * colour is the one judged — a label is only as readable as the lightest patch it can land on.
   */
  const backgroundsOf = (el) => {
    const out = [];
    let node = el;
    while (node) {
      const style = getComputedStyle(node);
      const solid = parse(style.backgroundColor);
      const image = style.backgroundImage;
      if (image && image !== "none" && image.includes("gradient")) {
        // CSS lists the front layer first; compositing runs from the deepest one forward.
        const layers = splitLayers(image).reverse();
        let acc = solid && solid.a > 0.9 ? solid : { r: 255, g: 255, b: 255, a: 1 };
        for (const layer of layers) {
          for (const stop of stopsOf(layer)) {
            acc = blend(stop, acc);
            out.push({ ...acc });
          }
        }
      } else if (solid && solid.a > 0.9) {
        out.push(solid);
      }
      node = node.parentElement;
    }
    return out;
  };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  const fails = { aa: [], aaa: [] };
  let checked = 0;
  let unknown = 0;
  let node;
  while ((node = walker.nextNode())) {
    const text = (node.nodeValue ?? "").trim();
    if (text.length < 2) continue;
    const el = node.parentElement;
    if (!el || seen.has(el)) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    seen.add(el);
    const fg = parse(style.color);
    if (!fg) continue;
    const candidates = backgroundsOf(el);
    if (candidates.length === 0) {
      unknown += 1;
      continue;
    }
    const size = Number.parseFloat(style.fontSize) || 16;
    const weight = Number.parseInt(style.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = { aa: large ? 3 : 4.5, aaa: large ? 4.5 : 7 };
    const r = Math.min(...candidates.map((bg) => ratio(blend(fg, bg), bg)));
    checked += 1;
    const record = { text: text.slice(0, 40), size: Math.round(size), ratio: Math.round(r * 100) / 100, need: need.aaa };
    if (r < need.aa) fails.aa.push(record);
    if (r < need.aaa) fails.aaa.push(record);
  }
  return {
    checked,
    unknown,
    aa: fails.aa.length,
    aaa: fails.aaa.length,
    worst: fails.aaa.sort((a, b) => a.ratio - b.ratio).slice(0, 5),
  };
};

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const p = await ctx.newPage();

async function open(path) {
  await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(9000);
}

// Sign in once for the owner's own screens.
await open("/gate/login");
await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await p.click("button[type=submit]");
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click("button[type=submit]");
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(2000);
console.log(`signed in at ${p.url()}\n`);

const summary = [];
for (const page of PAGES) {
  await open(page.path);
  if (page.admin && !p.url().includes("/admin")) {
    console.log(`${page.label}: the session did not hold — ${p.url()}`);
    continue;
  }
  await p.addScriptTag({ content: axeSource });
  const audit = await p.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag2aaa", "wcag21aaa", "best-practice"] },
      resultTypes: ["violations"],
    });
    return {
      checked: result.testResults?.length ?? 0,
      violations: result.violations.map((v) => ({
        id: v.id,
        impact: v.impact ?? "unknown",
        nodes: v.nodes.length,
        tags: v.tags.filter((t) => t.startsWith("wcag")).join("+"),
      })),
    };
  });
  const contrast = await p.evaluate(CONTRAST_PROBE);

  const nodes = audit.violations.reduce((sum, v) => sum + v.nodes, 0);
  const aaaRules = audit.violations.filter((v) => v.tags.includes("aaa"));
  console.log(`## ${page.label} (${page.path})`);
  console.log(`   axe: ${audit.violations.length} rules violated · ${nodes} places · AAA rules: ${aaaRules.length ? aaaRules.map((v) => `${v.id}(${v.nodes})`).join(", ") : "none"}`);
  for (const v of audit.violations.sort((a, b2) => b2.nodes - a.nodes).slice(0, 8)) {
    console.log(`     - ${v.id} · ${v.impact} · ${v.nodes} · ${v.tags}`);
  }
  console.log(`   contrast: ${contrast.checked} text nodes measured · ${contrast.unknown} with no computable background · fails AA ${contrast.aa} · fails AAA ${contrast.aaa}`);
  for (const w of contrast.worst) console.log(`     worst: ${w.ratio}:1 (needs ${w.need}:1) · ${w.size}px · «${w.text}»`);
  summary.push({ label: page.label, rules: audit.violations.length, nodes, aaaRules: aaaRules.length, contrastAa: contrast.aa, contrastAaa: contrast.aaa, textNodes: contrast.checked });
}

console.log("\n=== summary ===");
console.table(summary);
await b.close();

