/**
 * prove-registry-names.mjs — the settings desk on the published link, at phone width.
 *
 * Claims under attack: «the desk names the six values a surface reads», «the three keys the registry
 * never heard of now have his Arabic names and a state line that says what the record holds»,
 * «no machine key is printed on his screen», «the residue is counted the way it was measured», and
 * «the desk renders with no console error».
 *
 * Measured before the fix (scratch/measure-settings-readers.mjs): the table holds 20 keys, 6 are read
 * by code outside the admin screens, 14 are touched only by the old house's own tabs — and the
 * registry named 17, so three keys had no Arabic name anywhere.
 *
 * This instrument writes nothing: it reads the page and the record and compares.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";
const PAGE = "/admin/v2/settings";

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

const ar = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
let browser = null;

try {
  const rows = await sql`select key, value from public.site_settings`;
  const record = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const numbersCount = Array.isArray(record.contact_numbers) ? record.contact_numbers.length : -1;
  const twoFA = record.admin_gate_2fa_required;
  const stamp = record.nightly_snapshot_last || {};
  say("the record holds keys", rows.length);
  say("contact_numbers entries", numbersCount);
  say("admin_gate_2fa_required", String(twoFA));
  say("nightly stamp day", String(stamp.day ?? "-") + " rows=" + String(stamp.rows ?? "-"));
  say("digits in the stored day", String(stamp.day ?? "").replace(/[^0-9]/g, "").length);

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !String(u).includes("/gate/login"), { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(2000);
  say("after login", page.url());

  // A fresh tab: the old /admin page keeps a fetch running when this instrument navigates away from
  // it, and that aborted request logs «Failed to fetch» into the tab's console — an artifact of the
  // instrument, not a defect on the desk. Measured 2026-11-04 by scratch/measure-quality-door.mjs.
  const deskPage = await ctx.newPage();
  const deskErrors = [];
  deskPage.on("console", (m) => {
    if (m.type() === "error") deskErrors.push(m.text().slice(0, 160));
  });
  await deskPage.goto(`${SITE}${PAGE}`, { waitUntil: "domcontentloaded" });
  await deskPage.waitForTimeout(6000);

  const desk = await deskPage.evaluate(() => {
    const cards = Array.from(document.querySelectorAll("[data-setting]")).map((el) => ({
      key: el.getAttribute("data-setting"),
      text: (el.innerText || "").replace(/\s+/g, " ").trim(),
    }));
    const section = document.querySelector("[data-settings-desk]");
    return {
      cards,
      sectionText: (section?.innerText || "").replace(/\s+/g, " ").trim(),
      pageText: document.body.innerText || "",
    };
  });

  say("cards on the desk", desk.cards.length);
  check("the desk names the six values a surface reads", desk.cards.length === 6, `cards=${desk.cards.length}`);

  const byKey = Object.fromEntries(desk.cards.map((c) => [c.key, c.text]));
  for (const k of ["contact_numbers", "admin_gate_2fa_required", "nightly_snapshot_last"]) {
    check(`the desk has a card for ${k}`, Boolean(byKey[k]), byKey[k] ? byKey[k].slice(0, 90) : "absent");
  }

  check(
    "the numbers card says what the record holds",
    Boolean(byKey.contact_numbers) && byKey.contact_numbers.includes(ar(numbersCount)),
    `record=${ar(numbersCount)} card=${(byKey.contact_numbers || "").slice(0, 70)}`
  );
  check(
    "the two-factor card tells him which way it is set",
    Boolean(byKey.admin_gate_2fa_required) &&
      (twoFA === true || String(twoFA) === "true"
        ? byKey.admin_gate_2fa_required.includes("شغّال")
        : byKey.admin_gate_2fa_required.includes("مقفول بأمر منك")),
    (byKey.admin_gate_2fa_required || "").slice(0, 90)
  );
  check(
    "the nightly copy card shows the stamp's own day, in his digits",
    Boolean(byKey.nightly_snapshot_last) &&
      String(stamp.day) !== "undefined" &&
      byKey.nightly_snapshot_last.includes(ar(String(stamp.day))),
    `record day=${ar(String(stamp.day ?? "-"))} card=${(byKey.nightly_snapshot_last || "").slice(0, 90)}`
  );

  check(
    "the residue is counted the way it was measured",
    desk.sectionText.includes(`${ar(14)} قيمة مسجّلة`) && desk.sectionText.includes("ومفيش شاشة بتعرضها للعميل"),
    desk.sectionText.slice(0, 120)
  );

  const machineKeys = (desk.pageText.match(/[a-z]+_[a-z_]+/g) || []).filter((w) => !w.includes("data-"));
  say("machine-key shapes visible on the page", machineKeys.length + (machineKeys.length ? " [" + machineKeys.slice(0, 5).join(",") + "]" : ""));
  check("no machine key is printed on his screen", machineKeys.length === 0, machineKeys.slice(0, 5).join(","));

  const deskArabic = desk.sectionText;
  const latinDigits = (deskArabic.match(/[0-9]/g) || []).length;
  say("desk latin digits", latinDigits);
  check("the desk counts in his digits", latinDigits === 0, `latin digits=${latinDigits}`);

  const residueMatch = deskArabic.match(/([\u0660-\u0669]+) قيمة مسجّلة/);
  const residueCounted = residueMatch
    ? Number(residueMatch[1].replace(/[\u0660-\u0669]/g, (d) => String(d.codePointAt(0) - 0x0660)))
    : null;
  say("residue counted", residueCounted);
  check("the residue box counts the fourteen the code census named", residueCounted === 14, `counted=${residueCounted}`);

  say("desk console errors", deskErrors.length);
  check("no console error on the desk", deskErrors.length === 0, deskErrors.slice(0, 2).join(" | "));
  await deskPage.screenshot({ path: "scratch/registry-settings-390.png", fullPage: true });
} catch (error) {
  say("INSTRUMENT ERROR", String(error && error.message ? error.message : error).slice(0, 200));
  checks.push({ name: "instrument completed", ok: false });
} finally {
  if (browser) await browser.close().catch(() => {});
  await sql.end({ timeout: 5 }).catch(() => {});
  const passed = checks.filter((c) => c.ok).length;
  say("RESULT", `${passed} of ${checks.length}`);
  writeFileSync("scratch/prove-registry-names.out", lines.join("\n") + "\n");
}
