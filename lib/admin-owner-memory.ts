/**
 * Long-term owner preferences and decisions for the unified assistant.
 */

import { createClient } from "@supabase/supabase-js";

const CATEGORY = "admin_owner_memory";

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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
): Promise<{ success: boolean }> {
  const supabase = getServiceSupabase();
  if (!supabase) return { success: false };

  const content = `${key}=${value}`.slice(0, 2000);
  await supabase.from("agent_memory").insert({
    type: "preference",
    category: CATEGORY,
    content,
    context: { key, value, userId, outcome: opts?.outcome || "neutral" },
    priority: "high",
    actor_user_id: userId,
    company_id: process.env.MASTER_COMPANY_ID || null,
    outcome: opts?.outcome || null,
  });

  return { success: true };
}

export async function listOwnerPreferences(userId: string, limit = 30): Promise<OwnerMemoryEntry[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("agent_memory")
    .select("content, context, created_at")
    .eq("category", CATEGORY)
    .eq("actor_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []).map((row) => {
    const ctx = row.context as { key?: string; value?: string } | null;
    return {
      key: ctx?.key || row.content.split("=")[0] || "note",
      value: ctx?.value || row.content,
      createdAt: row.created_at,
    };
  });
}

export async function buildOwnerMemoryPrompt(userId?: string): Promise<string> {
  if (!userId) return "";
  const prefs = await listOwnerPreferences(userId, 12);
  if (!prefs.length) return "";
  const lines = prefs.map((p) => `- ${p.key}: ${p.value}`).join("\n");
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
