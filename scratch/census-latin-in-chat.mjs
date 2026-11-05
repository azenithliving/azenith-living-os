import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

/**
 * What his main screen is actually made of.
 *
 * The owner's law is Arabic on his surfaces; the cockpit chat is his most-open screen. This counts
 * the agent-authored rows that carry Latin words, splits them by who wrote them and how old they
 * are, and prints the words themselves — because the fix depends on whether the Latin comes from a
 * template the code writes or from the model answering in the wrong language.
 *
 * Reads are paginated: PostgREST caps one read at 1,000 rows, and a total that lands on 1,000 is
 * the cap, not the count.
 */
dotenv.config({ path: ".env.local" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PAGE = 500;
const rows = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await sb
    .from("agent_messages")
    .select("id,sender_type,sender_name,content,created_at,context")
    .eq("sender_type", "agent")
    .order("created_at", { ascending: false })
    .range(from, from + PAGE - 1);
  if (error) throw new Error(error.message);
  rows.push(...data);
  if (data.length < PAGE) break;
}

const LATIN = /[A-Za-z]{3,}/g;
const scrub = (s) =>
  String(s)
    .replace(/[\w.+-]+@[\w.-]+\.\w+/g, "<بريد>")
    .replace(/https?:\/\/\S+/g, "<رابط>")
    .replace(/\s+/g, " ")
    .trim();

const now = Date.now();
const DAY = 86400000;
const byAuthor = new Map();
const words = new Map();
let latinRows = 0;
let latinRecent = 0;
const samples = [];

for (const r of rows) {
  const hits = String(r.content || "").match(LATIN) ?? [];
  const who = r.sender_name || "(بلا اسم)";
  const bucket = byAuthor.get(who) ?? { total: 0, latin: 0 };
  byAuthor.set(who, bucket);
  bucket.total += 1;
  if (hits.length) {
    bucket.latin += 1;
    latinRows += 1;
    const age = (now - new Date(r.created_at).getTime()) / DAY;
    if (age <= 30) latinRecent += 1;
    for (const w of hits) words.set(w, (words.get(w) ?? 0) + 1);
    if (samples.length < 6) samples.push({ who, age: Math.round(age), text: scrub(r.content).slice(0, 150) });
  }
}

console.log(`agent rows ${rows.length} · carrying Latin ${latinRows} · of those written in the last 30 days ${latinRecent}`);
console.log("\nby author (rows · carrying Latin)");
[...byAuthor.entries()]
  .sort((a, b) => b[1].latin - a[1].latin)
  .forEach(([who, b]) => console.log(`  ${who}: ${b.total} · ${b.latin}`));

console.log("\ntop Latin words (occurrences)");
[...words.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)
  .forEach(([w, n]) => console.log(`  ${w}: ${n}`));

console.log("\nsamples");
samples.forEach((s) => console.log(`  [${s.who} · ${s.age} يوم] ${s.text}`));

const toolRows = rows.filter((r) => r.context?.tool).length;
console.log(`\nrows that carry a tool record: ${toolRows} of ${rows.length}`);
