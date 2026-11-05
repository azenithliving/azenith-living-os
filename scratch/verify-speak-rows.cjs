const postgres = require("postgres");
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
(async () => {
  const ids = ["0380cc19-c5f4-4505-b596-91bf9aa824c4","e6432fe7-1868-4075-947f-6426f5310dca","26c67935-4fa0-4b17-9751-1fa9ed41c066"];
  const rows = await sql`select id, content from public.agent_messages where id in ${sql(ids)}`;
  for (const r of rows) {
    const t = String(r.content);
    console.log(`${String(r.id).slice(0,8)} فيه مللي ثانية: ${t.includes("مللي ثانية")} · فيه ms: ${/\d\s*ms/.test(t)} · فيه N/A: ${t.includes("N/A")} · أول ٧٠: ${t.slice(0,70).replace(/\n/g," ")}`);
  }
  const left = await sql`select count(*)::int as n from public.agent_messages where sender_type <> $$user$$ and content ~ $$N/A$$`;
  console.log(`صفوف لسه فيها N/A: ${left[0].n}`);
  await sql.end();
})().catch(e => { console.error(e.message); process.exit(1); });
