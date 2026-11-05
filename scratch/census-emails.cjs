const postgres = require("postgres");

/**
 * How an e-mail address reaches his eyes.
 *
 * The bidi census left two lines whose bracket holds a Latin address («أحمد منصور
 * (ahmed.mansour@example.com):»), and the sales roll prints addresses the same way. Before choosing
 * between dropping the bracket, moving the address to its own line, or isolating it, read the shapes
 * that are actually stored.
 */
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

(async () => {
  const rows = await sql`
    select content, sender_name, sender_type from public.agent_messages
     where content ~ '@[A-Za-z0-9.-]+\\.[A-Za-z]' limit 4000`;
  const shapes = new Map();
  let lines = 0;
  for (const r of rows) {
    for (const raw of String(r.content).split(/\r?\n/)) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (!line.includes("@")) continue;
      const found = line.match(EMAIL) ?? [];
      if (!found.length) continue;
      lines += 1;
      const ar = /[٠-٩\u0600-\u06FF]/.test(line.replace(EMAIL, ""));
      const bracketed = /\([^()]*@[^()]*\)/.test(line);
      const key = `${ar ? "سطر عربي" : "سطي أجنبي"} · ${bracketed ? "جوه قوسين" : "من غير قوسين"} · ${found.length > 1 ? `${found.length} عنوان` : "عنوان واحد"}`;
      shapes.set(key, (shapes.get(key) ?? 0) + 1);
    }
  }
  console.log(`سطور فيها عنوان بريد: ${lines}`);
  for (const [k, n] of [...shapes.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${k}`);

  const emails = await sql`
    select count(*)::int n, count(*) filter (where email ~ '[٠-٩]')::int arabic_digits
      from public.users where email is not null`;
  console.log(`عناوين في جدول العملاء: ${emails[0].n} · منها فيها أرقام عربية: ${emails[0].arabic_digits}`);
  await sql.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
