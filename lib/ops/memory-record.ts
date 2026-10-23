/**
 * memory-record.ts — the one door that writes into the employees' memory table.
 *
 * Measured on the live record 2026-10-24: `agent_memory` answers to 13 columns, and it has
 * no `company_id`, no `actor_user_id`, no `source_table`, no `source_id`. Its six writers were
 * sending exactly those invented names, and every one of them also skipped `memory_type`, which
 * the record demands with no default. All 8 stored rows carry the record's own default category,
 * so not one row in that table was ever written by any desk — five of the six writers threw the
 * refusal away and reported success anyway.
 *
 * A write is reported from the record's own reply: the row's id is read back, and a write the
 * record refused comes back as a failure. No caller gets a fabricated id, and nothing here drops
 * a column and retries, because a silent downgrade writes a row no reader will ever find.
 */

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type MemoryPriority = "low" | "normal" | "high" | "critical";

export interface MemoryRecord {
  /** What this row remembers. The record keeps the kind in two columns; this door fills both. */
  kind: string;
  /** Which desk's shelf the row sits on. Readers filter by it, so it is never invented per call. */
  category: string;
  content: string | Record<string, unknown>;
  context?: Record<string, unknown>;
  priority?: MemoryPriority;
  outcome?: string | null;
  userFeedback?: string | null;
  expiresAt?: Date | string | null;
}

export type MemoryWrite = { ok: true; id: string } | { ok: false; error: string };

/** The columns `recordMemory` writes, as measured from the live record. */
export const MEMORY_WRITE_COLUMNS = [
  "memory_type",
  "type",
  "category",
  "content",
  "context",
  "user_id",
  "priority",
  "outcome",
  "user_feedback",
  "expires_at",
] as const;

const PRIORITIES: readonly string[] = ["low", "normal", "high", "critical"];

export async function recordMemory(entry: MemoryRecord): Promise<MemoryWrite> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "مخزن الذاكرة مش متصل دلوقتي" };

  const kind = entry.kind?.trim();
  if (!kind) return { ok: false, error: "نوع الذاكرة ناقص — السطر ما اتسجّلش" };

  const category = entry.category?.trim();
  if (!category) return { ok: false, error: "رفّ الذاكرة ناقص — السطر ما اتسجّلش" };

  const content = typeof entry.content === "string" ? entry.content.trim() : entry.content;
  if (typeof content === "string" && content.length === 0) {
    return { ok: false, error: "مفيش محتوى يتسجّل — السطر ما اتسجّلش" };
  }

  const priority = entry.priority ?? "normal";
  if (!PRIORITIES.includes(priority)) {
    return { ok: false, error: "أولوية الذاكرة مش من قائمة المتجر — السطر ما اتسجّلش" };
  }

  const { data, error } = await supabase
    .from("agent_memory")
    .insert({
      memory_type: kind,
      type: kind,
      category,
      content: entry.content,
      context: entry.context ?? {},
      user_id: null,
      priority,
      outcome: entry.outcome ?? null,
      user_feedback: entry.userFeedback ?? null,
      expires_at:
        entry.expiresAt instanceof Date ? entry.expiresAt.toISOString() : entry.expiresAt ?? null,
    })
    .select("id");

  if (error) return { ok: false, error: "الذاكرة رفضت السطر" };

  const stored = data ?? [];
  if (stored.length !== 1) return { ok: false, error: "الذاكرة ما رجّعتش رقم السطر — فما اتسجّلش" };

  return { ok: true, id: String(stored[0].id) };
}
