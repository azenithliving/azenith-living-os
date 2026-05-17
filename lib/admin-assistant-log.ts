/**
 * Execution log for the unified admin assistant (fail-open).
 */

import { createClient } from "@supabase/supabase-js";

export interface AssistantExecutionEntry {
  id: string;
  execution_type: string;
  execution_status: string;
  execution_data: Record<string, unknown>;
  execution_result: unknown;
  started_at: string;
  execution_time_ms: number | null;
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function logAssistantExecution(params: {
  userId?: string;
  userMessage: string;
  intentKind?: string;
  tool?: string;
  status: "success" | "failure" | "partial";
  result?: unknown;
  durationMs: number;
  errorMessage?: string;
}): Promise<string | null> {
  const supabase = getAdminClient();
  if (!supabase) return null;

  const now = new Date().toISOString();
  const row = {
    company_id: process.env.MASTER_COMPANY_ID || null,
    actor_user_id: params.userId || null,
    execution_type: `assistant:${params.tool || params.intentKind || "natural"}`,
    execution_data: {
      userMessage: params.userMessage.slice(0, 2000),
      intentKind: params.intentKind,
      tool: params.tool,
    },
    execution_result: params.result ?? null,
    execution_status: params.status,
    started_at: now,
    completed_at: now,
    execution_time_ms: params.durationMs,
    error_message: params.errorMessage || null,
    rollback_available: false,
  };

  const { data, error } = await supabase
    .from("agent_executions")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    console.warn("[AssistantLog] insert failed:", error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function listAssistantExecutions(
  userId: string | undefined,
  limit = 15
): Promise<AssistantExecutionEntry[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  let query = supabase
    .from("agent_executions")
    .select(
      "id, execution_type, execution_status, execution_data, execution_result, started_at, execution_time_ms"
    )
    .like("execution_type", "assistant:%")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq("actor_user_id", userId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data as AssistantExecutionEntry[];
}
