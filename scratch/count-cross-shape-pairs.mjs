import { config as loadEnv } from "dotenv";
import postgres from "postgres";
loadEnv({ path: ".env.local" });
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
const rows = await sql`select id, instruction, created_at from consultant_learnings where instruction like 'سؤال:%' order by created_at`;
const norm = (s) => s.replace(/\s+/g, " ").trim();
const desk = [], door = [];
for (const r of rows) {
  const t = r.instruction;
  if (t.includes("-> إجابة:")) door.push({ id: r.id, q: norm(t.slice(6, t.indexOf("-> إجابة:"))) });
  else if (t.includes("الإجابة:")) desk.push({ id: r.id, q: norm(t.slice(6, t.indexOf("\nالإجابة:") >= 0 ? t.indexOf("\nالإجابة:") : t.length)) });
}
const doorQ = new Set(door.map(d => d.q));
const paired = desk.filter(d => doorQ.has(d.q));
console.log("سطور بشكل المكتب =", desk.length);
console.log("سطور بشكل الباب =", door.length);
console.log("أسئلة طلعت في الشكلين بعضدها (نفس السؤال اتعلّم مرتين) =", paired.length);
for (const p of paired.slice(0, 4)) console.log(" -", p.q.slice(0, 70));
await sql.end();
