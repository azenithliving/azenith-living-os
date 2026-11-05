import { config as loadEnv } from "dotenv";
import postgres from "postgres";
loadEnv({ path: ".env.local" });
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
const total = await sql`select count(*)::int as n from consultant_learnings`;
const compiled = await sql`select count(*)::int as n from consultant_learnings where instruction like 'سؤال:%-> إجابة:%'`;
const deskShape = await sql`select count(*)::int as n from consultant_learnings where instruction like 'سؤال:%' and instruction like '%الإجابة:%'`;
const pairs = await sql`
  select count(*)::int as n from (
    select regexp_replace(instruction, '\s+', '', 'g') as k
    from consultant_learnings
    where instruction like 'سؤال:%'
    group by 1 having count(*) > 1
  ) t`;
console.log("الإجمالي =", total[0].n);
console.log("شكل الباب (سؤال ... -> إجابة) =", compiled[0].n);
console.log("شكل المكتب (سؤال ... الإجابة:) =", deskShape[0].n);
console.log("سطور مكررة بنفس النص بعد تسفيف الفواصل =", pairs[0].n);
await sql.end();
