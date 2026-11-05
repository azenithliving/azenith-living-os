const postgres = require("postgres");
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
(async () => {
  const rows = await sql`select sender_name, count(*)::int as n, max(created_at) as newest from public.agent_messages where content like $$%|%$$ and content ~ $$\n\|.*\|$$ and sender_type <> $$user$$ group by 1 order by n desc limit 12`;
  for (const r of rows) console.log(`${r.sender_name}\t${r.n}\t${r.newest}`);
  await sql.end();
})().catch(e => { console.error(e.message); process.exit(1); });
