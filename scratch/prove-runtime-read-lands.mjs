/**
 * prove-runtime-read-lands.mjs — the site shell's settings read, measured on the published link.
 *
 * Claims under attack, each with both sides measured so none can pass by being empty:
 *   1. the record's settings rows arrive through the one query the code now sends (counted here),
 *   2. the record holds no theme colors and the served page invents none,
 *   3. the record holds no ad ids and the served page loads no ad script,
 *   4. the old tenant filter would still be refused by the record, and the code no longer sends it,
 *   5. the customer home page renders at phone width with no console error.
 *
 * That the code sends exactly query (1) and never query (4) is proven by the call list in
 * tests/settings/runtimeRead.test.ts; a PostgREST refusal inside a server render is not visible
 * from the browser.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(1 + l.indexOf("=")).trim().replace(/^["']|["']$/g, "")]),
);

const lines = [];
const checks = [];
const say = (label, value) => {
  const s = `${label}: ${value}`;
  lines.push(s);
  console.log(s);
};
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok) });
  const s = `${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${detail}` : ""}`;
  lines.push(s);
  console.log(s);
};

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
let browser = null;

try {
  // 1. the same query the code sends, run against the live record.
  const restUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const restKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const oneQuery = await fetch(`${restUrl}/rest/v1/site_settings?select=key,value&key=in.(theme,seo)`, {
    headers: { apikey: restKey, Accept: "application/json" },
  });
  const oneRows = await oneQuery.json();
  const returnedKeys = Array.isArray(oneRows) ? oneRows.map((r) => r.key).sort().join(",") : "-";
  say("the one query → status=" + oneQuery.status + " rows", Array.isArray(oneRows) ? oneRows.length : "-");
  say("keys it returns", returnedKeys);
  check("the record answers the single query with both settings", oneQuery.status === 200 && returnedKeys === "seo,theme", `keys=${returnedKeys}`);

  // 4. the tenant filter the code used to send, measured as still refused by the record.
  const scoped = await fetch(`${restUrl}/rest/v1/site_settings?select=key,value&company_id=eq.any&key=in.(theme,seo)`, {
    headers: { apikey: restKey, Accept: "application/json" },
  });
  const scopedText = await scoped.text();
  const scopedCode = (scopedText.match(/"code":"([^"]+)"/) ?? [])[1] ?? "-";
  say("the old tenant filter → status", scoped.status + " code=" + scopedCode);
  const columns = await sql`select column_name from information_schema.columns where table_schema='public' and table_name='site_settings'`;
  const columnNames = columns.map((c) => c.column_name);
  say("the record's settings columns", columnNames.length + " [" + columnNames.join(",") + "]");
  check("the record still has no company column, so the old filter was refused", !columnNames.includes("company_id") && scoped.status >= 400, `status=${scoped.status} code=${scopedCode}`);

  // 2 and 3. what the record holds, and what the served page shows.
  const rows = await sql`select key, value from public.site_settings where key in ('theme','seo')`;
  const record = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const themeKeys = Object.keys(record.theme || {});
  const seo = record.seo || {};
  const adsOn = seo.adsenseEnabled === true;
  const adIds = ["adsenseClient", "analyticsId", "googleAdsId"].filter((k) => typeof seo[k] === "string" && seo[k]);
  say("record theme keys", themeKeys.length + " [" + themeKeys.join(",") + "]");
  say("record ad switches", `adsenseEnabled=${String(adsOn)} ids=${adIds.length ? adIds.join(",") : "none"}`);

  const html = await (await fetch(SITE + "/")).text();
  say("served home page bytes", html.length);
  const inlineStyle = (html.match(/<html[^>]*\sstyle="([^"]*)"/i) ?? [])[1] ?? "";
  say("served inline style on the shell", inlineStyle.slice(0, 120) || "empty");
  check(
    "the record holds no theme colors and the served shell invents none",
    themeKeys.length === 0 ? !/--brand-primary/.test(inlineStyle) : /--brand-primary/.test(inlineStyle),
    `themeKeys=${themeKeys.length} inline="${inlineStyle.slice(0, 60)}"`
  );

  const adScript = /pagead2\.googlesyndication|googletagmanager\.com\/gtag/i.test(html);
  check(
    "the ad script appears exactly when the record turns it on",
    adScript === (adsOn && adIds.length > 0),
    `record says on=${adsOn} ids=${adIds.length}; page has script=${adScript}`
  );

  check("no refusal text leaks into the served HTML", !/42703|PGRST\d|does not exist/i.test(html), (html.match(/.{0,50}(42703|PGRST).{0,30}/i) ?? [""])[0]);
  check("the page is his Arabic page", /lang="ar"/.test(html) && /dir="rtl"/.test(html));

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });
  await page.goto(SITE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  const rendered = await page.evaluate(() => ({
    text: document.body.innerText.replace(/\s+/g, " ").length,
    inlineBrand: (document.documentElement.getAttribute("style") || "").includes("--brand-primary"),
    computedBrand: getComputedStyle(document.documentElement).getPropertyValue("--brand-primary").trim(),
  }));
  say("home page text at 390px", rendered.text);
  say("shell inline brand / computed brand", `${String(rendered.inlineBrand)} / ${rendered.computedBrand || "-"}`);
  check("the customer home page renders", rendered.text > 400, `chars=${rendered.text}`);
  check("the brand color in the browser comes from the stylesheet, not a value the shell made up", rendered.inlineBrand === (themeKeys.length > 0), `inline=${rendered.inlineBrand} record theme keys=${themeKeys.length}`);
  check("no console error on the home page", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
  await page.screenshot({ path: "scratch/runtime-read-home-390.png", fullPage: false });
} catch (error) {
  say("INSTRUMENT ERROR", String(error && error.message ? error.message : error).slice(0, 200));
  checks.push({ name: "instrument completed", ok: false });
} finally {
  if (browser) await browser.close().catch(() => {});
  await sql.end({ timeout: 5 }).catch(() => {});
  const passed = checks.filter((c) => c.ok).length;
  say("RESULT", `${passed} of ${checks.length}`);
  writeFileSync("scratch/prove-runtime-read-lands.out", lines.join("\n") + "\n");
}
