/**
 * alerts.ts — which ledger entries mean «something is wrong right now», and what the
 * owner is told in Arabic when one appears.
 *
 * The store has no alert state of its own: trouble is already recorded in
 * `ops_sync_events` by the swarm's sync layer and, since the ledger was unified, by
 * the automation bus too. This module is the single reading rule over that ledger, so
 * the cockpit's red strip and any later surface agree on what counts as an emergency
 * instead of each inventing its own.
 */

import { SALES_KEY, employeeTitle } from "./departments";
import { isOpsKey, legacyToOps } from "./identity";

export const ALERT_EVENT_TYPES = [
  // The swarm's own ledger.
  'anomaly_detected',
  'identity_violation',
  'scope_violation',
  'quality_gate_failed',
  'agent_task_failed',
  // The automation bus, now writing into the same table.
  'system:anomaly_detected',
  'system:error',
  'tool:failed',
  'workflow:failed',
  'task:failed',
] as const;

/** An acknowledgement names the alert it closes; the ledger holds it as an event. */
export const ALERT_ACK_TYPE = 'owner_alert_acknowledged';

const ARABIC: Record<string, string> = {
  anomaly_detected: 'رُصد شذوذ في المتجر',
  identity_violation: 'موظف تكلّم بغير اسمه المسجّل',
  scope_violation: 'موظف تجاوز المجال المسموح له',
  quality_gate_failed: 'بوابة الجودة رفضت عملاً',
  agent_task_failed: 'مهمة موظف فشلت',
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
