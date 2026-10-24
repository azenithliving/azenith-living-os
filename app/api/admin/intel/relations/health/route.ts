import { NextResponse } from "next/server";

import { resolvePrimaryCompanyId } from "@/lib/company-resolver";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { AUDIT_WRITE_COLUMNS } from "@/lib/ops/audit-record";
import { MEMORY_WRITE_COLUMNS } from "@/lib/ops/memory-record";

/**
 * The record answers a column question with the shape of a read: a column it does not have comes
 * back as 42703 naming that column, a table it does not have comes back as PGRST205, and an empty
 * table answers with no rows and no error. Measured on the live store 2026-10-24 against a table
 * holding 82 rows and a table holding none, so a verdict here never depends on rows existing.
 */
const MISSING_COLUMN = "42703";
const MISSING_TABLE = "PGRST205";

type RelationCheck = {
  table: string;
  requiredColumns: string[];
  missingColumns: string[];
  tableMissing: boolean;
  readFailed: boolean;
  healthy: boolean;
};

const REQUIRED_RELATIONS: Array<{ table: string; columns: string[] }> = [
  // `is_active` is not asked for: the record has never had it, the rules desk writes it only to
  // strip it again on refusal, and `enabled` alone carries the fact.
  { table: "automation_rules", columns: ["company_id", "enabled"] },
  { table: "approval_requests", columns: ["company_id", "actor_user_id", "command_log_id"] },
  { table: "audit_log", columns: [...AUDIT_WRITE_COLUMNS] },
  { table: "agent_memory", columns: [...MEMORY_WRITE_COLUMNS] },
];

type Probe = {
  missingColumns: string[];
  tableMissing: boolean;
  readFailed: boolean;
};

type RecordClient = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;

async function probeRelation(client: RecordClient, table: string, columns: string[]): Promise<Probe> {
  const asked = await client.from(table).select(columns.join(",")).limit(1);
  if (!asked.error) return { missingColumns: [], tableMissing: false, readFailed: false };
  if (asked.error.code === MISSING_TABLE) return { missingColumns: [], tableMissing: true, readFailed: false };
  // Anything that is not "no such column" is a refusal to answer, which is not a measurement.
  if (asked.error.code !== MISSING_COLUMN) return { missingColumns: [], tableMissing: false, readFailed: true };

  const missingColumns: string[] = [];
  for (const column of columns) {
    const one = await client.from(table).select(column).limit(1);
    if (!one.error) continue;
    if (one.error.code === MISSING_COLUMN) {
      missingColumns.push(column);
      continue;
    }
    // Half a measurement is not a verdict: say what was counted, then say the read broke.
    return { missingColumns, tableMissing: false, readFailed: true };
  }
  return { missingColumns, tableMissing: false, readFailed: false };
}

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
    const probe = await probeRelation(supabase, relation.table, relation.columns);
    checks.push({
      table: relation.table,
      requiredColumns: relation.columns,
      missingColumns: probe.missingColumns,
      tableMissing: probe.tableMissing,
      readFailed: probe.readFailed,
      healthy: !probe.readFailed && !probe.tableMissing && probe.missingColumns.length === 0,
    });
  }

  const healthy = checks.every((check) => check.healthy);
  const totalMissing = checks.reduce((sum, check) => sum + check.missingColumns.length, 0);
  const unreadableTables = checks.filter((check) => check.readFailed).map((check) => check.table);
  const absentTables = checks.filter((check) => check.tableMissing).map((check) => check.table);
  const gapTables = checks
    .filter((check) => !check.healthy && !check.readFailed && !check.tableMissing)
    .map((check) => check.table);

  const notes: string[] = [];
  if (unreadableTables.length > 0) notes.push(`Schema read unavailable for: ${unreadableTables.join(", ")}`);
  if (absentTables.length > 0) notes.push(`Table absent from the record: ${absentTables.join(", ")}`);
  if (gapTables.length > 0) notes.push(`Columns missing in: ${gapTables.join(", ")}`);

  return NextResponse.json({
    success: true,
    message: notes.length > 0 ? notes.join(" · ") : "Intel relation schema is healthy",
    data: {
      healthy,
      totalMissing,
      unreadableTables,
      absentTables,
      gapTables,
      checks,
    },
    meta: {
      actorId,
      companyId,
      migrationHint:
        gapTables.length > 0 || absentTables.length > 0
          ? `Measured gaps: ${[...absentTables.map((table) => `${table} (absent)`), ...gapTables].join(", ")}`
          : unreadableTables.length > 0
            ? "No gap measured — this door cannot read the schema"
            : "No table is missing a column the code writes",
    },
  });
}
