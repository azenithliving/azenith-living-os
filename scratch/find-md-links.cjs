const postgres = require("postgres");
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
(async () => {
  const rows = await sql`select sender_name, count(*)::int as n, max(created_at)::date as newest from public.agent_messages where content like $$%](http%$$ group by 1 order by n desc`;
  for (const r of rows) console.log(`${r.sender_name}\t${r.n}\t${r.newest}`);
  const one = await sql`select content from public.agent_messages where content like $$%](http%$$ order by created_at desc limit 1`;
  const line = String(one[0]?.content ?? "").split(/\r?\n/).find((l) => l.includes("](http")) ?? "";
  console.log("\nأحدث سطر: " + line.slice(0, 150));
  await sql.end();
})().catch(e => { console.error(e.message); process.exit(1); });
