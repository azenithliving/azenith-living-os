/**
 * measure-admin-door-auth.mjs — does the gate's own session satisfy the shared admin guard?
 *
 * The relations health door answers to a bare request header today, while 54 other admin doors ask
 * `requireAdminApi()` (the session cookie plus the authorized-email list). Before moving this door
 * onto the shared guard, measure whether the owner's own login passes it — otherwise the switch
 * would make the door uncallable by the one person it exists for.
 *
 * Read-only: the door under test is the retired recursive-optimization endpoint, which answers 410
 * to an authorized caller and 401/403 to anyone else, and does nothing either way.
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
const say = (s) => {
  lines.push(s);
  console.log(s);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await ctx.newPage();

try {
  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(2500);
  say("after login url=" + page.url());

  const probe = async (path, init) =>
    page.evaluate(
      async ([p, body]) => {
        const r = await fetch(p, {
          method: body ? "POST" : "GET",
          headers: { "content-type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        let text = "";
        try {
          text = (await r.text()).slice(0, 200);
        } catch {}
        return { status: r.status, text };
      },
      [path, init],
    );

  const evolve = await probe("/api/admin/intel/evolve", {});
  say("shared-guard door (retired) status=" + evolve.status + " body=" + evolve.text);

  const health = await probe("/api/admin/intel/relations/health", null);
  say("header door status=" + health.status + " body=" + health.text.slice(0, 200));

  const headerless = await page.evaluate(async () => {
    const r = await fetch("/api/admin/intel/relations/health");
    return { status: r.status, text: (await r.text()).slice(0, 160) };
  });
  say("header door without the header status=" + headerless.status + " body=" + headerless.text);

  const images = await probe("/api/admin/images/stats", null);
  say("images/stats (shared guard) status=" + images.status + " body=" + images.text.slice(0, 120));
} catch (e) {
  say("ERROR: " + String(e && e.message ? e.message : e));
} finally {
  await browser.close();
  writeFileSync("scratch/measure-admin-door-auth.out", lines.join("\n") + "\n");
}
