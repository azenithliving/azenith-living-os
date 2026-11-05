/**
 * measure-strip-window.mjs — why a fresh refusal does (or does not) reach the owner's strip.
 *
 * The strip door and the door that writes the row must agree on which company's ledger they read.
 * This writes one refusal through the real door, reads the row back, and asks the strip door.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";
const MARK = "قياس-نافذة-الشريط";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(1 + l.indexOf("=")).trim().replace(/^["']|["']$/g, "")]),
);

const out = [];
const say = (s) => {
  out.push(s);
  console.log(s);
};

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
let browser = null;
try {
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

  const ran = await page.evaluate(async ([marker]) => {
    const r = await fetch("/api/admin/ops?action=constitution", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentKey: "ops-lead",
        actionType: "publish",
        content: "",
        proposedChanges: [],
        targetPage: "",
        targetSection: "",
        evidenceUrls: [],
        humanApproval: false,
        draft_id: marker,
      }),
    });
    return { status: r.status, body: (await r.text()).slice(0, 80) };
  }, [MARK]);
  say(`door call → ${ran.status} ${ran.body}`);

  await page.waitForTimeout(2500);

  const row = await sql`
    select id, company_id, event_type, created_at from public.ops_sync_events
    where payload->>'draftId'=${MARK} order by created_at desc limit 1`;
  say("row written: " + (row.length ? `id=${row[0].id} company=${String(row[0].company_id).slice(0, 8)} type=${row[0].event_type}` : "none"));

  const strip = await page.evaluate(async () => {
    const r = await fetch("/api/admin/notifications?limit=100");
    const text = await r.text();
    return { status: r.status, head: text.slice(0, 400) };
  });
  say(`strip door → ${strip.status} body=${strip.head}`);

  const companies = await sql`select id, name from public.companies order by created_at limit 3`;
  say("companies in the record: " + companies.map((c) => `${String(c.id).slice(0, 8)}/${c.name}`).join(" · "));

  const windowRows = await sql`
    select count(*)::int c from public.ops_sync_events
    where event_type = any(array['quality_gate_failed','agent_task_failed','owner_review_needed'])
      and created_at > now() - interval '1 hour'`;
  say("alert-type rows in the last hour: " + windowRows[0].c);

  if (row.length) await sql`delete from public.ops_sync_events where id=${row[0].id}`;
  const left = await sql`select count(*)::int c from public.ops_sync_events where payload->>'draftId'=${MARK}`;
  say("rows left behind: " + left[0].c);
} catch (e) {
  say("INSTRUMENT ERROR: " + String(e && e.message ? e.message : e).slice(0, 200));
} finally {
  if (browser) await browser.close().catch(() => {});
  await sql.end({ timeout: 5 }).catch(() => {});
  writeFileSync("scratch/measure-strip-window.out", out.join("\n") + "\n");
}
