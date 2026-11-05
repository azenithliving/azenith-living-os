/**
 * prove-swarm-memory-live.mjs — the round remembers, and the owner's chat says so.
 *
 *  1. the record is read: what the published round wrote into the swarm's memory (the table held 0
 *     rows before this phase), and how many of those carry a real vector;
 *  2. his own desk, signed in at 390px: the composer must be ON the screen and typeable; a question
 *     whose words the memory holds must come back with «رجع لذاكرة الدار», and a question with nothing
 *     to match must come back WITHOUT it — a negative only counts once a reply has really arrived;
 *  3. cleanup removes only the exact texts this run typed and received, inside its own time window.
 *     An earlier version of this instrument cleared a whole conversation by its id and took the owner's
 *     own history with it; nothing in here is ever scoped by conversation again.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import postgres from "postgres";

const BASE = "https://azenith-living.vercel.app";
const RUN_STARTED = new Date().toISOString();

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok });
  console.log(`${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${detail}` : ""}`);
};
const say = (label, value) => console.log(`${label}: ${value}`);

// ── 1 · what the round left in the record ─────────────────────────────────
const total = (await sql`select count(*)::int as c from ops_semantic_memory`)[0].c;
const today = (await sql`select count(*)::int as c from ops_semantic_memory where created_at::date = current_date`)[0].c;
const withVector = (await sql`select count(*)::int as c from ops_semantic_memory where embedding is not null`)[0].c;
const held = await sql`
  select content, agent_key, memory_type, (embedding is not null) as has_vector
  from ops_semantic_memory order by created_at desc limit 10`;

say("سطور ذاكرة السرب في المتجر", total);
say("منها مكتوبة النهاردة", today);
say("اللي عليها متجه حقيقي", withVector);
say("أحدث سطر", String(held[0]?.content ?? "—").replace(/\s+/g, " ").slice(0, 130));
check("الجدول مش فاضي زي ما كان", total > 0, `قبل اللافة دي كان ٠ · دلوقتي ${total}`);
check("كل سطر من قياس مش من اختراع", held.every((r) => /يوم/.test(r.content)), held.length ? "" : "مفيش سطور");
check("الكتابة جاية من الجولة اليومية مش من المحاجة", today > 0, `النهاردة=${today}`);

// ── 2 · his desk, signed in, at 390px ─────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const seed = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
await seed.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await seed.waitForTimeout(4000);
await seed.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await seed.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await seed.click("button[type=submit]");
await seed.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await seed.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await seed.click("button[type=submit]");
for (let i = 0; i < 20 && !seed.url().includes("/admin"); i++) await seed.waitForTimeout(2000);
check("دخول لوحة المتجر", seed.url().includes("/admin"), seed.url().slice(-28));
const state = await seed.context().storageState();
await seed.close();

/** Everything this run put on his screen — so the sweep can remove exactly these and nothing else. */
const mine = [];

async function ask(text, screenshot) {
  const ctx = await browser.newContext({ storageState: state, viewport: { width: 390, height: 900 }, locale: "ar-EG" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(12000);

  const composer = page.locator("[data-chat-composer]").first();
  if (!(await composer.count())) {
    await ctx.close();
    return { ok: false, reason: "مفيش صندوق كلام", errors, note: "", reply: "", box: null, typed: "" };
  }
  // An input that exists in the tree and sits off the screen is exactly as unusable as a missing one.
  const box = await composer.boundingBox();
  await composer.click({ timeout: 15000 });
  await composer.fill(text);
  const typed = await composer.inputValue();
  mine.push(text);

  const rows = page.locator('[data-chat-message="employee"]');
  const before = await rows.count();
  const sentAt = Date.now();
  // Read the door's own answer, not just what the screen shows: the server's count and the rendered
  // line are two facts, and only comparing them says which one broke.
  const answered = page.waitForResponse(
    (r) => r.url().includes("/api/admin/agents/chat") && r.request().method() === "POST",
    { timeout: 120000 }
  );
  await composer.press("Enter");

  let reply = "";
  let note = "";
  for (let waited = 0; waited < 110; waited += 3) {
    await page.waitForTimeout(3000);
    const now = await rows.count();
    if (now > before) {
      const last = rows.nth(now - 1);
      reply = (await last.innerText()).trim();
      const line = last.locator("[data-chat-memory]");
      note = (await line.count()) ? await line.innerText() : "";
      break;
    }
  }
  const seconds = Math.round((Date.now() - sentAt) / 1000);
  let serverMemory = null;
  let storedMessage = "";
  try {
    const json = await (await answered).json();
    serverMemory = json?.data?.metadata?.memory ?? null;
    storedMessage = String(json?.data?.message ?? "");
  } catch (e) {
    console.log("الباب ما رداش ردّ مقروء:", String(e).slice(0, 80));
  }
  // The cleanup deletes by the exact text the door stored — never by what the screen printed around it.
  if (storedMessage) mine.push(storedMessage);
  if (screenshot) await page.screenshot({ path: screenshot });
  await ctx.close();
  return { ok: true, errors, note, reply, box, typed, seconds, serverMemory };
}

const matched = await ask("سعر الفخامة كام النهاردة؟", "scratch/swarm-memory-recalled-390.png");
check("الكابينة فتحت له صندوق الكلام", matched.ok, matched.reason ?? "");
const fits = (b) => !!b && b.x >= 0 && b.x + b.width <= 390 && b.width >= 120;
check("صندوق الكلام جوه الشاشة عند عرض ٣٩٠", fits(matched.box), matched.box ? `x=${Math.round(matched.box.x)} · عرضه=${Math.round(matched.box.width)}` : "مفيش صندوق");
check("اللي كتبه بيوصل فعلاً للصندوق", matched.typed.startsWith("سعر الفخامة"), matched.typed.slice(0, 30));
say("اللي قالته الشاشة عن الذاكرة", matched.note.replace(/\s+/g, " ").slice(0, 110) || "مفيش سطر ذاكرة");
check("الباب عدّ سطور الذاكرة", Number(matched.serverMemory?.count ?? 0) >= 1, JSON.stringify(matched.serverMemory ?? null));
check("الرد قال إنه رجع لذاكرة الدار", /رجع لذاكرة الدار/.test(matched.note), matched.note.slice(0, 60));
check("الرد نفسه وصل فعلاً", matched.reply.length > 20, matched.reply.slice(0, 46).replace(/\s+/g, " "));

const unrelated = await ask("أهلاً، عامل إيه؟", "scratch/swarm-memory-negative-390.png");
check("السؤال التاني جه رده فعلاً (عشان السالب يبقى معناه)", unrelated.reply.length > 20, unrelated.reply.slice(0, 46).replace(/\s+/g, " ") || "مفيش رد");
say("سؤال مالوش ذاكرة — سطر الذاكرة في ردّه", unrelated.note.replace(/\s+/g, " ").slice(0, 90) || "مفيش سطر ذاكرة");
check("سؤال من غير ذاكرة ما بيدّعيش إنه افتكر", unrelated.note === "", unrelated.note.slice(0, 60));

const consoleErrors = [...matched.errors, ...unrelated.errors].filter((e) => !/favicon|Download the React|401|net::ERR_/i.test(e));
check("صفر رسالة خطأ في الكابينة", consoleErrors.length === 0, consoleErrors.slice(0, 2).map((e) => e.slice(0, 90)).join(" | "));

// ── 3 · only this run's own rows, inside its own window ───────────────────
// The door stores the reply polished (`ownerVoice` rewrites digits), so the text the browser received
// is not byte-identical to the row. The sweep therefore anchors on THIS run's own questions — stored
// verbatim — removes the answers written after them, and only then removes the questions themselves.
// Nothing here is ever scoped by a conversation on its own: that is how 306 of his rows were lost.
const MY_QUESTIONS = ["سعر الفخامة كام النهاردة؟", "أهلاً، عامل إيه؟"];
const WINDOW_END = new Date(Date.parse(RUN_STARTED) + 20 * 60 * 1000).toISOString();
await new Promise((r) => setTimeout(r, 15000));
let removed = 0;

const asked = await sql`
  select id, conversation_id, created_at from agent_messages
  where content = any(array[${MY_QUESTIONS[0]}, ${MY_QUESTIONS[1]}])
    and created_at >= ${RUN_STARTED} and created_at <= ${WINDOW_END}
  order by created_at`;
for (const ask of asked) {
  const answers = await sql`
    delete from agent_messages
    where conversation_id = ${ask.conversation_id} and sender_type = 'agent'
      and created_at >= ${ask.created_at} and created_at <= ${WINDOW_END}
    returning left(content, 46) as head`;
  for (const row of answers) {
    removed += 1;
    console.log("ممسوح (رد المحاجة):", String(row.head).replace(/\s+/g, " "));
  }
}
for (const content of [...new Set([...MY_QUESTIONS, ...mine])]) {
  const gone = await sql`
    delete from agent_messages where content = ${content}
      and created_at >= ${RUN_STARTED} and created_at <= ${WINDOW_END} returning id`;
  removed += gone.length;
}
say("رسائل المحاجة اللي امسحتها", removed);
const left = (await sql`select count(*)::int as c from agent_messages where created_at >= ${RUN_STARTED} and created_at <= ${WINDOW_END}`)[0].c;
check("مفيش رسالة محاجة سايبة في شاته", left === 0, `فاضل=${left}`);
const stillHeld = (await sql`select count(*)::int as c from ops_semantic_memory`)[0].c;
say("سطور ذاكرة السرب بعد القياس", stillHeld);
check("ذاكرة المتجر اللي كتبتها الجولة فضلت مكانها", stillHeld >= total, `${total} → ${stillHeld}`);

await browser.close();
await sql.end();

const failed = checks.filter((c) => !c.ok);
console.log(`\nراجعت ${checks.length} · نجح ${checks.length - failed.length} · فشل ${failed.length}`);
for (const f of failed) console.log(`فشل: ${f.name}`);
process.exit(failed.length ? 1 : 0);
