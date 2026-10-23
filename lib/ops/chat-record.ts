/**
 * chat-record.ts — the one door that writes and reads the assistant's conversation turns.
 *
 * Measured on the live record 2026-10-24: `chat_history` answers to 6 columns (id, user_id, role,
 * content, created_at, metadata) and holds 0 rows — not one turn was ever stored. Its writer sent
 * `session_id`, `command_executed` and `command_result`, which the record has never had, so every
 * insert came back 42703; and because supabase-js returns an error rather than throwing, the
 * `try/catch` around it never fired, so the refusal did not even reach the log. The assistant's
 * history read asked for `command_executed` too, so the screen got nothing on both ends and looked
 * correctly empty.
 *
 * The turn's extra facts go in `metadata`, which the record does answer to. A write is reported
 * from the record's own reply — the row's id is read back, and a refused write comes back as a
 * failure with an Arabic reason. No column is dropped and retried.
 */

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const CHAT_WRITE_COLUMNS = ["user_id", "role", "content", "metadata"] as const;

export type ChatRole = "user" | "assistant" | "system";

export interface ChatTurn {
  userId?: string | null;
  sessionId?: string | null;
  role: ChatRole;
  content: string;
  commandExecuted?: string | null;
  commandResult?: string | null;
}

export interface StoredChatTurn {
  role: ChatRole;
  content: string;
  createdAt: string | null;
  sessionId: string | null;
  commandExecuted: string | null;
  commandResult: string | null;
}

export type ChatWrite = { ok: true; id: number } | { ok: false; error: string };

const ROLES: readonly string[] = ["user", "assistant", "system"];

export async function recordChatTurn(turn: ChatTurn): Promise<ChatWrite> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "سجل المحادثة مش متصل دلوقتي" };

  if (!ROLES.includes(turn.role)) {
    return { ok: false, error: "صاحب الكلمة مش من أنواع المتجر — الكلمة ما اتسجّلتش" };
  }

  const content = typeof turn.content === "string" ? turn.content.trim() : "";
  if (!content) return { ok: false, error: "مفيش كلام يتسجّل" };

  const { data, error } = await supabase
    .from("chat_history")
    .insert({
      user_id: turn.userId ?? null,
      role: turn.role,
      content,
      metadata: {
        session_id: turn.sessionId ?? null,
        command_executed: turn.commandExecuted ?? null,
        command_result: turn.commandResult ?? null,
      },
    })
    .select("id");

  if (error) return { ok: false, error: "سجل المحادثة رفض الكلمة" };

  const stored = data ?? [];
  if (stored.length !== 1) return { ok: false, error: "سجل المحادثة ما رجّعش رقم السطر — فما اتسجّلش" };

  return { ok: true, id: Number(stored[0].id) };
}

export async function readChatTurns(
  userId: string,
  options: { limit?: number; newestFirst?: boolean } = {}
): Promise<{ turns: StoredChatTurn[]; failed: boolean }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { turns: [], failed: true };

  const { data, error } = await supabase
    .from("chat_history")
    .select("role, content, created_at, metadata")
    .eq("user_id", userId)
    .order("created_at", { ascending: !options.newestFirst })
    .limit(options.limit ?? 20);

  if (error) return { turns: [], failed: true };

  const turns = (data || []).map((row) => {
    const meta = (row.metadata ?? {}) as {
      session_id?: string | null;
      command_executed?: string | null;
      command_result?: string | null;
    };
    return {
      role: row.role as ChatRole,
      content: row.content,
      createdAt: row.created_at ?? null,
      sessionId: meta.session_id ?? null,
      commandExecuted: meta.command_executed ?? null,
      commandResult: meta.command_result ?? null,
    };
  });

  return { turns, failed: false };
}
