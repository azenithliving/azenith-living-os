#!/usr/bin/env node
/**
 * prove-faq-link-lands.mjs — the signed answer must actually reach the customer who asked.
 *
 * The scan caught the door writing a column the record never had (`answered_at`), the route logged the
 * refusal and still answered `success: true`. Nothing local proves the customer-side consequence, so
 * this walks the published site end to end: a marked question waits, the reply check says there is
 * nothing for him, the sentence is signed against that question, and the same reply check now carries
 * the answer. Every row it creates it deletes by its own id, and it prints what is left.
 *
 * Writes only rows carrying MARKER. Reads the admin session from the gate login, same as the owner.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { chromium } from "@playwright/test";

const SITE = "https://azenith-living.vercel.app";
const MARKER = "سؤال قياس آلي — ما بيتقالش لزبون";
const ANSWER = "ردّ قياس آلي — يوصل للزبون اللي سأل";
const SESSION = `proof-faq-link-${Date.now()}`;

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(1 + l.indexOf("=")).trim().replace(/^["']|["']$/g, "")]),
);

const lines = [];
const checks = [];
const created = { faqId: null, pendingId: null };
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

let browser = null;
try {
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const gate = await ctx.newPage();
  await gate.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await gate.waitForTimeout(1500);
  await gate.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await gate.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  await gate.click('button[type="submit"]');
  await gate.waitForURL((u) => !String(u).includes("/gate/login"), { timeout: 40000 }).catch(() => {});

  const api = async (method, path, body) => {
    const res = await ctx.request.fetch(`${SITE}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      data: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status(), body: await res.json().catch(() => null) };
  };

  // A swallowed failed sign-in would show up as eight data failures instead of what it is.
  const signedIn = await api("GET", "/api/admin/ruler");
  check("the desk is signed in on the published site", signedIn.status === 200, `status=${signedIn.status}`);
  if (signedIn.status !== 200) throw new Error("البوابة ما فتحتش — القياس ما اتعملش");

  const openRow = await api("POST", "/api/consultant/pending-questions", { question: MARKER, sessionId: SESSION });
  created.pendingId = openRow.body?.question?.id ?? null;
  say("pending row created", created.pendingId ?? "(null)");
  check("a marked question waits on the desk", openRow.status === 200 && !!created.pendingId, `status=${openRow.status}`);

  const before = await api("GET", `/api/consultant/check-reply?sessionId=${SESSION}`);
  check("the customer gets nothing while it is only waiting", before.status === 200 && before.body?.reply == null, JSON.stringify(before.body ?? "").slice(0, 80));

  const signed = await api("POST", "/api/consultant/faq", {
    question: MARKER,
    answer: ANSWER,
    originalPendingQuestionId: created.pendingId,
  });
  created.faqId = signed.body?.faq?.id ?? null;
  say("faq row created", created.faqId ?? "(null)");
  check("the sentence is signed and the door says which half landed", signed.status === 200 && !!created.faqId && signed.body?.pending?.saved === true, JSON.stringify(signed.body?.pending ?? null));

  const after = await api("GET", `/api/consultant/check-reply?sessionId=${SESSION}`);
  const delivered = typeof after.body?.reply === "string" && after.body.reply.includes(ANSWER);
  check("the same customer now reads the signed answer", delivered, (after.body?.reply ?? "(null)").slice(0, 60));

  const door = await api("GET", "/api/admin/ruler");
  const refusalLine = door.body?.refusalLine ?? "";
  const shippedLine = JSON.parse(readFileSync("docs/ledger/refusal-scan.json", "utf8")).line;
  check("the published ruler carries the same scan this repo shipped", door.status === 200 && refusalLine === shippedLine, refusalLine.slice(0, 90));

  const screen = await ctx.newPage();
  const consoleErrors = [];
  screen.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });
  await screen.goto(`${SITE}/admin/v2/settings`, { waitUntil: "domcontentloaded" });
  await screen.waitForTimeout(6000);
  const text = await screen.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
  check("the signature desk opens with no console error", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
  check("the signature desk is on the page", text.includes("الكلام اللي المستشار بيقوله لوحده"), text.slice(0, 80));

  const removedFaq = await api("DELETE", `/api/consultant/faq?id=${encodeURIComponent(created.faqId)}`);
  const removedPending = await api("DELETE", `/api/consultant/pending-questions?id=${encodeURIComponent(created.pendingId)}`);
  say("delete answers", `faq=${removedFaq.status} pending=${removedPending.status} removed=${removedPending.body?.removed ?? "(none)"}`);

  const faqRows = await api("GET", "/api/consultant/faq");
  const stillThere = (faqRows.body?.faq ?? []).filter((r) => r.question === MARKER).length;
  check("no test sentence was left on the shelf", faqRows.status === 200 && stillThere === 0, `rows=${stillThere}`);

  // The waiting list only ever shows `pending` rows, and this row is `delivered` by now — asking it
  // proves nothing. The door's own second answer does: the same id, deleted again, says «nothing here».
  const againPending = await api("DELETE", `/api/consultant/pending-questions?id=${encodeURIComponent(created.pendingId)}`);
  check(
    "no test question was left in the record",
    removedPending.status === 200 && removedPending.body?.removed === 1 && againPending.status === 404,
    `first=${removedPending.status}/${removedPending.body?.removed ?? "(none)"} second=${againPending.status}`,
  );

  // The picture is taken after the cleanup, so the owner's desk is shown as he will find it — and a
  // test row left behind would be visible in the page text, not only in the door's count.
  await screen.reload({ waitUntil: "domcontentloaded" });
  await screen.waitForTimeout(5000);
  const cleanText = await screen.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
  check("the desk on screen carries no test row", !cleanText.includes(MARKER), cleanText.slice(0, 80));
  await screen.screenshot({ path: "scratch/faq-link-settings-390.png", fullPage: true });
  say("screenshot", "scratch/faq-link-settings-390.png");
  const card = screen.locator("section", { hasText: "الكلام اللي المستشار بيقوله لوحده" }).first();
  await card.screenshot({ path: "scratch/faq-link-card-390.png" });
  say("card screenshot", "scratch/faq-link-card-390.png");
} catch (err) {
  check("the run completed", false, String(err).slice(0, 200));
} finally {
  if (browser) await browser.close();
  const failed = checks.filter((c) => !c.ok);
  lines.push(`RESULT: ${checks.length - failed.length} of ${checks.length} checks passed · failed=${failed.length}`);
  if (failed.length) lines.push("FAILED CHECKS: " + failed.map((f) => f.name).join(" · "));
  writeFileSync("scratch/prove-faq-link-lands.out", lines.join("\n") + "\n");
  console.log(failed.length ? "PROVE_FAILED" : "PROVE_PASSED");
  if (failed.length) process.exitCode = 1;
}
