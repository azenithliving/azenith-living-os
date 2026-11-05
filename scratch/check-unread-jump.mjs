import fs from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * Does opening the conversation after the swarm has written really put him on the
 * first unread message, or does it drop him at the bottom as if nothing happened?
 *   node scratch/check-unread-jump.mjs [base] [agent]
 *
 * The condition is built from the thread's OWN saved rows — no throwaway message is
 * inserted, so nothing of mine is left in his tables. «He last read at T» is written
 * into the same browser key the panel itself writes when he reaches the bottom, and T
 * is the timestamp of an agent message that has another agent message after it.
 * The positive case names the message the divider must sit above; the negative case
 * must show no divider at all and the thread resting at the bottom.
 */
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const AGENT = process.argv[3] || "ops-lead";
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "").trim()])
);

let failed = false;
const say = (label, ok, detail = "") => {
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
});
page.on("requestfailed", (r) => failedRequests.push(`${r.url().slice(-60)} :: ${r.failure()?.errorText}`));
// My own reloads abort the in-flight poll; that is my instrument, not his cockpit.
// So the console is judged only over a quiet window: nine seconds with no navigation,
// one full poll cycle, where any real door failure would show itself.
const realFailures = () => failedRequests.filter((f) => !f.includes("ERR_ABORTED"));
const quietWindow = async (label) => {
  const errMark = consoleErrors.length;
  const reqMark = realFailures().length;
  await page.waitForTimeout(9000);
  say(`${label}: a whole poll cycle with no new console error`, consoleErrors.length === errMark, consoleErrors.slice(errMark, errMark + 2).join(" | "));
  const fresh = realFailures().slice(reqMark);
  say(`${label}: no request died in it`, fresh.length === 0, fresh.slice(0, 3).join(" | "));
};

const readThread = () =>
  page.evaluate(async (agent) => {
    const res = await fetch(`/api/admin/agents/messages?agent_key=${agent}`);
    const data = await res.json();
    const rows = (data?.data || []).map((m) => ({
      id: m.id,
      sender: m.sender_type,
      at: new Date(m.created_at).getTime(),
      text: String(m.content || "").slice(0, 40),
    }));
    return rows;
  }, AGENT);

const measure = () =>
  page.evaluate(() => {
    const area = document.querySelector("[data-thread-area]");
    if (!area) return { area: false };
    const kids = [...area.children];
    const dividerIndex = kids.findIndex((k) =>
      [...k.querySelectorAll("*")].some((el) => el.children.length === 0 && el.textContent?.trim() === "رسائل جديدة")
    );
    const divider = dividerIndex >= 0 ? kids[dividerIndex] : null;
    const a = area.getBoundingClientRect();
    const line = divider ? [...divider.querySelectorAll("*")].find((el) => !el.children.length && el.textContent?.trim() === "رسائل جديدة") : null;
    return {
      area: true,
      wrappers: kids.length,
      dividerIndex,
      dividerText: divider ? (divider.textContent || "").replace("رسائل جديدة", "").trim().slice(0, 40) : null,
      dividerTop: line ? Math.round(line.getBoundingClientRect().top - a.top) : null,
      dividerInsideViewport: line
        ? (() => {
            const r = line.getBoundingClientRect();
            return r.top >= a.top - 4 && r.bottom <= a.bottom + 4;
          })()
        : null,
      scrollTop: Math.round(area.scrollTop),
      scrollable: Math.round(area.scrollHeight - area.clientHeight),
    };
  });

/**
 * Is the rule I just wrote the rule his browser is running? The bundle keeps the object keys the
 * panel hands to the module, so a shipped copy of `unreadJump` is readable in the loaded scripts.
 */
const bundleCarriesRule = () =>
  page.evaluate(async () => {
    const urls = performance.getEntriesByType("resource").map((r) => r.name).filter((u) => u.endsWith(".js"));
    for (const url of urls) {
      try {
        const text = await (await fetch(url)).text();
        if (text.includes("markerMounted")) return { hit: true, url: url.split("/").pop(), scripts: urls.length };
      } catch {}
    }
    return { hit: false, url: "", scripts: urls.length };
  });

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

  await page.goto(`${BASE}/admin/v2/agents/ops?agent=${AGENT}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(10000);

  // Vercel builds the push on its own clock; the walk is worthless against the previous bundle.
  let shippedEarly = await bundleCarriesRule();
  for (let i = 0; i < 10 && !shippedEarly.hit; i += 1) {
    console.log(`waiting for the new bundle (try ${i + 1}, ${shippedEarly.scripts} scripts read)`);
    await page.waitForTimeout(30000);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(9000);
    shippedEarly = await bundleCarriesRule();
  }
  say("the published cockpit is running the pushed build", shippedEarly.hit === true, shippedEarly.url);

    const rows = await readThread();
    const agents = rows.filter((r) => r.sender === "agent");
    const withAfter = agents.filter((r) => agents.some((x) => x.at > r.at));
    console.log(`row ${rows.length} · agent ${agents.length} · usable ${withAfter.length}`);
    if (withAfter.length === 0) {
      say("a real unread condition exists", false, "the thread has no agent message after another agent message");
    } else {
      // The oldest usable point: everything after it is unread, and it is real history.
      const t = withAfter[0].at;
      const expectFirstUnread = agents.filter((r) => r.at > t).sort((a, b) => a.at - b.at)[0];
      const expectedIndex = rows.findIndex((r) => r.id === expectFirstUnread.id);
      await page.evaluate(
        ([key, value]) => localStorage.setItem(`ops_last_read_${key}`, String(value)),
        [AGENT, t]
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(11000);
      const positive = await measure();
      console.log("positive:", JSON.stringify(positive));
      console.log(`expected unread #${expectedIndex} «${expectFirstUnread.text}»`);
      say("the thread rendered", positive.wrappers > 0, `wrappers ${positive.wrappers}`);
      say("a new-messages divider appears", positive.dividerIndex >= 0);
      say(
        "the divider sits above the first unread, not a later one",
        positive.dividerIndex === expectedIndex,
        `divider #${positive.dividerIndex} expected #${expectedIndex}`
      );
      say("the divider is on his screen, not scrolled off above", positive.dividerInsideViewport === true, `top ${positive.dividerTop}`);
      await page.screenshot({ path: "scratch/unread-jump-phone.png" });
      console.log("positive screenshot: scratch/unread-jump-phone.png");
      await quietWindow("standing on the unread line");

    // Negative: he has read to the very end, so nothing may claim there are new messages.
    await page.evaluate(
      ([key, value]) => localStorage.setItem(`ops_last_read_${key}`, String(value)),
      [AGENT, Date.now() + 60000]
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(11000);
    const negative = await measure();
    console.log("negative:", JSON.stringify(negative));
    say("with nothing unread there is no divider", negative.dividerIndex === -1, `dividerIndex ${negative.dividerIndex}`);
    say(
      "with nothing unread the thread rests at the bottom",
      negative.scrollTop >= negative.scrollable - 40,
      `scrollTop ${negative.scrollTop} / scrollable ${negative.scrollable}`
    );
  }

  await page.screenshot({ path: "scratch/unread-jump-read.png" });
  console.log("negative screenshot: scratch/unread-jump-read.png");
  await quietWindow("resting at the bottom");
} catch (error) {
  say("the walk completed", false, String(error?.message || error).slice(0, 200));
} finally {
  await browser.close();
  if (failed) process.exitCode = 1;
}
