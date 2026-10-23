import { NextResponse } from "next/server";

import { resolvePrimaryCompanyId } from "@/lib/company-resolver";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { MEMORY_WRITE_COLUMNS } from "@/lib/ops/memory-record";

type RelationCheck = {
  table: string;
  requiredColumns: string[];
  missingColumns: string[];
  readFailed: boolean;
  healthy: boolean;
};

const REQUIRED_RELATIONS: Array<{ table: string; columns: string[] }> = [
  { table: "automation_rules", columns: ["company_id", "enabled", "is_active"] },
  { table: "approval_requests", columns: ["company_id", "actor_user_id", "command_log_id"] },
  { table: "audit_log", columns: ["company_id", "actor_user_id", "approval_request_id", "command_log_id"] },
  { table: "agent_memory", columns: [...MEMORY_WRITE_COLUMNS] },
];

export async function GET(request: Request) {
  const actorId = request.headers.get("x-admin-user-id");
  if (!actorId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Supabase admin client unavailable" },
      { status: 500 }
    );
  }

  const companyId = await resolvePrimaryCompanyId();
  const checks: RelationCheck[] = [];

  for (const relation of REQUIRED_RELATIONS) {
    const { data, error } = await supabase
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", relation.table);

    if (error || (data || []).length === 0) {
      // PostgREST cannot see a system view, so this read answers with nothing for every table
      // (measured on the published link 2026-10-24: all four tables came back "missing" every one
      // of its columns, including the ones the record had been answering to for weeks). A table
      // the door cannot read is reported as unreadable — not as a schema fault.
      checks.push({
        table: relation.table,
        requiredColumns: relation.columns,
        missingColumns: [],
        readFailed: true,
        healthy: false,
      });
      continue;
    }

    const existing = new Set((data || []).map((row: { column_name: string }) => row.column_name));
    const missingColumns = relation.columns.filter((column) => !existing.has(column));
    checks.push({
      table: relation.table,
      requiredColumns: relation.columns,
      missingColumns,
      readFailed: false,
      healthy: missingColumns.length === 0,
    });
  }

  const healthy = checks.every((check) => check.healthy);
  const totalMissing = checks.reduce((sum, check) => sum + check.missingColumns.length, 0);
  const unreadableTables = checks.filter((check) => check.readFailed).map((check) => check.table);
  const gapTables = checks.filter((check) => !check.healthy && !check.readFailed).map((check) => check.table);

  return NextResponse.json({
    success: true,
    message: unreadableTables.length > 0
      ? `Schema read unavailable for: ${unreadableTables.join(", ")}`
      : healthy
        ? "Intel relation schema is healthy"
        : "Intel relation schema needs migration sync",
    data: {
      healthy,
      totalMissing,
      unreadableTables,
      checks,
    },
    meta: {
      actorId,
      companyId,
      migrationHint:
        gapTables.length > 0
          ? `Measured gaps in: ${gapTables.join(", ")}`
          : unreadableTables.length > 0
            ? "No gap measured — this door cannot read the schema"
            : "No table is missing a column the code writes",
    },
  });
}
