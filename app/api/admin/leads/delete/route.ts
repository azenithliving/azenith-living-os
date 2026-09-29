import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAdminApi } from "@/lib/admin-api-guard";
import {
  buildPlan,
  declaredRowsMatch,
  hasResidue,
  LEDGER_ORDER,
  planIsEmpty,
  planTotals,
  residueOf,
  splitKeys,
  type LedgerIds,
} from "@/lib/leads-delete-guard";

type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;
type Row = { id?: string | null };
type Found = { rows: Row[]; error: string | null };

async function lookUp(client: AdminClient, table: string, column: string, keys: string[]): Promise<Found> {
  if (keys.length === 0) return { rows: [], error: null };
  const { data, error } = await client.from(table).select("id").in(column, keys);
  return { rows: data ?? [], error: error ? error.message : null };
}

async function measure(client: AdminClient, sessionKeys: string[], uuidKeys: string[]) {
  const sessions = await lookUp(client, "consultant_sessions", "session_id", sessionKeys);
  const sessionsById = await lookUp(client, "consultant_sessions", "id", uuidKeys);
  const users = await lookUp(client, "users", "session_id", sessionKeys);
  const usersById = await lookUp(client, "users", "id", uuidKeys);

  const userIds = [...users.rows, ...usersById.rows].map((row) => row.id).filter(Boolean) as string[];
  const requestsByUser = await lookUp(client, "requests", "user_id", userIds);
  const requestsById = await lookUp(client, "requests", "id", uuidKeys);
  const telemetry = await lookUp(client, "visitor_telemetry", "session_id", sessionKeys);

  const plan = buildPlan({
    consultantSessions: [...sessions.rows, ...sessionsById.rows],
    users: [...users.rows, ...usersById.rows],
    requests: [...requestsByUser.rows, ...requestsById.rows],
    visitorTelemetry: telemetry.rows,
  });

  const failures = [sessions, sessionsById, users, usersById, requestsByUser, requestsById, telemetry]
    .map((step) => step.error)
    .filter(Boolean) as string[];

  return { plan, failures };
}

async function sweep(client: AdminClient, table: string, ids: string[]): Promise<{ deleted: number; error: string | null }> {
  if (ids.length === 0) return { deleted: 0, error: null };
  const { data, error } = await client.from(table).delete().in("id", ids).select("id");
  return { deleted: (data ?? []).length, error: error ? error.message : null };
}

const TABLES: Record<keyof LedgerIds, string> = {
  consultantSessions: "consultant_sessions",
  users: "users",
  requests: "requests",
  visitorTelemetry: "visitor_telemetry",
};

// Requests go first: their user link is nulled by Postgres the moment the user row goes.
const SWEEP_ORDER: (keyof LedgerIds)[] = ["requests", "consultantSessions", "visitorTelemetry", "users"];

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const body = await request.json().catch(() => null);
    const sessionIds = body?.sessionIds;
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json({ error: "Missing sessionIds" }, { status: 400 });
    }

    const client = getSupabaseAdminClient();
    if (!client) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
    }

    const { uuids, sessions: sessionKeys } = splitKeys(sessionIds);
    const { plan, failures } = await measure(client, sessionKeys, uuids);
    if (failures.length > 0) {
      return NextResponse.json({ error: "Measurement failed", failures }, { status: 500 });
    }

    const confirmed = body?.confirm === true;
    if (!confirmed) {
      if (planIsEmpty(plan)) {
        return NextResponse.json({ preview: true, ledgers: planTotals(plan), nothingMatched: true });
      }
      return NextResponse.json({ preview: true, ledgers: planTotals(plan) });
    }

    if (planIsEmpty(plan)) {
      return NextResponse.json(
        { error: "السجلات دي مش موجودة — يمكن اتشالت قبل كده", measured: planTotals(plan) },
        { status: 409 },
      );
    }

    const match = declaredRowsMatch(body?.expectedRows, plan);
    if (!match.ok) {
      return NextResponse.json(
        { error: "عدد السجلات اتغير بين العرض والتأكيد", reason: match.reason, declared: match.declared, ledgers: planTotals(plan) },
        { status: 409 },
      );
    }

    const deleted: Partial<Record<keyof LedgerIds, number>> = {};
    const sweepFailures: string[] = [];
    for (const ledger of SWEEP_ORDER) {
      const outcome = await sweep(client, TABLES[ledger], plan[ledger]);
      if (outcome.error) sweepFailures.push(`${TABLES[ledger]}: ${outcome.error}`);
      deleted[ledger] = outcome.deleted;
    }
    if (sweepFailures.length > 0) {
      return NextResponse.json(
        { error: "مسح بعض الدفاتر فشل", sweepFailures, deleted, ledgers: planTotals(plan) },
        { status: 500 },
      );
    }

    const stillThere = buildPlan({
      consultantSessions: (await lookUp(client, "consultant_sessions", "id", plan.consultantSessions)).rows,
      users: (await lookUp(client, "users", "id", plan.users)).rows,
      requests: (await lookUp(client, "requests", "id", plan.requests)).rows,
      visitorTelemetry: (await lookUp(client, "visitor_telemetry", "id", plan.visitorTelemetry)).rows,
    });

    const residue = residueOf(plan, stillThere);
    if (hasResidue(residue)) {
      return NextResponse.json(
        { error: "فاضل سجلات ما اتمسحتش", residue: planTotals(residue), deleted, declared: match.total },
        { status: 500 },
      );
    }

    const deletedTotal = LEDGER_ORDER.reduce((sum, ledger) => sum + (deleted[ledger] ?? 0), 0);
    return NextResponse.json({
      success: true,
      deleted,
      deletedTotal,
      declared: match.total,
      verified: deletedTotal === match.total,
    });
  } catch (error) {
    console.error("[Leads Delete] API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
