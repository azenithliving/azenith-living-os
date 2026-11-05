/**
 * prove-bell-lands.mjs — the alert door's real answer, measured on the published link.
 *
 * Claims:
 *   1. the door answers a field set the repaired bell declares in full, with no phantom left,
 *   2. the count and the rest line come from the door, and they agree with the rows it sent,
 *   3. a refusal really arrives in Arabic so the bell's new refusal path has something to show
 *      (proved with an empty id list — the door rejects it before it can write anything),
 *   4. the surface that is actually mounted renders his alert strip at phone width, in his digits,
 *      with no console error.
 *
 * Nothing here writes to his ledger: the only POST-shaped call is one the door must refuse.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

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
const notRun = [];
const skip = (name, why) => {
  notRun.push(name);
  const s = `لم يُقَس — ${name} · ${why}`;
  lines.push(s);
  console.log(s);
};
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok) });
  const s = `${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${detail}` : ""}`;
  lines.push(s);
  console.log(s);
};

/** The bell's declared row contract, read from the shipped source. */
function declaredFields() {
  const src = readFileSync("components/admin/NotificationBell.tsx", "utf8");
  const m = /interface\s+OpenAlert\s*\{([\s\S]*?)\n\}/.exec(src);
  if (!m) throw new Error("the bell declares no row interface — the repair is not on disk");
  return [...m[1].matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\??\s*:/gm)].map((x) => x[1]);
}

const declared = declaredFields();
say("the bell declares", `${declared.length} :: ${declared.join(",")}`);

let browser = null;
try {
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });

  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !String(u).includes("/gate/login"), { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(2000);
  say("after login", page.url());

  // 1 and 2 — the door's answer, from the published site.
  const read = await page.evaluate(async () => {
    const r = await fetch("/api/admin/notifications?limit=20", { cache: "no-store" });
    const j = await r.json().catch(() => null);
    const row = Array.isArray(j?.data) && j.data.length ? j.data[0] : null;
    return {
      status: r.status,
      envelope: j ? Object.keys(j).sort().join(",") : "",
      success: j?.success ?? null,
      rows: Array.isArray(j?.data) ? j.data.length : -1,
      rowFields: row ? Object.keys(row).sort().join(",") : "",
      unreadCount: j?.unreadCount ?? null,
      restingLine: j?.restingLine === null ? "null" : String(j?.restingLine ?? "").slice(0, 120),
    };
  });
  say("door envelope", `status=${read.status} success=${read.success} fields=${read.envelope}`);
  say("door row", `rows=${read.rows} fields=${read.rowFields}`);
  say("door count and rest line", `unreadCount=${read.unreadCount} restingLine=${read.restingLine || "null"}`);

  const rowSet = read.rowFields ? read.rowFields.split(",") : [];
  const phantom = declared.filter((f) => !rowSet.includes(f));
  check("the door really answers on the published link", read.status === 200 && read.success === true, `status=${read.status}`);
  if (rowSet.length) {
    check("the bell declares no field the door does not answer", phantom.length === 0, `phantom=${phantom.length} :: ${phantom.join(",")}`);
  } else {
    skip(
      "the live row shape against the declared fields",
      "the strip is at rest — the door sent 0 rows, so no live row field exists to compare (the shape is measured on the door's own source)"
    );
  }
  check(
    "the door sends the count and the rest line the bell now reads",
    read.envelope.includes("unreadCount") && read.envelope.includes("restingLine"),
    read.envelope
  );
  const countAgrees = read.rows >= 0 && Number(read.unreadCount) === Number(read.rows);
  check("the door's count equals the rows it sent", countAgrees, `unread=${read.unreadCount} rows=${read.rows}`);
  const restAgrees =
    read.rows > 0 ? read.restingLine === "null" : /[0-9]/.test(read.restingLine) === false && read.restingLine.length > 10;
  check(
    "the rest line appears only when the strip is empty, and in his digits",
    restAgrees,
    `rows=${read.rows} rest=${read.restingLine.slice(0, 60)}`
  );

  // 3 — a real refusal, the kind the bell now shows. An empty id list is rejected before any write.
  // It runs in its own tab: the browser logs the 400 as a console error, and that error belongs to
  // this instrument, not to his screen.
  const probeTab = await ctx.newPage();
  await probeTab.goto(`${SITE}/admin`, { waitUntil: "domcontentloaded" });
  const refused = await probeTab.evaluate(async () => {
    const r = await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notification_ids: [], action: "mark_read" }),
    });
    const j = await r.json().catch(() => null);
    return { status: r.status, error: String(j?.error ?? ""), success: j?.success ?? null };
  });
  say("refusal the surface must show", `status=${refused.status} bytes=${refused.error.length} head=${refused.error.slice(0, 70)}`);
  check("the door refuses an empty id list and says why in Arabic", refused.status === 400 && /[\u0600-\u06FF]/.test(refused.error), `status=${refused.status}`);

  // 4 — the mounted surface, at phone width.
  const dash = await ctx.newPage();
  const dashErrors = [];
  dash.on("console", (m) => {
    if (m.type() === "error") dashErrors.push(m.text().slice(0, 160));
  });
  await dash.goto(`${SITE}/admin`, { waitUntil: "domcontentloaded" });
  await dash.waitForTimeout(6000);

  const card = await dash.evaluate(() => {
    const heads = [...document.querySelectorAll("h3")].filter((h) => h.textContent?.trim() === "الإشعارات");
    if (!heads.length) return { found: 0 };
    const cardEl = heads[0].closest("div.bg-white\\/\\[0\\.02\\]") || heads[0].parentElement?.parentElement?.parentElement;
    const text = (cardEl?.textContent || "").replace(/\s+/g, " ").trim();
    const rect = cardEl?.getBoundingClientRect();
    return {
      found: heads.length,
      width: Math.round(rect?.width || 0),
      textBytes: text.length,
      latinDigits: (text.match(/[0-9]/g) || []).length,
      arabicDigits: (text.match(/[٠-٩]/g) || []).length,
      head: text.slice(0, 150),
    };
  });
  say("the mounted strip at phone width", JSON.stringify(card));
  check("the alert card is on the screen", card.found === 1, `found=${card.found}`);
  check("it fits the phone and is not bleeding", card.width > 0 && card.width <= 390, `width=${card.width}`);
  check("it prints no Latin digit", card.latinDigits === 0, `latin=${card.latinDigits} arabic=${card.arabicDigits}`);
  check("the card is not an empty box", card.textBytes > 20, `bytes=${card.textBytes}`);

  // The strip's sentence is the door's, measured in the same run — a surface that wrote its own
  // «nothing to see» line is exactly the defect this atom repaired.
  const doorSentence = read.restingLine.replace(/\s+/g, " ").trim();
  const printsDoorSentence = doorSentence !== "null" && String(card.head).includes(doorSentence.slice(0, 40));
  check("the mounted strip prints the door's own sentence", printsDoorSentence, `door=${doorSentence.slice(0, 50)} card=${String(card.head).slice(0, 50)}`);

  await probeTab.close();

  await dash.evaluate(() => {
    const h = [...document.querySelectorAll("h3")].find((x) => x.textContent?.trim() === "الإشعارات");
    h?.scrollIntoView({ block: "center" });
  });
  await dash.waitForTimeout(1200);
  await dash.screenshot({ path: "scratch/bell-strip-390.png", fullPage: false });
  say("screenshot", "scratch/bell-strip-390.png");

  const ownErrors = [...consoleErrors, ...dashErrors];
  say("console errors on the measured tabs", `${ownErrors.length} :: ${ownErrors.slice(0, 3).join(" | ")}`);
  check("the measured tabs logged no console error", ownErrors.length === 0, ownErrors.slice(0, 2).join(" | "));
} catch (err) {
  check("the run completed", false, String(err).slice(0, 200));
} finally {
  if (browser) await browser.close();
  const failed = checks.filter((c) => !c.ok);
  lines.push(
    `RESULT: ${checks.length - failed.length} of ${checks.length} checks passed · failed=${failed.length} · not measured=${notRun.length}`
  );
  if (notRun.length) lines.push("NOT MEASURED: " + notRun.join(" · "));
  if (failed.length) lines.push("FAILED CHECKS: " + failed.map((f) => f.name).join(" · "));
  writeFileSync("scratch/prove-bell-lands.out", lines.join("\n") + "\n");
  console.log(failed.length ? "PROVE_FAILED" : "PROVE_PASSED");
  if (failed.length) process.exitCode = 1;
}
