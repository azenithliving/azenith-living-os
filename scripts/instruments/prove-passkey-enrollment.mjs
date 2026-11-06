#!/usr/bin/env node
/**
 * prove-passkey-enrollment.mjs — a real key, minted in the browser, lands in the record.
 *
 * This is the owner's chosen capability (2026-11-06: «المفتاح أيوه»), and the only proof that counts
 * is the ceremony: the page asks the store for a challenge, the device answers it, the store verifies
 * the answer, the row is written and read back, and the card shows the name the owner typed.
 *
 * The device here is Chrome's own virtual authenticator (measured through the debugging protocol),
 * because no agent may press the owner's fingerprint. That proves the plumbing end to end on the
 * published site; enrolling his real phone or his face is a one-line task for his hands, and it is
 * recorded as needing him, not as done.
 *
 * The instrument writes ONE row carrying its own marker, deletes exactly that row by its own id, and
 * prints what is left. It also asks for one refusal, so a door that accepts garbage is caught.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { chromium } from "@playwright/test";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";
const MARKER = "مفتاح قياس آلي";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(1 + l.indexOf("=")).trim().replace(/^["']|["']$/g, "")]),
);

const lines = [];
const checks = [];
const say = (label, value) => {
  lines.push(`${label}: ${value}`);
  console.log(`${label}: ${value}`);
};
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok) });
  const s = `${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${String(detail).slice(0, 160)}` : ""}`;
  lines.push(s);
  console.log(s);
};

const sql = postgres(env.DIRECT_URL, { max: 1 });
let browser = null;
let enrolledId = null;

try {
  const before = await sql`select count(*)::int as n from public.user_public_keys`;
  say("rows before", before[0].n);

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const gate = await ctx.newPage();
  await gate.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await gate.waitForTimeout(1500);
  await gate.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await gate.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  await gate.click('button[type="submit"]');
  await gate.waitForURL((u) => !String(u).includes("/gate/login"), { timeout: 40000 }).catch(() => {});

  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });

  const cdp = await ctx.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  // The parameter name is read from this Chromium build's own protocol (148.0.7778.96 answered
  // `/json/protocol`: the field is `options`, and `transport` allows internal|usb|nfc|ble|cable).
  // Guessing it produced «Invalid parameters» for every combination.
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
  say("virtual authenticator", authenticatorId);

  await page.goto(`${SITE}/admin/v2/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  const heading = await page.evaluate(() => document.body.innerText.includes("مفاتيح الدخول"));
  check("the key desk is on the owner's settings screen", heading);

  await page.fill('input[placeholder^="اسم المفتاح"]', MARKER);
  await page.click('button:has-text("سجّل مفتاح من الجهاز ده")');
  const notice = await page
    .waitForFunction(
      () => {
        const node = [...document.querySelectorAll("p")].find((p) => p.textContent?.includes("اتسجل") || p.textContent?.includes("ما اتسجلش"));
        return node ? node.textContent : null;
      },
      { timeout: 45000 },
    )
    .then((h) => h.jsonValue())
    .catch(() => null);
  say("card answer", notice ?? "(null)");
  check("the device answered the challenge and the store accepted it", typeof notice === "string" && notice.includes("اتسجل") && !notice.includes("ما اتسجلش"), notice ?? "");

  const rows = await sql`select id, credential_id, counter, device_type, backed_up, origin, label,
      (length(credential_public_key) > 10) as key_bytes, (public_key <> '') as key_text
    from public.user_public_keys where label = ${MARKER}`;
  enrolledId = rows[0]?.id ?? null;
  say("stored row", JSON.stringify(rows.map((r) => ({ credentialIdLen: r.credential_id?.length, counter: r.counter, deviceType: r.device_type, origin: r.origin, keyBytes: r.key_bytes, keyText: r.key_text }))));
  check("the record holds one row with the marker", rows.length === 1, `rows=${rows.length}`);
  check("the stored key carries bytes the verifier produced", rows[0]?.key_bytes === true && rows[0]?.key_text === true, `bytes=${rows[0]?.key_bytes} text=${rows[0]?.key_text}`);
  check("the origin stored is the published address", String(rows[0]?.origin ?? "").includes("azenith-living.vercel.app"), rows[0]?.origin ?? "(none)");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const listed = await page.evaluate((marker) => document.body.innerText.includes(marker), MARKER);
  check("the card lists the key by the name the owner typed", listed, MARKER);
  check("the screen logged no console error", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));

  const card = page.locator("section", { hasText: "مفاتيح الدخول" }).first();
  await card.screenshot({ path: "scratch/passkey-card-390.png" });
  say("card screenshot", "scratch/passkey-card-390.png");

  const garbage = await ctx.request.fetch(`${SITE}/api/admin/passkeys/enroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify({ label: "ردّ عشوائي", response: { id: "x", type: "public-key", clientDataJSON: "y" } }),
  });
  const garbageBody = await garbage.json().catch(() => ({}));
  check("a garbage answer is refused and stores nothing", garbage.status() === 400 && garbageBody.saved === false, `status=${garbage.status()} saved=${garbageBody.saved}`);
  const strays = await sql`select count(*)::int as n from public.user_public_keys where label = ${"ردّ عشوائي"}`;
  check("the refused attempt left no row", strays[0].n === 0, `rows=${strays[0].n}`);
} catch (err) {
  check("the run completed", false, String(err).slice(0, 200));
} finally {
  if (enrolledId) {
    const removed = await sql`delete from public.user_public_keys where id = ${enrolledId} and label = ${MARKER} returning id`;
    say("own row deleted", removed.length);
  }
  const leftovers = await sql`select count(*)::int as n from public.user_public_keys where label like ${MARKER + "%"}`;
  say("rows left by this run", leftovers[0].n);
  const after = await sql`select count(*)::int as n from public.user_public_keys`;
  say("rows after", after[0].n);
  check("the desk holds no test row at the end", leftovers[0].n === 0, `left=${leftovers[0].n}`);

  if (browser) await browser.close();
  await sql.end();
  const failed = checks.filter((c) => !c.ok);
  const result = `RESULT: ${checks.length - failed.length} of ${checks.length} checks passed · failed=${failed.length}`;
  lines.push(result);
  if (failed.length) lines.push("FAILED CHECKS: " + failed.map((f) => f.name).join(" · "));
  writeFileSync("scratch/prove-passkey-enrollment.out", lines.join("\n") + "\n");
  console.log(result);
  console.log(failed.length ? "PROVE_FAILED" : "PROVE_PASSED");
  if (failed.length) process.exitCode = 1;
}
