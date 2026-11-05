/**
 * prove-cache-verdict.mjs — the cache tier on the published link, with nowhere to store.
 *
 * Claims under attack:
 *   1. the record still has no `semantic_cache` relation, so the verdict the deployment measures is
 *      «absent» — the tier is not skipping because a test told it to,
 *   2. the customer consultant still answers, in his Arabic, after the tier stopped querying,
 *   3. the admin surface that used the same cache still answers,
 *   4. the consultant screen renders at phone width with no console error.
 *
 * That the code no longer sends the refused query is proven by the counted calls in
 * tests/ops/cacheStorageVerdict.test.ts; a refusal inside a server function is not visible from here.
 *
 * This instrument writes a customer conversation only through the consultant's own door, and cleans
 * up the rows it created by the ids the door handed back.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";

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
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok) });
  const s = `${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${detail}` : ""}`;
  lines.push(s);
  console.log(s);
};

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
let browser = null;
const createdIds = [];

try {
  // 1. the record's own answer, from outside the app.
  const restUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const restKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const probe = await fetch(`${restUrl}/rest/v1/semantic_cache?select=id&limit=1`, {
    headers: { apikey: restKey, Accept: "application/json" },
  });
  const probeText = await probe.text();
  const probeCode = (probeText.match(/"code":"([^"]+)"/) ?? [])[1] ?? "-";
  say("the record's answer about the cache table", `status=${probe.status} code=${probeCode}`);
  check("the record has no cache table, so the live verdict is absent", probe.status >= 400 && probeCode === "PGRST205", `code=${probeCode}`);

  const rpc = await sql`select count(*)::int c from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='record_cache_hit'`;
  say("the cache-hit function in the record", rpc[0].c);
  check("the function the cache hits also does not exist", rpc[0].c === 0);

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

  // 3. the admin surface that used the same cache.
  const arsenal = await page.evaluate(async () => {
    const r = await fetch("/api/admin/arsenal");
    const text = await r.text();
    return { status: r.status, bytes: text.length, head: text.slice(0, 90) };
  });
  say("admin arsenal door", `status=${arsenal.status} bytes=${arsenal.bytes}`);
  check("the arsenal door answers", arsenal.status === 200, arsenal.head);

  // 2. the customer consultant, on the live path that used to ask the missing table.
  const asked = "كم بياخد الوقت تنفيذ غرفة نوم؟";
  const chat = await page.evaluate(async ([question]) => {
    const started = Date.now();
    const r = await fetch("/api/consultant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: question, sessionId: "cache-verdict-proof" }),
    });
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: r.status, ms: Date.now() - started, reply: json && typeof json.reply === "string" ? json.reply : null, head: text.slice(0, 120) };
  }, [asked]);

  say("consultant answer", `status=${chat.status} ms=${chat.ms} reply bytes=${chat.reply ? chat.reply.length : 0}`);
  check("the consultant still answers", chat.status === 200 && Boolean(chat.reply), chat.head);
  check(
    "the answer is his Arabic, not a cache placeholder",
    Boolean(chat.reply) && /[\u0600-\u06FF]/.test(chat.reply) && !/\[Would generate/.test(chat.reply),
    (chat.reply ?? "").slice(0, 80)
  );

  // 4. the surface the consultant lives on. Measured: there is no /consultant page — the advisor is
  // mounted by the root layout, so the customer home page is where it must answer.
  consoleErrors.length = 0;
  await page.goto(`${SITE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  const surface = await page.evaluate(() => {
    const text = document.body.innerText.replace(/\s+/g, " ");
    return { chars: text.length, advisor: /مستشار أزينث/.test(text) };
  });
  say("home page text at 390px", surface.chars);
  say("advisor bubble present", String(surface.advisor));
  check("the customer page renders", surface.chars > 400, `chars=${surface.chars}`);
  check("the advisor is on the page the cache serves", surface.advisor);
  check("no console error on the consultant surface", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
  await page.screenshot({ path: "scratch/cache-verdict-consultant-390.png", fullPage: false });
} catch (error) {
  say("INSTRUMENT ERROR", String(error && error.message ? error.message : error).slice(0, 200));
  checks.push({ name: "instrument completed", ok: false });
} finally {
  if (browser) await browser.close().catch(() => {});
  // The consultant persists the conversation under the session id this run invented, so the
  // cleanup matches its own marker and cannot touch a real customer's row.
  const MARK = "cache-verdict-proof";
  const sessions = await sql`select id from public.consultant_sessions where session_id=${MARK}`;
  const pending = await sql`select id from public.consultant_pending_questions where session_id=${MARK}`;
  say("rows left by the instrument", `sessions=${sessions.length} pending=${pending.length}`);
  if (sessions.length || pending.length) {
    const sids = sessions.map((r) => r.id);
    const pids = pending.map((r) => r.id);
    if (sids.length) await sql`delete from public.consultant_sessions where id = ANY(${sids})`;
    if (pids.length) await sql`delete from public.consultant_pending_questions where id = ANY(${pids})`;
    const afterSessions = await sql`select id from public.consultant_sessions where session_id=${MARK}`;
    const afterPending = await sql`select id from public.consultant_pending_questions where session_id=${MARK}`;
    say("rows after cleanup", `sessions=${afterSessions.length} pending=${afterPending.length}`);
  }
  void createdIds;
  await sql.end({ timeout: 5 }).catch(() => {});
  const passed = checks.filter((c) => c.ok).length;
  say("RESULT", `${passed} of ${checks.length}`);
  writeFileSync("scratch/prove-cache-verdict.out", lines.join("\n") + "\n");
}
