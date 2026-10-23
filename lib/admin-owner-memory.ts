/**
 * Long-term owner preferences and decisions for the unified assistant.
 */

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { recordMemory } from "@/lib/ops/memory-record";

const CATEGORY = "admin_owner_memory";

export type OwnerMemoryEntry = {
  key: string;
  value: string;
  createdAt?: string;
};

export async function rememberOwnerPreference(
  userId: string,
  key: string,
  value: string,
  opts?: { outcome?: "approved" | "rejected" | "neutral" }
): Promise<{ success: boolean; error?: string }> {
  const content = `${key}=${value}`.slice(0, 2000);
  const written = await recordMemory({
    kind: "preference",
    category: CATEGORY,
    content,
    context: { key, value, userId, outcome: opts?.outcome || "neutral" },
    priority: "high",
    outcome: opts?.outcome || null,
  });

  if (!written.ok) return { success: false, error: written.error };

  return { success: true };
}

/**
 * The owner's shelf, read as a shelf: the record's person column points at the customers' roll,
 * and the store's one sign-in has no row there (measured 2026-10-24), so stamping it would be
 * refused rather than remembered.
 */
export async function listOwnerPreferences(
  limit = 30
): Promise<{ entries: OwnerMemoryEntry[]; failed: boolean }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { entries: [], failed: true };

  const { data, error } = await supabase
    .from("agent_memory")
    .select("content, context, created_at")
    .eq("category", CATEGORY)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { entries: [], failed: true };

  const entries = (data || []).map((row) => {
    const ctx = row.context as { key?: string; value?: string } | null;
    const text = typeof row.content === "string" ? row.content : "";
    return {
      key: ctx?.key || text.split("=")[0] || "note",
      value: ctx?.value || text,
      createdAt: row.created_at,
    };
  });

  return { entries, failed: false };
}

export async function buildOwnerMemoryPrompt(): Promise<string> {
  const { entries } = await listOwnerPreferences(12);
  if (!entries.length) return "";
  const lines = entries.map((p) => `- ${p.key}: ${p.value}`).join("\n");
  return `\n\nتفضيلات المالك المحفوظة:\n${lines}`;
}

/** Parse «تذكّر إن...» / remember that... from chat */
export function parseRememberInstruction(message: string): { key: string; value: string } | null {
  const m = message.match(
    /(?:تذكّ?ر|احفظ|remember)\s+(?:إن|ان|that\s+)?(.+?)(?:\s*[:=]\s*|\s+هو\s+)(.+)/i
  );
  if (m) return { key: m[1].trim().slice(0, 80), value: m[2].trim().slice(0, 500) };
  const simple = message.match(/(?:تذكّ?ر|remember)\s+(.+)/i);
  if (simple) return { key: "note", value: simple[1].trim().slice(0, 500) };
  return null;
}
