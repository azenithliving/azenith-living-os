/**
 * Where the English on the owner's screens is written.
 *
 * The rendered census (scratch/census-owner-latin.mjs) counted 137 Latin places left on his ten
 * screens and said what he sees. This says who wrote it. Two suspects, and they need different fixes:
 * text this repository's own templates compose, and text a model wrote into a stored row. A template
 * is repaired at the source; a stored row can only be repaired at the boundary that reads it — and a
 * fix aimed at the wrong suspect changes nothing on his screen.
 *
 *   node scratch/census-english-authors.cjs
 */
const dotenv = require("dotenv");
const { readFileSync } = require("node:fs");
const postgres = require("postgres");

dotenv.config({ path: require("path").join(__dirname, "..", ".env.local") });
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

const ROOT = require("path").join(__dirname, "..");

/** Words that are his own data or an allowed address, not the house's prose. */
const ALLOWED = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$|^(https?|www)|\.(com|ai|io|dev|net|org|vercel\.app)$/i;

async function main() {
  const rows = await sql`
    select sender_name, content, created_at
      from public.agent_messages
     where created_at > now() - interval '30 days'
     order by created_at desc
     limit 900`;
  const tasks = await sql`
    select title, description, task_type, created_at
      from public.agent_tasks
     where created_at > now() - interval '30 days'
     order by created_at desc
     limit 400`;

  const tally = new Map();
  const bump = (word, where) => {
    const cur = tally.get(word) ?? { n: 0, where: new Set() };
    cur.n += 1;
    cur.where.add(where);
    tally.set(word, cur);
  };
  const scan = (text, where) => {
    for (const w of String(text ?? "").match(/[A-Za-z][A-Za-z0-9_./+-]{2,}/g) ?? []) {
      if (ALLOWED.test(w)) continue;
      bump(w.toLowerCase(), where);
    }
  };

  for (const r of rows) scan(r.content, `رسالة (${r.sender_name || "بدون"})`);
  for (const t of tasks) {
    scan(t.title, "عنوان مهمة");
    scan(t.description, "وصف مهمة");
    scan(t.task_type, "نوع مهمة");
  }

  const sorted = [...tally.entries()].sort((a, c) => c[1].n - a[1].n);
  console.log(`صفوف مقروءة: ${rows.length} رسالة + ${tasks.length} مهمة · كلمات مختلفة: ${sorted.length}\n`);

  const authored = sorted.slice(0, 40).map(([word, info]) => ({
    word,
    مرات: info.n,
    من: [...info.where].slice(0, 2).join(" · "),
  }));
  console.table(authored);

  // Which of these words does this repository itself write? That is the suspect a source fix closes.
  // argv array, not a shell string: these words came out of stored rows.
  console.log("\n=== الكلمات اللي المستودع نفسه بيكتبها (بحث في الكود) ===");
  const { execFileSync } = require("node:child_process");
  for (const [word] of sorted.slice(0, 60)) {
    let found = "";
    try {
      found = execFileSync("git", ["-C", ROOT, "grep", "-l", "-i", "-e", word, "--", "*.ts", "*.tsx"], { encoding: "utf8" })
        .trim()
        .split("\n")
        .slice(0, 3)
        .join(" , ");
    } catch {
      found = "";
    }
    if (found) console.log(`  ${word.padEnd(22)} ← ${found}`);
  }
}

main()
  .catch((e) => {
    console.error("failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
