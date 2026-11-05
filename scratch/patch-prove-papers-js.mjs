import fs from "node:fs";

const f = "scratch/prove-papers-have-owner.mjs";
let t = fs.readFileSync(f, "utf8");

const pairs = [
  ["const myPapers: string[] = [];", "const myPapers = [];"],
  ["const errors: string[] = [];", "const errors = [];"],
  [
    "const call = (url: string, init?: Record<string, unknown>) =>",
    "const call = (url, init) =>",
  ],
  [
    '{ ...(i as object), headers: { "Content-Type": "application/json", ...((i as any)?.headers || {}) } }',
    '{ ...i, headers: { "Content-Type": "application/json", ...(i && i.headers ? i.headers : {}) } }',
  ],
  ["}, [url, init ?? {}] as [string, Record<string, unknown>]);", "}, [url, init ?? {}]);"],
  [
    "(queue.body?.approvals ?? []).map((r: { id: string }) => String(r.id))",
    "(queue.body?.approvals ?? []).map((r) => String(r.id))",
  ],
  [
    "(dash1.body?.data?.pending_decisions ?? []).map((r: { id: string }) => String(r.id))",
    "(dash1.body?.data?.pending_decisions ?? []).map((r) => String(r.id))",
  ],
  [
    "select status, company_id from approval_requests",
    "select status, company_id, approved_at from approval_requests",
  ],
  [
    'check("واتسجلت في الأعمدة الموجودة", orphanRow?.status === "approved" && Boolean(orphanRow?.approved_flag), "");',
    'check("واتسجلت في الأعمدة الموجودة", orphanRow?.status === "approved" && Boolean(orphanRow?.approved_at), JSON.stringify(orphanRow ?? {}).slice(0, 120));',
  ],
];

for (const [from, to] of pairs) {
  if (!t.includes(from)) throw new Error("not found: " + from.slice(0, 60));
  t = t.split(from).join(to);
}

fs.writeFileSync(f, t);
const leftovers = [...t.matchAll(/:\s*(string\[\]|Record<|any\b|object\b)/g)].map((m) => m[0]);
console.log("leftover TS annotations:", JSON.stringify(leftovers.slice(0, 8)));
console.log("approved_flag gone:", !t.includes("approved_flag"));
