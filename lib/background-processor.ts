import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Background Processing System
 * Handles AI tasks and heavy operations asynchronously
 * Prevents blocking of main request/response cycle
 */

export type ProcessingStatus = "pending" | "processing" | "completed" | "failed";

export type BackgroundTask = {
  id: string;
  type: "style_dna_analysis" | "pdf_generation" | "whatsapp_notification" | "diamond_lead_notification";
  status: ProcessingStatus;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

/**
 * Create a background task entry in the database
 * This allows tracking and retrying failed tasks
 */
export async function createBackgroundTask(
  type: BackgroundTask["type"],
  payload: Record<string, unknown>
): Promise<string> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase not initialized");

  const taskId = crypto.randomUUID();

  // Store task in events table for tracking
  await supabase.from("events").insert({
    id: taskId,
    company_id: (payload.tenantId as string) || "system",
    user_id: (payload.leadId as string) || (payload.userId as string) || "anonymous",
    type: `background_task_${type}`,
    value: "pending",
    metadata: {
      taskType: type,
      payload,
      status: "pending",
    },
  });

  return taskId;
}

/**
 * Execute a function with a timeout
 * Returns { timedOut: true } if function takes longer than timeoutMs
 */
export async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<{ result?: T; timedOut: boolean; error?: Error }> {
  return new Promise((resolve) => {
    let isSettled = false;

    const timeout = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        resolve({ timedOut: true });
      }
    }, timeoutMs);

    fn()
      .then((result) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          resolve({ result, timedOut: false });
        }
      })
      .catch((error) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          resolve({ error, timedOut: false });
        }
      });
  });
}

/**
 * Fire-and-forget pattern for background processing
 * Executes the function without awaiting, catching errors
 */
export function fireAndForget<T>(
  fn: () => Promise<T>,
  onError?: (error: Error) => void
): void {
  // Use setImmediate equivalent for Node.js environment
  setTimeout(() => {
    fn().catch((error) => {
      console.error("[BackgroundProcessor] Fire-and-forget error:", error);
      if (onError) onError(error);
    });
  }, 0);
}

/**
 * Process pending background tasks
 * This can be called from a cron job or edge function
 */
export async function processPendingTasks(): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  // Fetch pending tasks from events table
  const { data: pendingTasks } = await supabase
    .from("events")
    .select("*")
    .ilike("type", "background_task_%")
    .eq("value", "pending")
    .limit(10);

  if (!pendingTasks || pendingTasks.length === 0) return;

  for (const task of pendingTasks) {
    try {
      // Update status to processing
      await supabase
        .from("events")
        .update({ value: "processing" })
        .eq("id", task.id);

      // Process based on task type
      const metadata = task.metadata as { taskType: string; payload: Record<string, unknown> };

      // Re-process based on type
      await reprocessTask(metadata.taskType as BackgroundTask["type"], metadata.payload);

      // Mark as completed
      await supabase
        .from("events")
        .update({
          value: "completed",
          metadata: {
            ...metadata,
            status: "completed",
            completedAt: new Date().toISOString(),
          },
        })
        .eq("id", task.id);
    } catch (error) {
      console.error(`[BackgroundProcessor] Task ${task.id} failed:`, error);

      await supabase
        .from("events")
        .update({
          value: "failed",
          metadata: {
            ...(task.metadata as Record<string, unknown>),
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        })
        .eq("id", task.id);
    }
  }
}

/**
 * Re-process a failed or pending task
 */
async function reprocessTask(
  type: BackgroundTask["type"],
  payload: Record<string, unknown>
): Promise<void> {
  switch (type) {
    case "style_dna_analysis":
      // Re-import and call analyzeStyleDNA in background
      const { analyzeStyleDNA } = await import("@/lib/pdf-generator");
      await analyzeStyleDNA(payload.imageUrls as string[]);
      break;

    case "whatsapp_notification":
      // WhatsApp notifications are logged, no need to re-send
      console.log("[BackgroundProcessor] WhatsApp notification processed");
      break;

    default:
      console.log(`[BackgroundProcessor] Unknown task type: ${type}`);
  }
}
