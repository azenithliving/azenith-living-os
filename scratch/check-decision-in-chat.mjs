import fs from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * The decision, in the message that asked for it.
 *   node scratch/check-decision-in-chat.mjs [base]
 *
 * What must be true on the published site: he asks the leader for something that needs his approval,
 * the swarm writes the proposal, and the chat message that says so carries the proposal's number —
 * so the three buttons appear under that sentence, and pressing one changes the real row. A block
 * that renders but cannot decide, or a decision that does not move the row, both fail this.
 *
 * The proposal this creates is its own, and it is refused at the end of the run — refused, not
 * deleted: deleting rows in his store is not mine to do.
 */
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "").trim()])
);

const ASK = "نسّق السرب لتغيير عنوان الصفحة الرئيسية — اقترح اقتراحًا يحتاج موافقتي";

let failed = false;
const say = (label, ok, detail = "") => {
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" })).newPage();

try {
  await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
  await page.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
  const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
  await page.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
  await page.click("button[type=submit]");
  for (let i = 0; i < 20 && !page.url().includes("/admin"); i += 1) await page.waitForTimeout(1500);
  say("signed in", page.url().includes("/admin"), page.url());

  const asked = await page.evaluate(async (text) => {
    const before = await (await fetch("/api/admin/agents/messages?agent_key=ops-lead", { cache: "no-store" })).json().catch(() => null);
    const beforeIds = new Set(((before?.data ?? before?.messages ?? []) ).map((m) => m.id));
    const sent = await fetch("/api/admin/agents/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_key: "ops-lead", sender_type: "user", content: text }),
    });
    return { status: sent.status, beforeIds: [...beforeIds] };
  }, ASK);
  say("the ask was accepted", asked.status === 200, `status ${asked.status}`);

  // The reply is written by the store's own brain; wait for a new agent message that carries a number.
  let carrier = null;
  for (let i = 0; i < 16 && !carrier; i += 1) {
    await page.waitForTimeout(5000);
    carrier = await page.evaluate(
      async ({ agent, old }) => {
        const res = await fetch(`/api/admin/agents/messages?agent_key=${agent}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        const rows = ((data?.data ?? data?.messages ?? []) ).filter(
          (m) => m.sender_type === "agent" && !old.includes(m.id) && m.context?.approval_id
        );
        const mine = rows.at(-1);
        return mine ? { id: mine.id, approvalId: mine.context.approval_id, content: String(mine.content ?? "").slice(0, 120) } : null;
      },
      { agent: "ops-lead", old: asked.beforeIds }
    );
  }
  say("the reply message carries the proposal's number", Boolean(carrier), carrier ? `approval ${String(carrier.approvalId).slice(0, 8)}…` : "no message with context.approval_id");
  if (carrier) console.log(`     «${carrier.content}»`);

  await page.goto(`${BASE}/admin/v2/agents/ops?agent=ops-lead`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(9000);
  const blocks = await page.locator("[data-approval-block]").count();
  say("the chat paints the decision block on the message", blocks > 0, `${blocks} block(s) at 390px`);

  if (blocks > 0) {
    const buttons = await page.locator('[data-approval-decision="rejected"]').count();
    say("the three answers are there", buttons > 0 && (await page.locator('[data-approval-decision="approved"]').count()) > 0, `رفض ×${buttons}`);

    await page.locator('[data-approval-decision="rejected"]').first().click();
    await page.waitForTimeout(6000);
    const decided = await page.evaluate(async (id) => {
      const res = await fetch("/api/admin/agents/approval-queue", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      const row = ((data?.approvals ?? []) ).find((r) => r.id === id);
      return row ? { status: row.status ?? null, gone: false } : { status: null, gone: true };
    }, carrier.approvalId);
    say("pressing refuse moved the real row", decided.gone || decided.status === "rejected", decided.gone ? "left the pending queue" : `status ${decided.status}`);

    const outcome = await page.locator("[data-approval-block]").first().innerText();
    say("the message answers back in his Arabic", /رفضت|اتقفل|اتاخدت/.test(outcome), outcome.replace(/\s+/g, " ").slice(0, 90));
  }

  await page.screenshot({ path: "scratch/decision-in-chat-phone.png", fullPage: false });
  console.log("screenshot: scratch/decision-in-chat-phone.png");
} catch (error) {
  say("the walk completed", false, String(error?.message || error).slice(0, 200));
} finally {
  await browser.close();
  if (failed) process.exitCode = 1;
}
