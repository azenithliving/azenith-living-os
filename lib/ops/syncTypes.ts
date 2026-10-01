/**
 * syncTypes.ts — the one list of event kinds the store's ledger accepts.
 *
 * It lives in its own leaf on purpose: the routes that validate an incoming event
 * need the list, and importing it from the sync layer would drag that layer's
 * database client into every route's module graph. One list, read from both sides,
 * no copy that can drift.
 */
export const SYNC_EVENT_TYPES = [
  'context_update',
  'draft_created',
  'draft_updated',
  'draft_published',
  'draft_rejected',
  'draft_rolled_back',
  'audit_completed',
  'learning_created',
  'learning_updated',
  'agent_task_started',
  'agent_task_completed',
  'agent_task_failed',
  'market_update',
  'anomaly_detected',
  'self_audit_completed',
  'quality_gate_passed',
  'quality_gate_failed',
  'identity_violation',
  'scope_violation',
  /** A customer handed over a hand-drawn room. Phase two's passport and phase four's
   * lead temperature both hang on this one moment, so it is news, not a log line. */
  'paper_sketch_received',
] as const;

export type SyncEventType = (typeof SYNC_EVENT_TYPES)[number];
