/**
 * Unified Approval System
 * 
 * نظام موافقات موحد يربط بين Tool Registry والأدوات الحقيقية
 * - Creates approval requests for tools that require it
 * - Links approvals to Tool Registry
 * - Handles approval execution with real tools
 */

// The service-role client, not the public one: `approval_requests` is RLS-locked
// to `auth.jwt()->>'role' = 'admin'`, and a server route holding the anon key
// has no such claim — so every read answered "Approval request not found" on rows
// that exist, and the owner's decision could never be recorded. This is the same
// class of bug that silently killed the approval queue's own GET endpoint.
import { supabaseServer } from "@/lib/dal/unified-supabase";
import { TOOL_REGISTRY, executeTool, getTool, type ToolExecutionContext } from "./tool-registry";
import { createExecutionRecord, updateExecutionRecord } from "./execution-tracker";
import { logAuditEvent } from "@/lib/ultimate-agent/security-manager";
import type { Json } from "@/lib/supabase/database.types";
import { normalizeApprovalRiskLevel } from "@/lib/approval-risk";
import { buildApprovalRow } from "@/lib/ops/approval-intake";

export interface ApprovalRequest {
  id: string;
  toolName: string;
  params: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired";
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  executionContext: ToolExecutionContext;
}

export interface CreateApprovalInput {
  toolName: string;
  params: Record<string, unknown>;
  context: ToolExecutionContext;
  requestedBy: string;
  description?: string;
  expiresInMinutes?: number;
}

export interface ApprovalResult {
  success: boolean;
  requiresApproval: boolean;
  approvalId?: string;
  message: string;
  error?: string;
}

// ============================================
// Check if Tool Requires Approval
// ============================================

export function requiresApproval(toolName: string): boolean {
  const tool = getTool(toolName);
  return tool?.requiresApproval ?? false;
}

// ============================================
// Create Approval Request
// ============================================

/**
 * The cause, in words. A driver rejection is a plain object (`{ message, code, details, hint }`), not
 * an `Error`, and `error instanceof Error ? … : "Unknown error"` threw the whole reason away — which
 * is how a door ends up telling its owner that something failed and nothing about what.
 */
function causeOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  const shaped = error as { message?: unknown; error_description?: unknown; code?: unknown } | null;
  const message = typeof shaped?.message === "string" ? shaped.message : typeof shaped?.error_description === "string" ? shaped.error_description : null;
  if (message) return shaped?.code ? `${message} (${String(shaped.code)})` : message;
  try {
    return String(error ?? "Unknown error").slice(0, 300);
  } catch {
    return "Unknown error";
  }
}

export async function createApprovalRequest(
  input: CreateApprovalInput
): Promise<ApprovalResult> {
  const supabase = supabaseServer;

  try {
    const tool = getTool(input.toolName);
    if (!tool) {
      return {
        success: false,
        requiresApproval: false,
        message: `Tool "${input.toolName}" not found`,
        error: "Unknown tool",
      };
    }

    // The row is shaped by the module that already owns this table's rules: `action_id` is a uuid
    // column and this caller is naming the action, not identifying a row. Measured live 2026-10-19:
    // passing the tool name here made every approval insert die with «invalid input syntax for type
    // uuid» (code 22P02), so no destructive tool could ever raise a decision for the owner.
    const shaped = buildApprovalRow(
      {
        action_id: input.toolName,
        action_type: input.toolName,
        description: input.description || `Execute ${tool.displayName}`,
        risk_level: normalizeApprovalRiskLevel(tool.riskLevel),
        expires_at: input.expiresInMinutes
          ? new Date(Date.now() + input.expiresInMinutes * 60 * 1000).toISOString()
          : undefined,
        metadata: {
          toolName: input.toolName,
          params: input.params,
          executionContext: input.context,
        },
      },
      (input.context?.companyId as string | null | undefined) ?? null
    );
    if (!shaped.ok) {
      return {
        success: false,
        requiresApproval: true,
        message: "Failed to create approval request",
        error: shaped.error,
      };
    }

    const { data: approval, error } = await supabase
      .from("approval_requests")
      .insert(shaped.row)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log audit event
    await logAuditEvent(
      "approval_requested",
      `Approval requested for ${tool.displayName}`,
      input.requestedBy,
      { toolName: input.toolName, params: input.params },
      "success"
    );

    return {
      success: true,
      requiresApproval: true,
      approvalId: approval.id,
      message: `Approval required for ${tool.displayName}. Request ID: ${approval.id}`,
    };

  } catch (error) {
    return {
      success: false,
      requiresApproval: true,
      message: "Failed to create approval request",
      error: causeOf(error),
    };
  }
}

// ============================================
// Get Pending Approvals
// ============================================

export async function getPendingApprovals(
  companyId?: string,
  limit: number = 50
): Promise<ApprovalRequest[]> {
  const supabase = supabaseServer;

  const query = supabase
    .from("approval_requests")
    .select("*")
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(limit);

  // Note: approval_requests table doesn't have company_id directly
  // We filter by the context stored in metadata if needed

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    toolName: row.action_type,
    params: (row.metadata as Record<string, unknown>)?.params as Record<string, unknown>,
    status: row.status as "pending" | "approved" | "rejected" | "expired",
    requestedBy: "unknown", // We don't store this directly
    requestedAt: row.requested_at,
    approvedBy: row.approved_by || undefined,
    approvedAt: row.approved_at || undefined,
    rejectedBy: undefined,
    rejectedAt: undefined,
    rejectionReason: row.rejection_reason || undefined,
    executionContext: ((row.metadata as Record<string, unknown>)?.executionContext as ToolExecutionContext) || {},
  }));
}

// ============================================
// Approve Request
// ============================================

export async function approveRequest(
  approvalId: string,
  approvedBy: string,
  reason?: string
): Promise<{
  success: boolean;
  message: string;
  executionResult?: {
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  };
}> {
  const supabase = supabaseServer;

  try {
    // Get approval request
    const { data: approval, error: fetchError } = await supabase
      .from("approval_requests")
      .select("*")
      .eq("id", approvalId)
      .single();

    if (fetchError || !approval) {
      return {
        success: false,
        message: "Approval request not found",
      };
    }

    if (approval.status !== "pending") {
      return {
        success: false,
        message: `Request already ${approval.status}`,
      };
    }

    // Check expiration
    if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
      await supabase
        .from("approval_requests")
        .update({ status: "expired" })
        .eq("id", approvalId);

      return {
        success: false,
        message: "Approval request has expired",
      };
    }

    // Update approval status
    await supabase
      .from("approval_requests")
      .update({
        status: "approved",
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        ...(reason && { approval_notes: reason }),
      })
      .eq("id", approvalId);

    // Get stored params and context
    const metadata = approval.metadata as Record<string, unknown>;
    const toolName = metadata?.toolName as string;
    const params = metadata?.params as Record<string, unknown>;
    const context = (metadata?.executionContext as ToolExecutionContext) || {};

    // Create execution record
    const execution = await createExecutionRecord({
      toolName,
      params,
      status: "running",
      relationContext: context,
    });

    // Execute the tool
    const result = await executeTool(toolName, params, {
      ...context,
      executionId: execution.id,
    });

    // Update execution record
    await updateExecutionRecord(execution.id, {
      status: result.success ? "completed" : "failed",
      result: result.data,
      error: result.error,
      rollbackAvailable: result.canRollback,
    });

    // Log audit event
    await logAuditEvent(
      "approval_executed",
      `Approved and executed ${toolName}`,
      approvedBy,
      { approvalId, toolName, success: result.success },
      result.success ? "success" : "failure"
    );

    return {
      success: true,
      message: `Approved and executed ${toolName}`,
      executionResult: {
        success: result.success,
        data: result.data,
        error: result.error,
      },
    };

  } catch (error) {
    return {
      success: false,
      message: `Failed to process approval: ${causeOf(error)}`,
    };
  }
}

// ============================================
// Reject Request
// ============================================

export async function rejectRequest(
  approvalId: string,
  rejectedBy: string,
  reason?: string
): Promise<{
  success: boolean;
  message: string;
}> {
  const supabase = supabaseServer;

  try {
    const { data: approval, error: fetchError } = await supabase
      .from("approval_requests")
      .select("*")
      .eq("id", approvalId)
      .single();

    if (fetchError || !approval) {
      return {
        success: false,
        message: "Approval request not found",
      };
    }

    if (approval.status !== "pending") {
      return {
        success: false,
        message: `Request already ${approval.status}`,
      };
    }

    await supabase
      .from("approval_requests")
      .update({
        status: "rejected",
        rejection_reason: reason || "No reason provided",
      })
      .eq("id", approvalId);

    // Log audit event
    await logAuditEvent(
      "approval_rejected",
      `Rejected approval request ${approvalId}`,
      rejectedBy,
      { approvalId, reason },
      "success"
    );

    return {
      success: true,
      message: "Approval request rejected",
    };

  } catch (error) {
    return {
      success: false,
      message: `Failed to reject approval: ${causeOf(error)}`,
    };
  }
}

// ============================================
// Execute Tool with Approval Check
// ============================================

export async function executeWithApproval(
  toolName: string,
  params: Record<string, unknown>,
  context: ToolExecutionContext,
  skipApproval: boolean = false
): Promise<{
  success: boolean;
  message: string;
  requiresApproval?: boolean;
  approvalId?: string;
  error?: string;
  executionResult?: {
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  };
}> {
  // Check if tool requires approval
  const tool = getTool(toolName);
  if (!tool) {
    return {
      success: false,
      message: `Tool "${toolName}" not found`,
    };
  }

  // If no approval required or skip requested, execute directly
  if (!tool.requiresApproval || skipApproval) {
    const result = await executeTool(toolName, params, context);
    return {
      success: result.success,
      message: result.message,
      executionResult: {
        success: result.success,
        data: result.data,
        error: result.error,
      },
    };
  }

  // Create approval request
  const approvalResult = await createApprovalRequest({
    toolName,
    params,
    context,
    requestedBy: context.actorUserId || "system",
    description: `Execute ${tool.displayName}`,
  });

  return {
    // Measured live 2026-10-19: this used to answer `success: true` even when the approval row was
    // never written — the writer reports its own failure, and swallowing it here is how a store
    // teaches its owner to trust a failure.
    success: approvalResult.success,
    requiresApproval: true,
    approvalId: approvalResult.approvalId,
    message: approvalResult.message,
    error: approvalResult.error,
  };
}
