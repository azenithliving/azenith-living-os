/**
 * Execution Tracker
 * 
 * تتبع تنفيذ جميع الأدوات مع:
 * - Creating execution records
 * - Updating status
 * - Linking to revisions and backups
 * - Rollback support
 */

import { createClient } from "@/lib/supabase-server";
import type {
  ToolExecutionContext,
  ToolExecutionResult,
} from "./tool-registry";
import type {
  AgentExecution,
  AgentExecutionInsert,
  AgentExecutionUpdate,
} from "@/lib/agent-types";
import type { Json } from "@/lib/supabase/database.types";

// ============================================
// Create Execution Record
// ============================================

export async function createExecutionRecord(params: {
  toolName: string;
  params: Record<string, unknown>;
  status: "pending" | "running";
  relationContext?: ToolExecutionContext;
}): Promise<AgentExecution> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agent_executions")
    .insert({
      execution_type: params.toolName,
      execution_data: params.params as unknown as Json,
      execution_status: params.status,
      company_id: params.relationContext?.companyId || null,
      actor_user_id: params.relationContext?.actorUserId || null,
      execution_id: params.relationContext?.executionId || null,
      command_log_id: params.relationContext?.commandLogId || null,
      suggestion_id: params.relationContext?.suggestionId || null,
      started_at: new Date().toISOString(),
      affected_rows: 0,
      rollback_available: false,
    } as AgentExecutionInsert)
    .select()
    .single();

  if (error) {
    console.error("[ExecutionTracker] Failed to create execution record:", error);
    throw new Error(`Failed to create execution record: ${error.message}`);
  }

  return data;
}

// ============================================
// Update Execution Record
// ============================================

export async function updateExecutionRecord(
  executionId: string,
  update: {
    status: "completed" | "failed" | "rolled_back";
    result?: Record<string, unknown>;
    error?: string;
    affectedRows?: number;
    affectedTables?: string[];
    rollbackAvailable?: boolean;
  }
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("agent_executions")
    .update({
      execution_status: update.status,
      execution_result: update.result ? (update.result as unknown as Json) : null,
      error_message: update.error || null,
      affected_rows: update.affectedRows || 0,
      affected_tables: update.affectedTables || null,
      rollback_available: update.rollbackAvailable || false,
      completed_at: new Date().toISOString(),
    } as AgentExecutionUpdate)
    .eq("id", executionId);

  if (error) {
    console.error("[ExecutionTracker] Failed to update execution record:", error);
    throw new Error(`Failed to update execution record: ${error.message}`);
  }
}

// ============================================
// Link Execution to Revision
// ============================================

export async function linkExecutionToRevision(
  executionId: string,
  revisionId: string
): Promise<void> {
  const supabase = await createClient();

  // Update the execution record with revision link
  const { error } = await supabase
    .from("agent_executions")
    .update({
      execution_result: {
        revisionId: revisionId,
        canRollback: true,
      } as unknown as Json,
      rollback_available: true,
    } as AgentExecutionUpdate)
    .eq("id", executionId);

  if (error) {
    console.error("[ExecutionTracker] Failed to link execution to revision:", error);
  }
}

// ============================================
// Link Execution to Backup
// ============================================

export async function linkExecutionToBackup(
  executionId: string,
  backupId: string,
  backupUrl: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("agent_executions")
    .update({
      execution_result: {
        backupId: backupId,
        downloadUrl: backupUrl,
        canRestore: true,
      } as unknown as Json,
      rollback_available: true,
    } as AgentExecutionUpdate)
    .eq("id", executionId);

  if (error) {
    console.error("[ExecutionTracker] Failed to link execution to backup:", error);
  }
}

// ============================================
// Get Execution by ID
// ============================================

export async function getExecution(executionId: string): Promise<AgentExecution | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agent_executions")
    .select("*")
    .eq("id", executionId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

// ============================================
// Get Executions by Tool
// ============================================

export async function getExecutionsByTool(
  toolName: string,
  limit: number = 10
): Promise<AgentExecution[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agent_executions")
    .select("*")
    .eq("execution_type", toolName)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[ExecutionTracker] Failed to get executions:", error);
    return [];
  }

  return data || [];
}

// ============================================
// Execute Tool with Full Tracking
// ============================================

export async function executeWithTracking<T extends ToolExecutionResult>(
  toolName: string,
  params: Record<string, unknown>,
  context: ToolExecutionContext,
  executeFn: (
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ) => Promise<T>
): Promise<T> {
  // 1. Create execution record
  const execution = await createExecutionRecord({
    toolName,
    params,
    status: "running",
    relationContext: context,
  });

  // 2. Update context with execution ID
  const updatedContext = {
    ...context,
    executionId: execution.id,
  };

  try {
    // 3. Execute the tool
    const result = await executeFn(params, updatedContext);

    // 4. Update execution record with result
    await updateExecutionRecord(execution.id, {
      status: result.success ? "completed" : "failed",
      result: result.data,
      error: result.error,
      affectedRows: result.data?.affectedRows as number,
      rollbackAvailable: result.canRollback,
    });

    // 5. Return result with execution ID
    return {
      ...result,
      executionId: execution.id,
    } as T;

  } catch (error) {
    // 6. Update execution record with error
    await updateExecutionRecord(execution.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    throw error;
  }
}

// ============================================
// Rollback Execution
// ============================================

export async function rollbackExecution(
  executionId: string,
  reason: string = "User requested rollback",
  rolledBackBy: string = "system"
): Promise<ToolExecutionResult> {
  const supabase = await createClient();

  try {
    // 1. Get the execution
    const execution = await getExecution(executionId);
    if (!execution) {
      return {
        success: false,
        message: "Execution not found",
        error: "Execution not found",
      };
    }

    if (!execution.rollback_available) {
      return {
        success: false,
        message: "This execution cannot be rolled back",
        error: "Rollback not available",
      };
    }

    // 2. Check if already rolled back
    if (execution.execution_status === "rolled_back") {
      return {
        success: false,
        message: "This execution has already been rolled back",
        error: "Already rolled back",
      };
    }

    // 3. Get the revision from execution result
    const result = execution.execution_result as Record<string, unknown> | null;
    const revisionId = result?.revisionId as string | undefined;

    if (revisionId) {
      // 4. Rollback the revision
      const { error: rollbackError } = await supabase.rpc("rollback_revision", {
        p_revision_id: revisionId,
        p_rollback_reason: reason,
        p_rolled_back_by: rolledBackBy,
      });

      if (rollbackError) {
        throw new Error(`Failed to rollback revision: ${rollbackError.message}`);
      }
    }

    // 5. Update execution status
    await updateExecutionRecord(executionId, {
      status: "rolled_back",
    });

    return {
      success: true,
      message: "Rollback completed successfully",
      data: {
        executionId,
        revisionId,
        rolledBackAt: new Date().toISOString(),
        reason,
      },
    };

  } catch (error) {
    return {
      success: false,
      message: `Rollback failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Get Execution Statistics
// ============================================

export async function getExecutionStats(
  companyId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  total: number;
  completed: number;
  failed: number;
  rolledBack: number;
  byTool: Record<string, number>;
}> {
  const supabase = await createClient();

  let query = supabase
    .from("agent_executions")
    .select("*");

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  if (startDate) {
    query = query.gte("started_at", startDate.toISOString());
  }

  if (endDate) {
    query = query.lte("started_at", endDate.toISOString());
  }

  const { data, error } = await query;

  if (error || !data) {
    return {
      total: 0,
      completed: 0,
      failed: 0,
      rolledBack: 0,
      byTool: {},
    };
  }

  const stats = {
    total: data.length,
    completed: data.filter((e) => e.execution_status === "completed").length,
    failed: data.filter((e) => e.execution_status === "failed").length,
    rolledBack: data.filter((e) => e.execution_status === "rolled_back").length,
    byTool: {} as Record<string, number>,
  };

  data.forEach((e) => {
    stats.byTool[e.execution_type] = (stats.byTool[e.execution_type] || 0) + 1;
  });

  return stats;
}
