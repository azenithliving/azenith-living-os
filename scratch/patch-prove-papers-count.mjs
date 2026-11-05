import fs from "node:fs";

const f = "scratch/prove-papers-have-owner.mjs";
let t = fs.readFileSync(f, "utf8");

const from = `  const queueCount = (await sql\`
    select count(*)::int c from approval_requests
    where status = 'pending' and (company_id = \${COMPANY} or company_id is null)\`)[0].c;
  check("العدّاد نفسه اللي الجنب بيقوله", queueCount === afterOrphan.total + 1 || queueCount >= before.total,
    \`المجموعة \${queueCount} · الإجمالي المسجّل \${before.total}\`);`;

const to = `  // The badge and this screen must be counting one set, read through the same answer.
  const queue2 = await call("/api/admin/agents/approval-queue");
  const deskCount = (queue2.body?.approvals ?? []).length;
  const dashCount = Number(dash1.body?.data?.today?.pending_approvals ?? -1);
  check("العدّاد في الكابينة وفي اللوحة رقم واحد", dashCount === deskCount,
    \`اللوحة \${dashCount} · مكتب القرار \${deskCount}\`);
  check("اللوحة بتعرض الورق فعلاً", (dash1.body?.data?.pending_decisions ?? []).length > 0,
    \`معروض \${(dash1.body?.data?.pending_decisions ?? []).length}\`);`;

if (!t.includes(from)) throw new Error("the block to replace was not found");
t = t.split(from).join(to);
fs.writeFileSync(f, t);
console.log("patched");
