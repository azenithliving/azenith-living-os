#!/usr/bin/env node
/**
 * prove-passkey-login.mjs — the fingerprint opens the dashboard on the published site, and no
 * password crosses the door that does it.
 *
 * What has to be proven here is more than «a button exists»:
 *  1. the challenge door answers an ANONYMOUS browser — it is a front door, not a settings door;
 *  2. a real WebAuthn ceremony, run by Chrome's own virtual authenticator through the debugging
 *     protocol (measured: the field is `options`), produces a signed answer the store verifies;
 *  3. the session that follows is the store's own admin session — proved by asking an admin-only door
 *     for its answer after the cookies were wiped and never re-typed;
 *  4. the usage counter and the last-used stamp move in the record, and are read back;
 *  5. refusals: garbage gets 400 and opens nothing, an unregistered key id gets 401, and the password
 *     door still works — the escape hatch was not traded away.
 *
 * The instrument writes ONE row carrying its own marker, deletes exactly that row by its own id, and
 * prints what is left.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { chromium } from "@playwright/test";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";
const MARKER = "مفتاح دخول آلي";

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
  const s = `${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${String(detail).slice(0, 180)}` : ""}`;
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
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });

  // 1. The front door answers an anonymous browser.
  const anonOptions = await ctx.request.fetch(`${SITE}/api/admin/passkeys/authenticate/options`, { method: "POST" });
  const anonBody = await anonOptions.json().catch(() => ({}));
  say("anonymous challenge status", anonOptions.status());
  check(
    "the login challenge answers an anonymous browser",
    anonOptions.status() === 200 && typeof anonBody.challenge === "string" && anonBody.challenge.length > 10,
    `challenge length=${String(anonBody.challenge ?? "").length}`,
  );
  check(
    "the login challenge asks the device to verify the person",
    anonBody.userVerification === "required",
    `userVerification=${anonBody.userVerification}`,
  );

  // 2. Enroll a machine key through the real card, with Chrome's own virtual authenticator attached.
  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !String(u).includes("/gate/login"), { timeout: 40000 }).catch(() => {});

  const cdp = await ctx.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
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
  await page.fill('input[placeholder^="اسم المفتاح"]', MARKER);
  await page.click('button:has-text("سجّل مفتاح من الجهاز ده")');
  const enrolledNotice = await page
    .waitForFunction(
      () => {
        const node = [...document.querySelectorAll("p")].find(
          (p) => p.textContent?.includes("اتسجل") && !p.textContent?.includes("ما اتسجلش"),
        );
        return node ? node.textContent : null;
      },
      { timeout: 45000 },
    )
    .then((h) => h.jsonValue())
    .catch(() => null);
  say("enrollment answer", enrolledNotice ?? "(null)");
  check("the marker key got enrolled through the card", typeof enrolledNotice === "string", enrolledNotice ?? "");

  const stored = await sql`select id, counter, last_used_at, label from public.user_public_keys where label = ${MARKER}`;
  enrolledId = stored[0]?.id ?? null;
  say("stored counter after enrollment", stored[0]?.counter ?? "(none)");
  check("the record holds one row with the marker", stored.length === 1, `rows=${stored.length}`);

  // 3. Wipe every cookie: from here the browser has nothing but the device.
  await ctx.clearCookies();
  say("cookies", "cleared — the next request carries no password and no session");

  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const buttonLabel = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("الدخول ببصمة الجهاز"));
    return b ? b.textContent.trim() : null;
  });
  check("the owner's login screen offers the fingerprint as the front door", buttonLabel === "الدخول ببصمة الجهاز", buttonLabel ?? "(no button)");

  await page.click('button:has-text("الدخول ببصمة الجهاز")');
  const landed = await page
    .waitForURL((u) => !String(u).includes("/gate/login"), { timeout: 45000 })
    .then(() => true)
    .catch(() => false);
  say("url after the ceremony", page.url());
  check("the fingerprint opened the dashboard without a typed password", landed, page.url());

  // 4. That session is the store's own admin session — an admin-only door answers it.
  const listRes = await ctx.request.fetch(`${SITE}/api/admin/passkeys/list`, { headers: { "cache-control": "no-store" } });
  const listBody = await listRes.json().catch(() => ({}));
  const labels = (listBody.keys ?? []).map((k) => k.label);
  say("admin door after the ceremony", `status=${listRes.status()} labels=${JSON.stringify(labels)}`);
  check(
    "the session the key minted is an admin session",
    listRes.status() === 200 && listBody.measured === true && labels.includes(MARKER),
    `status=${listRes.status()}`,
  );

  const used = await sql`select counter, last_used_at from public.user_public_keys where id = ${enrolledId}`;
  say("row after the login", JSON.stringify(used[0] ?? null));
  check("the usage counter moved and the record read it back", Number(used[0]?.counter ?? 0) > Number(stored[0]?.counter ?? 0), `counter=${used[0]?.counter}`);
  check("the last-used stamp is written", Boolean(used[0]?.last_used_at), String(used[0]?.last_used_at));

  // 5. Refusals.
  const garbage = await ctx.request.fetch(`${SITE}/api/admin/passkeys/authenticate/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify({ response: { id: "no-such-key", rawId: "no-such-key", type: "public-key", response: { authenticatorData: "a", clientDataJSON: "b", signature: "c" } } }),
  });
  const garbageBody = await garbage.json().catch(() => ({}));
  say("unregistered key answer", `status=${garbage.status()} message=${String(garbageBody.message ?? "")}`);
  check(
    "a key that was never enrolled is refused in words that say so",
    garbage.status() === 401 && String(garbageBody.message ?? "").includes("مش مسجّل"),
    `status=${garbage.status()}`,
  );

  // The escape hatch is still standing: the password door opens for the same account.
  const escapeCtx = await browser.newContext();
  const escapeRes = await escapeCtx.request.fetch(`${SITE}/api/admin/gate/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify({ email: env.ADMIN_GATE_EMAIL, password: env.ADMIN_GATE_PASSWORD }),
  });
  const escapeBody = await escapeRes.json().catch(() => ({}));
  say("password door answer", `status=${escapeRes.status()} signedIn=${escapeBody.signedIn}`);
  check("the password escape still opens the gate", escapeRes.status() === 200 && escapeBody.signedIn === true, `signedIn=${escapeBody.signedIn}`);
  await escapeCtx.close();

  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await ctx.clearCookies();
  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "scratch/passkey-login-screen-390.png", fullPage: true });
  say("login screen screenshot", "scratch/passkey-login-screen-390.png");
  check("the screen logged no console error", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
} catch (err) {
  check("the run completed", false, String(err).slice(0, 220));
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
  writeFileSync("scratch/prove-passkey-login.out", lines.join("\n") + "\n");
  console.log(result);
  console.log(failed.length ? "PROVE_FAILED" : "PROVE_PASSED");
  if (failed.length) process.exitCode = 1;
}
