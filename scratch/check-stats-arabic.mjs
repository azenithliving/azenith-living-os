/**
 * Does the statistics command answer this owner in his Arabic, on the published site?
 *   node scratch/check-stats-arabic.mjs [base]
 *
 * The unit guards prove the sentence; this proves the route he actually types into — the assistant
 * door behind his sign-in — and reads back whatever it replies. Two shapes are asked: the command
 * line itself, and the Arabic sentence an owner would type. A Latin run in either answer is a
 * finding, not a formatting nit: he reads Arabic only.
 */
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import fs from "fs";

const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")])
);

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();

const ask = (message) =>
  p.evaluate(async (text) => {
    const res = await fetch("/api/admin/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, reply: String(data?.reply ?? data?.error ?? ""), kind: String(data?.type ?? "") };
  }, message);

let failed = false;
const say = (label, ok, detail = "") => {
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

try {
  await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
  await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
  await p.click("button[type=submit]");
  await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
  const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
  await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
  await p.click("button[type=submit]");
  for (let i = 0; i < 20 && !p.url().includes("/admin"); i += 1) await p.waitForTimeout(1500);
  say("signed in from the script", p.url().includes("/admin"), p.url());

  for (const question of ["show_stats 7", "اعرض إحصائيات الأوامر لآخر ٧ أيام"]) {
    const answer = await ask(question);
    /**
     * The door quotes his own words back («طلبك: …») before it answers. Measured 2026-10-06: the
     * first version of this instrument counted a Latin run inside HIS typed command as a defect in
     * the store's prose — an instrument bug dressed as a finding. Only the store's own sentence is
     * measured here.
     */
    const own = answer.reply.replace(/طلبك:\s*«[^»]*»/g, "");
    const latin = own.match(/[A-Za-z]{4,}/g) ?? [];
    const western = own.match(/[0-9]/g) ?? [];
    console.log(`\n«${question}» → http ${answer.status} · نوع ${answer.kind || "—"}\n${answer.reply.replace(/\s+/g, " ").slice(0, 300)}`);
    say("the answer arrived", answer.status === 200 && answer.reply.length > 0);
    say("no English sentence in the store's own words", latin.length === 0, latin.slice(0, 4).join(" "));
    say("his numerals, not Latin ones", western.length === 0, western.slice(0, 6).join(""));
    say("it says the window it measured", own.includes("آخر"), own.slice(0, 60));
  }
} catch (error) {
  say("the walk completed", false, String(error.message || error).slice(0, 200));
} finally {
  await b.close();
  if (failed) process.exitCode = 1;
}
