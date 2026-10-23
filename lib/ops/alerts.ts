/**
 * alerts.ts — which ledger entries mean «something is wrong right now», what the owner
 * is told in Arabic when one appears, and how he closes it.
 *
 * The store has no alert state of its own: trouble is already recorded in
 * `ops_sync_events` by the swarm's sync layer and, since the ledger was unified, by
 * the automation bus too. This module is the single reading rule over that ledger, so
 * the cockpit's red strip and every later surface agree on what counts as an emergency,
 * how many are still open, and what closes one — instead of each inventing its own
 * table, its own window or its own read flag.
 *
 * The old `agent_events` table is deliberately not read here. Measured on the live
 * record (2026-10-23): it holds 4 rows, every one written by a demo seed on 2026-08-10,
 * and its 8 columns do not include the `severity` / `acknowledged_at` / `message` /
 * `metadata` columns the code that wrote into it expected — so each of those writes was
 * rejected and nothing has been recorded since. A strip over it could only ever repeat
 * four invented alerts and fail to mark them read.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { SALES_KEY, employeeTitle } from "./departments";
import { isOpsKey, legacyToOps } from "./identity";
import { arNum } from "./metricLabels";

export const ALERT_EVENT_TYPES = [
  // The swarm's own ledger.
  'anomaly_detected',
  'identity_violation',
  'scope_violation',
  'quality_gate_failed',
  'agent_task_failed',
  // The owner's own stop control — the store halting is news, not a receipt.
  'emergency_stop',
  // The automation bus, now writing into the same table.
  'system:anomaly_detected',
  'system:error',
  'tool:failed',
  'workflow:failed',
  'task:failed',
] as const;

/** An acknowledgement names the alert it closes; the ledger holds it as an event. */
export const ALERT_ACK_TYPE = 'owner_alert_acknowledged';

/** Trouble older than this is yesterday's news, not a strip on his screen. */
export const ALERT_WINDOW_MS = 60 * 60 * 1000;

/**
 * How long back the strip looks, in the words the owner reads. The window lives in this
 * module, so a surface that has to explain an empty strip says what the rule actually
 * does instead of hard-coding its own number of minutes.
 */
export function alertWindowPhrase(): string {
  return `آخر ${arNum(Math.round(ALERT_WINDOW_MS / 60000))} دقيقة`;
}

const ARABIC: Record<string, string> = {
  anomaly_detected: 'رُصد شذوذ في المتجر',
  identity_violation: 'موظف تكلّم بغير اسمه المسجّل',
  scope_violation: 'موظف تجاوز المجال المسموح له',
  quality_gate_failed: 'بوابة الجودة رفضت عملاً',
  agent_task_failed: 'مهمة موظف فشلت',
  emergency_stop: 'الإيقاف الطارئ اتفعّل — الموظفين واقفين',
  'system:anomaly_detected': 'رصد الآلية شذوذاً في التشغيل',
  'system:error': 'خطأ في النظام',
  'tool:failed': 'أداة فشلت في التنفيذ',
  'workflow:failed': 'مسار عمل توقف',
  'task:failed': 'مهمة مؤتمتة فشلت',
};

export function isAlertEventType(value: string): boolean {
  return (ALERT_EVENT_TYPES as readonly string[]).includes(value);
}

/**
 * Who spoke, in Arabic — or not at all. The ledger stores the key upper-cased, and
 * rows written before the naming programme carry the retired stamp, so both fold back
 * through the identity module before a label is read. Anything that is not a seated
 * employee is left out rather than printed as a machine key.
 */
export function alertSourceLabel(source: unknown): string {
  const raw = String(source ?? "").toLowerCase();
  const key = legacyToOps(raw);
  return isOpsKey(key) || raw === SALES_KEY ? employeeTitle(key) : "";
}

/**
 * The sentence shown on the red strip. An unlisted type returns the empty string
 * rather than the raw key: a machine identifier inside his Arabic alert is the defect
 * the identity module exists to keep off his screens.
 */
export function alertLabel(eventType: string): string {
  return ARABIC[eventType] ?? '';
}

/** Longest note a strip prints — measured from the panel, which clamps to two lines. */
const NOTE_LIMIT = 160;

/**
 * A note is only worth showing if it is already his language. Every desk that writes
 * the ledger is supposed to write Arabic, but the strip is the boundary his screen
 * reads from: a note with no Arabic letter in it is dropped, not translated and not
 * printed, so English diagnostics cannot come back through an alert.
 */
export function arabicNote(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || !/[\u0600-\u06FF]/.test(raw)) return '';
  return raw.slice(0, NOTE_LIMIT);
}

/** One open alert, already in the words a surface can print. */
export interface LedgerAlert {
  id: number;
  event_type: string;
  label: string;
  who: string;
  note: string;
  at: string | null;
}

export type AlertRead =
  | { ok: true; alerts: LedgerAlert[] }
  | { ok: false; error: string };

/**
 * The whole reading rule: the window, the event types, the company and the
 * acknowledgements that close an alert. A surface that wants the owner's alerts calls
 * this and shows what comes back — it does not re-read the ledger its own way.
 *
 * A ledger that does not answer is a failure, never an empty list: an empty list on a
 * failed read is how his screen claims all is well while nothing was measured.
 */
export async function readOpenAlerts(
  client: SupabaseClient,
  companyId: string,
  limit = 20,
): Promise<AlertRead> {
  const since = new Date(Date.now() - ALERT_WINDOW_MS).toISOString();
  const cap = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const [alerts, acks] = await Promise.all([
    client
      .from('ops_sync_events')
      .select('id,event_type,source_agent,payload,created_at')
      .eq('company_id', companyId)
      .in('event_type', [...ALERT_EVENT_TYPES])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(cap),
    client
      .from('ops_sync_events')
      .select('payload')
      .eq('company_id', companyId)
      .eq('event_type', ALERT_ACK_TYPE)
      .gte('created_at', since)
      .limit(500),
  ]);

  if (alerts.error || acks.error) return { ok: false, error: 'الدفتر ما ردّش' };

  const closed = new Set(
    (acks.data ?? []).map((row: Record<string, any>) => String(row?.payload?.alert_id ?? '')),
  );

  const open = (alerts.data ?? [])
    .filter((row: Record<string, any>) => !closed.has(String(row.id)))
    .map((row: Record<string, any>) => {
      const eventType = String(row.event_type ?? '');
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      return {
        id: Number(row.id),
        event_type: eventType,
        label: alertLabel(eventType),
        who: alertSourceLabel(row.source_agent),
        note: arabicNote(payload.summary) || arabicNote(payload.digest),
        at: row.created_at ?? null,
      };
    });

  return { ok: true, alerts: open };
}

export type AlertAck =
  | { ok: true; acked: number }
  | { ok: false; error: string };

/**
 * Closing an alert writes an event that names it — there is no read flag on the row,
 * because the ledger has no such column and the store's own answer to "did he see it?"
 * is the receipt he left. Stored rows are counted from the ledger's own reply, so a
 * write that the record refused is reported, not assumed.
 */
export async function acknowledgeAlerts(
  client: SupabaseClient,
  companyId: string,
  alertIds: number[],
): Promise<AlertAck> {
  const rows = alertIds.map((id) => ({
    company_id: companyId,
    event_type: ALERT_ACK_TYPE,
    source_agent: 'owner',
    target_agents: [],
    payload: { alert_id: id },
  }));

  const { data, error } = await client.from('ops_sync_events').insert(rows).select('id');
  if (error) return { ok: false, error: 'الدفتر رفض التسجيل' };

  const stored = (data ?? []).length;
  if (stored !== rows.length) return { ok: false, error: 'الدفتر خزّن أقل من اللي اتبعت — فما كملش' };
  return { ok: true, acked: stored };
}
