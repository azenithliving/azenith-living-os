import { NextResponse } from "next/server";

import { resolvePrimaryCompanyId } from "@/lib/company-resolver";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type RelationCheck = {
  table: string;
  requiredColumns: string[];
  missingColumns: string[];
  healthy: boolean;
};

const REQUIRED_RELATIONS: Array<{ table: string; columns: string[] }> = [
  { table: "automation_rules", columns: ["company_id", "enabled", "is_active"] },
  { table: "approval_requests", columns: ["company_id", "actor_user_id", "command_log_id"] },
  { table: "audit_log", columns: ["company_id", "actor_user_id", "approval_request_id", "command_log_id"] },
  { table: "agent_memory", columns: ["company_id", "actor_user_id", "source_table", "source_id"] },
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

    if (error) {
      checks.push({
        table: relation.table,
        requiredColumns: relation.columns,
        missingColumns: relation.columns,
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
      healthy: missingColumns.length === 0,
    });
  }

  const healthy = checks.every((check) => check.healthy);
  const totalMissing = checks.reduce((sum, check) => sum + check.missingColumns.length, 0);

  return NextResponse.json({
    success: true,
    message: healthy
      ? "Intel relation schema is healthy"
      : "Intel relation schema needs migration sync",
    data: {
      healthy,
      totalMissing,
      checks,
    },
    meta: {
      actorId,
      companyId,
      migrationHint: "Apply migration 030_intel_relations_and_contract.sql",
    },
  });
}
