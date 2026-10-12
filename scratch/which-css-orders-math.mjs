import { chromium } from "@playwright/test";

/**
 * Which CSS actually makes an Arabic-Indic sum read left to right inside a right-to-left line?
 *
 * The fix set `dir="ltr"` on the run and the browser agrees the run's direction is left-to-right —
 * yet measuring the glyphs says the first character is still the rightmost one. So `direction` alone
 * is not the lever. This builds the same sentence five ways in the same RTL paragraph and prints, for
 * each, the x of the first character and the x of the last: the answer is which one puts the first
 * character on the left, and nothing else is guessed.
 *
 *   node scratch/which-css-orders-math.mjs
 */
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
await p.goto("data:text/html,<html><body></body></html>");

const out = await p.evaluate(() => {
  const host = document.createElement("div");
  host.setAttribute("dir", "rtl");
  host.style.fontFamily = "sans-serif";
  host.style.fontSize = "16px";
  document.body.appendChild(host);

  const SUM = "٢× = ٥٤٠٠٠٠";
  const CASES = [
    { name: "rtl بدون أي حاجة", attrs: {}, css: {} },
    { name: "direction: ltr بس", attrs: {}, css: { direction: "ltr" } },
    { name: "attr dir=ltr", attrs: { dir: "ltr" }, css: {} },
    { name: "dir=ltr + isolate", attrs: { dir: "ltr" }, css: { unicodeBidi: "isolate" } },
    { name: "dir=ltr + isolate-override", attrs: { dir: "ltr" }, css: { unicodeBidi: "isolate-override" } },
    { name: "dir=ltr + plaintext", attrs: { dir: "ltr" }, css: { unicodeBidi: "plaintext" } },
    { name: "ltr + display:inline-block", attrs: { dir: "ltr" }, css: { display: "inline-block" } },
  ];

  const results = [];
  for (const c of CASES) {
    const line = document.createElement("p");
    line.style.margin = "2px 0";
    line.append(document.createTextNode("الجملة قبل "));
    const span = document.createElement("span");
    for (const [k, v] of Object.entries(c.attrs)) span.setAttribute(k, v);
    Object.assign(span.style, c.css);
    span.textContent = SUM;
    line.appendChild(span);
    line.append(document.createTextNode(" بعد الجملة"));
    host.appendChild(line);

    const node = span.firstChild;
    const first = document.createRange();
    first.setStart(node, 0);
    first.setEnd(node, 1);
    const last = document.createRange();
    last.setStart(node, SUM.length - 1);
    last.setEnd(node, SUM.length);
    const f = first.getBoundingClientRect();
    const l = last.getBoundingClientRect();
    results.push({
      name: c.name,
      dir: getComputedStyle(span).direction,
      bidi: getComputedStyle(span).unicodeBidi,
      firstX: Math.round(f.left),
      lastX: Math.round(l.left),
      ok: f.left <= l.left,
    });
  }
  return results;
});

for (const r of out) {
  console.log(`${r.ok ? "صح  " : "مقلوب"} | ${r.name.padEnd(28)} | اتجاه ${r.dir} | يونيكود-بيدي ${r.bidi} | أول ${r.firstX} آخر ${r.lastX}`);
}
await b.close();
