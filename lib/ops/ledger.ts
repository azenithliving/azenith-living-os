/**
 * ledger.ts — the one door that writes into the store's event ledger.
 *
 * Every desk that reports something (the swarm's sync layer, the automation bus, an owner
 * control leaving a receipt) goes through here, so the ledger's row shape has one owner.
 * That matters because the store already has a table whose writers invented columns:
 * `agent_events` has 8 columns while its three writers passed `severity`, `message` and
 * `metadata`, so every one of those inserts was rejected with 42703 and the events were
 * lost in a `console.error` (measured on the live record 2026-10-23).
 *
 * A write is reported from the ledger's own reply: the row's id is read back, and a write
 * that the record refused is returned as a failure. No caller gets a fabricated id.
 */

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAdminCompanyId } from "@/lib/admin-company";

import { SYNC_EVENT_TYPES, type SyncEventType } from "./syncTypes";

export type LedgerWrite = { ok: true; id: number } | { ok: false; error: string };

export interface LedgerEvent {
  eventType: SyncEventType;
  /** Who is speaking, in the store's own employee key. */
  source: string;
  payload?: Record<string, unknown>;
  /** Empty means the whole swarm hears it. */
  targets?: string[];
  /** Only a trusted server caller may name a company explicitly. */
  companyId?: string | null;
}

/**
 * Record one event. The ledger has no check constraint on the event kind, so the
 * vocabulary is enforced here — a type outside the list is refused by name rather than
 * quietly written where no reader will ever look for it.
 */
export async function recordLedgerEvent(event: LedgerEvent): Promise<LedgerWrite> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "الدفتر غير متصل دلوقتي" };

  const companyId = await resolveAdminCompanyId(event.companyId);
  if (!companyId) return { ok: false, error: "شركة المتجر مش مسجّلة في الإعدادات — فالسطر ما اتسجّلش" };

  if (!event.eventType || !(SYNC_EVENT_TYPES as readonly string[]).includes(event.eventType)) {
    return { ok: false, error: "نوع الحدث مش في دفتر المتجر — السطر ما اتسجّلش" };
  }

  const { data, error } = await supabase
    .from("ops_sync_events")
    .insert({
      company_id: companyId,
      event_type: event.eventType,
      source_agent: event.source,
      target_agents: event.targets ?? [],
      payload: event.payload ?? {},
    })
    .select("id");

  if (error) return { ok: false, error: "الدفتر رفض السطر" };

  const stored = data ?? [];
  if (stored.length !== 1) return { ok: false, error: "الدفتر ما رجّعش رقم السطر — فما اتسجّلش" };

  return { ok: true, id: Number(stored[0].id) };
}
