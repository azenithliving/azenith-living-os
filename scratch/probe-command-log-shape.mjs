import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

/**
 * Why does the command log stay empty while the statistics command reads it?
 * Reads the table's own guard rails and columns from the catalog — nothing is written.
 */
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const policies = await db.$queryRawUnsafe(
  "select policyname, cmd, roles::text[] as roles, permissive, qual::text as using_expr, with_check from pg_policies where tablename = 'immutable_command_log'"
);
console.log("policies:", JSON.stringify(policies, (k, v) => (typeof v === "bigint" ? Number(v) : v)));

const rls = await db.$queryRawUnsafe(
  "select relrowsecurity, relforcerowsecurity from pg_class where relname = 'immutable_command_log'"
);
console.log("row level security:", JSON.stringify(rls));

const grants = await db.$queryRawUnsafe(
  "select grantee, privilege_type from information_schema.role_table_grants where table_name = 'immutable_command_log' order by grantee, privilege_type"
);
console.log("grants:", grants.map((g) => `${g.grantee}:${g.privilege_type}`).join(" "));

const columns = await db.$queryRawUnsafe(
  "select column_name, data_type, is_nullable, column_default from information_schema.columns where table_name = 'immutable_command_log' order by ordinal_position"
);
console.log(
  "columns:",
  columns.map((c) => `${c.column_name}:${c.data_type}${c.is_nullable === "NO" && !c.column_default ? " REQUIRED" : ""}`).join(" | ")
);

await db.$disconnect();
