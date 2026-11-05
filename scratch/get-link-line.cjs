const postgres = require("postgres");
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
(async () => {
  const rows = await sql`select id, content from public.agent_messages where content like $$%رابط غير موثق%$$ limit 3`;
  console.log("صفوف:", rows.length);
  for (const r of rows) {
    const line = String(r.content).split(/\r?\n/).find((l) => l.includes("رابط غير موثق")) ?? "";
    console.log(JSON.stringify(line));
  }
  await sql.end();
})().catch(e => { console.error(e.message); process.exit(1); });
