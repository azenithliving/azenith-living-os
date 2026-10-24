import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * The audit desk's one writer.
 *
 * The record answers a payload name it does not have with PGRST204, while a name missing from a
 * read projection answers 42703 (both measured on the live store 2026-10-24). The desk used to key
 * its retry on the read code, so the refusal it never recognised was the last thing anyone heard,
 * and the table held zero rows while six doors were writing to it. Only the columns the record
 * actually has are sent; the relation links ride inside `details`, which the record does have.
 */
export const AUDIT_WRITE_COLUMNS = ["event_type", "action", "actor", "details", "result", "timestamp"] as const;

export type AuditOutcome = "success" | "failure" | "blocked";

export interface AuditRelation {
  companyId?: string;
  actorUserId?: string;
  approvalRequestId?: string;
  commandLogId?: string;
}

export interface AuditEvent {
  kind: string;
  action: string;
  actor: string;
  details?: Record<string, unknown>;
  outcome: AuditOutcome;
  relation?: AuditRelation;
}

export type AuditWrite = { ok: true; id: string } | { ok: false; error: string };

const OUTCOMES: readonly string[] = ["success", "failure", "blocked"];

function relationEntries(relation: AuditRelation): Record<string, string> {
  const filled: Record<string, string> = {};
  for (const [key, value] of Object.entries(relation)) {
    if (typeof value === "string" && value.trim() !== "") filled[key] = value.trim();
  }
  return filled;
}

export async function recordAuditEvent(event: AuditEvent): Promise<AuditWrite> {
  const kind = typeof event.kind === "string" ? event.kind.trim() : "";
  const action = typeof event.action === "string" ? event.action.trim() : "";
  const actor = typeof event.actor === "string" ? event.actor.trim() : "";

  if (!kind) return { ok: false, error: "سجل الأحداث رفض: الحدث بلا نوع" };
  if (!action) return { ok: false, error: "سجل الأحداث رفض: الحدث بلا وصف" };
  if (!actor) return { ok: false, error: "سجل الأحداث رفض: الحدث بلا فاعل" };
  if (!OUTCOMES.includes(event.outcome)) return { ok: false, error: "سجل الأحداث رفض: نتيجة مش معروفة" };

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "سجل الأحداث مش متصل دلوقتي" };

  const details: Record<string, unknown> = { ...(event.details ?? {}) };
  if (event.relation) {
    const relation = relationEntries(event.relation);
    if (Object.keys(relation).length > 0) details.relation = relation;
  }

  const { data, error } = await supabase
    .from("audit_log")
    .insert({
      event_type: kind,
      action,
      actor,
      details,
      result: event.outcome,
      timestamp: new Date().toISOString(),
    })
    .select("id");

  if (error) return { ok: false, error: "سجل الأحداث رفض السطر" };

  const stored = data ?? [];
  if (stored.length !== 1) {
    return { ok: false, error: "سجل الأحداث ما رجّعتش رقم السطر — فما اتسجّلش" };
  }
  return { ok: true, id: String(stored[0].id) };
}
