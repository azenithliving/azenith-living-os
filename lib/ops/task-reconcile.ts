/**
 * P6-M5 — task reconciliation: a task that never stopped is a task that never
 * finished.
 *
 * Live case: the seed card read «قيد المعالجة · 1 مهمة» from a `running` row
 * started 2026-08-10, forty-six days earlier. A serverless function is killed at
 * 60 seconds, so "running for 46 days" is not a slow task — it is a process that
 * died mid-write and left its ledger open. Nobody reconciled it, so the card went
 * on telling the owner the swarm was busy, forever, on a job that stopped
 * existing before this month started.
 *
 * Two halves, deliberately separated:
 *  • the READ (status, badge) must never lie, so it filters stale rows out even
 *    if no sweep has run yet;
 *  • the WRITE (the daily round) closes them in the ledger with the age recorded,
 *    so the history says what actually happened instead of silently vanishing.
 */
import "server-only";

import { supabaseServer } from "@/lib/dal/unified-supabase";

/** A function is capped at 60s; a swarm task chain gets minutes. Fifteen is
 * already generous — anything still "running" past that is a corpse. */
export const STALE_RUNNING_MS = 15 * 60_000;

export interface TaskRow {
  status: string;
  started_at: string | null;
  created_at: string | null;
}

function ageOf(row: TaskRow, now: Date): number | null {
  const started = row.started_at ? Date.parse(row.started_at) : NaN;
  if (Number.isFinite(started)) return now.getTime() - started;
  const created = row.created_at ? Date.parse(row.created_at) : NaN;
  if (Number.isFinite(created)) return now.getTime() - created;
  return null;
}

export function isStaleRunning(row: TaskRow, now: Date = new Date()): boolean {
  if (row.status !== "running") return false;
  const age = ageOf(row, now);
  // No usable clock at all is the exact shape a crashed writer leaves behind, so
  // it counts as stale rather than as "assume it's fine".
  if (age === null) return true;
  return age >= STALE_RUNNING_MS;
}

export function staleRunningIds<T extends { id: string } & TaskRow>(rows: T[], now: Date = new Date()): string[] {
  return rows.filter((r) => isStaleRunning(r, now)).map((r) => r.id);
}

/** How long it had been claiming to work, in the unit a human reads. */
export function describeStale(row: TaskRow, now: Date = new Date()): string {
  const age = ageOf(row, now);
  if (age === null) return "بلا وقت بداية أصلاً";
  const minutes = Math.max(1, Math.round(age / 60_000));
  if (minutes < 60) return `${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} ساعة`;
  return `${Math.round(hours / 24)} يوم`;
}

export interface ReconcileResult {
  closed: number;
  ids: string[];
  /** null when the sweep ran cleanly. */
  error: string | null;
}

/** Rows one sweep will look at — a stuck backlog larger than this is itself a
 * finding, and the result says so rather than pretending it finished. */
const SWEEP_LIMIT = 200;

/**
 * Close stale `running` rows as `failed`, with the age written into the row so
 * the ledger explains itself later.
 */
export async function reconcileStaleTasks(now: Date = new Date()): Promise<ReconcileResult> {
  if (!supabaseServer) return { closed: 0, ids: [], error: "مفيش اتصال بقاعدة البيانات" };

  const { data, error } = await supabaseServer
    .from("agent_tasks")
    .select("id,status,started_at,created_at")
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .limit(SWEEP_LIMIT);

  if (error) return { closed: 0, ids: [], error: error.message };

  const rows = (data || []) as Array<{ id: string } & TaskRow>;
  const stale = rows.filter((r) => isStaleRunning(r, now));
  if (!stale.length) return { closed: 0, ids: [], error: null };

  const { error: updateError } = await supabaseServer
    .from("agent_tasks")
    .update({
      status: "failed",
      progress_percent: 0,
      completed_at: now.toISOString(),
      output_data: {
        failure_reason: "المهمة اتقفلت آليًا: كانت «شغالة» من غير ما تخلص — العملية اللي بدأتها ماتت في النص.",
        stale_for: stale.map((r) => describeStale(r, now)),
        reconciled_by: "qayyim-task-reconcile",
      },
    })
    .in("id", stale.map((r) => r.id));

  if (updateError) return { closed: 0, ids: [], error: updateError.message };
  return { closed: stale.length, ids: stale.map((r) => r.id), error: null };
}
