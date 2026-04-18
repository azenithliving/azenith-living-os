/**
 * Ultimate Agent Security Manager
 *
 * "Trust but verify, always."
 *
 * Multi-layer security system for the Ultimate Intelligence Agent:
 * - Action classification by risk level
 * - Approval workflow management
 * - Audit logging
 * - Permission enforcement
 */

import { createClient as createServerClient } from "@/utils/supabase/server";
import { storeMemory } from "./memory-store";

// Risk levels for actions
export type RiskLevel = "info" | "normal" | "critical" | "forbidden";

// Action categories
export type ActionCategory =
  | "database_read"
  | "database_write"
  | "database_schema"
  | "file_read"
  | "file_write"
  | "api_call"
  | "env_change"
  | "deployment"
  | "external_service"
  | "system_command";

// Action definition
export interface AgentAction {
  id?: string;
  type: string;
  category: ActionCategory;
  description: string;
  payload: Record<string, unknown>;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  estimatedImpact: "low" | "medium" | "high";
  autoExecute?: boolean;
}

// Approval request
export interface ApprovalRequest {
  id?: string;
  actionId: string;
  actionType: string;
  description: string;
  riskLevel: RiskLevel;
  requestedAt: Date;
  expiresAt?: Date;
  status: "pending" | "approved" | "rejected" | "expired";
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  metadata?: Record<string, unknown>;
}

// Security policy
export interface SecurityPolicy {
  autoApproveNormal: boolean;
  autoApproveDatabaseRead: boolean;
  requireApprovalFor: RiskLevel[];
  forbiddenActions: string[];
  maxDailyCriticalActions: number;
  notificationChannels: string[];
}

export interface RelationContext {
  companyId?: string;
  actorUserId?: string;
  commandLogId?: string;
  approvalRequestId?: string;
}

// Default security policy
const DEFAULT_POLICY: SecurityPolicy = {
  autoApproveNormal: true,
  autoApproveDatabaseRead: true,
  requireApprovalFor: ["critical"],
  forbiddenActions: [
    "database_drop_table",
    "database_truncate",
    "file_delete_production",
    "env_delete_all",
    "system_rm_rf",
  ],
  maxDailyCriticalActions: 10,
  notificationChannels: ["whatsapp", "telegram", "email"],
};

// Risk classification rules
const RISK_RULES: Record<ActionCategory, { baseRisk: RiskLevel; modifiers: Record<string, RiskLevel> }> = {
  database_read: {
    baseRisk: "info",
    modifiers: {
      involves_sensitive_data: "normal",
      large_dataset: "normal",
    },
  },
  database_write: {
    baseRisk: "normal",
    modifiers: {
      bulk_update: "critical",
      involves_users: "critical",
      involves_payments: "critical",
    },
  },
  database_schema: {
    baseRisk: "critical",
    modifiers: {
      add_column: "normal",
      create_index: "normal",
      drop_column: "forbidden",
      drop_table: "forbidden",
    },
  },
  file_read: {
    baseRisk: "info",
    modifiers: {
      sensitive_config: "normal",
    },
  },
  file_write: {
    baseRisk: "normal",
    modifiers: {
      config_files: "critical",
      core_application: "critical",
      content_data: "normal",
    },
  },
  api_call: {
    baseRisk: "normal",
    modifiers: {
      external_payment: "critical",
      external_messaging: "normal",
    },
  },
  env_change: {
    baseRisk: "critical",
    modifiers: {
      add_variable: "normal",
      update_non_sensitive: "normal",
      delete_variable: "critical",
      update_api_keys: "critical",
    },
  },
  deployment: {
    baseRisk: "critical",
    modifiers: {
      preview: "normal",
      production: "critical",
    },
  },
  external_service: {
    baseRisk: "normal",
    modifiers: {
      whatsapp_message: "normal",
      email_broadcast: "critical",
      ad_spend: "critical",
    },
  },
  system_command: {
    baseRisk: "forbidden",
    modifiers: {},
  },
};

/**
 * Classify an action's risk level
 */
export function classifyRisk(
  action: Omit<AgentAction, "riskLevel" | "requiresApproval">
): { riskLevel: RiskLevel; requiresApproval: boolean } {
  const rules = RISK_RULES[action.category];
  let riskLevel = rules.baseRisk;

  // Check for modifiers in payload
  for (const [key] of Object.entries(action.payload)) {
    if (rules.modifiers[key]) {
      riskLevel = rules.modifiers[key];
    }
  }

  // Check if action is forbidden
  if (DEFAULT_POLICY.forbiddenActions.includes(action.type)) {
    riskLevel = "forbidden";
  }

  // Determine if approval is required
  const requiresApproval =
    riskLevel === "forbidden" ||
    DEFAULT_POLICY.requireApprovalFor.includes(riskLevel);

  return { riskLevel, requiresApproval };
}

/**
 * Validate an action against security policy
 */
export function validateAction(action: AgentAction): {
  allowed: boolean;
  reason?: string;
  suggestedAlternative?: string;
} {
  // Check forbidden actions
  if (action.riskLevel === "forbidden") {
    return {
      allowed: false,
      reason: `Action "${action.type}" is forbidden by security policy`,
      suggestedAlternative: "Consider using a safer alternative or contact administrator",
    };
  }

  // Check category restrictions
  if (action.category === "system_command") {
    return {
      allowed: false,
      reason: "System commands are forbidden for security",
    };
  }

  // All other actions allowed (subject to approval)
  return { allowed: true };
}

/**
 * Create an approval request
 */
export async function createApprovalRequest(
  action: AgentAction,
  metadata?: Record<string, unknown>,
  relationContext?: RelationContext
): Promise<{ success: boolean; request?: ApprovalRequest; error?: string }> {
  const supabase = await createServerClient();

  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    const approvalPayload = {
      action_id: action.id || crypto.randomUUID(),
      action_type: action.type,
      description: action.description,
      risk_level: action.riskLevel,
      requested_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      status: "pending",
      metadata: metadata || action.payload || {},
      company_id: relationContext?.companyId || null,
      actor_user_id: relationContext?.actorUserId || null,
      command_log_id: relationContext?.commandLogId || null,
    };

    let { data, error } = await supabase
      .from("approval_requests")
      .insert(approvalPayload)
      .select("*")
      .single();

    // Backward compatibility for older schemas without relation columns.
    if (error && error.code === "42703") {
      const legacyPayload = { ...approvalPayload } as Record<string, unknown>;
      delete legacyPayload.company_id;
      delete legacyPayload.actor_user_id;
      delete legacyPayload.command_log_id;
      const legacyInsert = await supabase
        .from("approval_requests")
        .insert(legacyPayload)
        .select("*")
        .single();
      data = legacyInsert.data;
      error = legacyInsert.error;
    }

    if (error) throw error;

    // Store in memory
    await storeMemory({
      type: "decision",
      category: "approval_request",
      content: `Approval requested for ${action.type}: ${action.description}`,
      priority: action.riskLevel === "critical" ? "critical" : "high",
      context: {
        actionId: action.id,
        riskLevel: action.riskLevel,
        approvalRequestId: data.id,
      },
    });

    const request: ApprovalRequest = {
      id: data.id,
      actionId: data.action_id,
      actionType: data.action_type,
      description: data.description,
      riskLevel: data.risk_level,
      requestedAt: new Date(data.requested_at),
      expiresAt: new Date(data.expires_at),
      status: data.status,
      metadata: data.metadata,
    };

    return { success: true, request };
  } catch (error) {
    console.error("[SecurityManager] Failed to create approval request:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get pending approval requests
 */
export async function getPendingApprovals(): Promise<{
  success: boolean;
  requests?: ApprovalRequest[];
  error?: string;
}> {
  const supabase = await createServerClient();

  try {
    const { data, error } = await supabase
      .from("approval_requests")
      .select("*")
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("requested_at", { ascending: false });

    if (error) throw error;

    const requests: ApprovalRequest[] = (data || []).map((row) => ({
      id: row.id,
      actionId: row.action_id,
      actionType: row.action_type,
      description: row.description,
      riskLevel: row.risk_level,
      requestedAt: new Date(row.requested_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      status: row.status,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
      rejectionReason: row.rejection_reason,
      metadata: row.metadata,
    }));

    return { success: true, requests };
  } catch (error) {
    console.error("[SecurityManager] Failed to get approvals:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Approve a request AND execute the approved action
 */
export async function approveRequest(
  requestId: string,
  approvedBy: string
): Promise<{ success: boolean; error?: string; executedAction?: { type: string; result: unknown } }> {
  const supabase = await createServerClient();

  try {
    // First, get the request details to know what to execute
    const { data: request, error: fetchError } = await supabase
      .from("approval_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchError) throw fetchError;
    if (!request) return { success: false, error: "Request not found" };

    // Update status to approved
    const { error } = await supabase
      .from("approval_requests")
      .update({
        status: "approved",
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) throw error;

    // Now execute the approved action based on action_type
    let executedAction: { type: string; result: unknown } | undefined;
    
    try {
      const metadata = (request.metadata as Record<string, unknown>) || {};

      if (metadata.executor === "tool") {
        const toolName = typeof metadata.toolName === "string" ? metadata.toolName : undefined;
        const params =
          metadata.params && typeof metadata.params === "object"
            ? (metadata.params as Record<string, unknown>)
            : {};

        if (!toolName) {
          return {
            success: false,
            error: "Approved request is missing toolName metadata",
          };
        }

        const result = await import("@/lib/architect-tools").then((m) => m.executeTool(toolName, params));
        if (!result.success) {
          return {
            success: false,
            error: result.message || `Failed to execute approved tool "${toolName}"`,
          };
        }

        executedAction = { type: toolName, result };
      } else if (request.action_type === "site_theme_change" || request.action_type === "site_background_change") {
        const themeKey = (metadata.key as "theme" | "seo" | "general") || "theme";
        const themeValue =
          metadata.value && typeof metadata.value === "object"
            ? (metadata.value as Record<string, unknown>)
            : {};

        const result = await import("@/lib/architect-tools").then((m) =>
          m.updateSiteSetting({ key: themeKey, value: themeValue })
        );
        if (!result.success) {
          return {
            success: false,
            error: result.message || "Failed to execute approved site setting change",
          };
        }
        executedAction = { type: request.action_type, result };
      } else if (request.action_type === "create_automation_rule") {
        const result = await import("@/lib/architect-tools").then((m) =>
          m.createAutomationRule({
            name: (metadata.name as string) || "New automation rule",
            trigger:
              (metadata.trigger as
                | "page_visit"
                | "form_submit"
                | "booking_status_changed"
                | "lead_updated"
                | "time_delay"
                | "user_registered") || "page_visit",
            conditions:
              metadata.conditions && typeof metadata.conditions === "object"
                ? (metadata.conditions as Record<string, unknown>)
                : {},
            actions: Array.isArray(metadata.actions)
              ? (metadata.actions as Array<{ type: string; message?: string; intent?: string }>)
              : [],
            enabled: true,
          })
        );
        if (!result.success) {
          return {
            success: false,
            error: result.message || "Failed to execute approved automation rule",
          };
        }
        executedAction = { type: "create_automation_rule", result };
      } else {
        return {
          success: false,
          error: `No executor registered for approved action "${request.action_type}"`,
        };
      }
    } catch (execError) {
      console.error("[SecurityManager] Action execution failed:", execError);
      return {
        success: false,
        error: execError instanceof Error ? execError.message : "Unknown execution error",
      };
    }

    // Log the approval
    await storeMemory({
      type: "decision",
      category: "approval_granted",
      content: `Request ${requestId} approved by ${approvedBy} - action executed: ${executedAction?.type || 'none'}`,
      priority: "high",
      context: { requestId, approvedBy, executedAction },
    });

    return { success: true, executedAction };
  } catch (error) {
    console.error("[SecurityManager] Failed to approve request:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Reject a request
 */
export async function rejectRequest(
  requestId: string,
  rejectedBy: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();

  try {
    const { error } = await supabase
      .from("approval_requests")
      .update({
        status: "rejected",
        approved_by: rejectedBy,
        approved_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq("id", requestId);

    if (error) throw error;

    // Log the rejection with learning
    await storeMemory({
      type: "learning",
      category: "approval_rejected",
      content: `Request ${requestId} rejected by ${rejectedBy}. Reason: ${reason}`,
      priority: "high",
      context: { requestId, rejectedBy, reason },
    });

    return { success: true };
  } catch (error) {
    console.error("[SecurityManager] Failed to reject request:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if an action is approved
 */
export async function isActionApproved(
  actionId: string
): Promise<{ approved: boolean; request?: ApprovalRequest }> {
  const supabase = await createServerClient();

  try {
    const { data, error } = await supabase
      .from("approval_requests")
      .select("*")
      .eq("action_id", actionId)
      .eq("status", "approved")
      .single();

    if (error || !data) {
      return { approved: false };
    }

    return {
      approved: true,
      request: {
        id: data.id,
        actionId: data.action_id,
        actionType: data.action_type,
        description: data.description,
        riskLevel: data.risk_level,
        requestedAt: new Date(data.requested_at),
        expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
        status: data.status,
        approvedBy: data.approved_by,
        approvedAt: data.approved_at ? new Date(data.approved_at) : undefined,
        metadata: data.metadata,
      },
    };
  } catch {
    return { approved: false };
  }
}

/**
 * Log an audit event
 */
export async function logAuditEvent(
  eventType: string,
  action: string,
  actor: string,
  details: Record<string, unknown>,
  result: "success" | "failure" | "blocked",
  relationContext?: RelationContext
): Promise<void> {
  const supabase = await createServerClient();

  try {
    const payload = {
      event_type: eventType,
      action,
      actor,
      details,
      result,
      timestamp: new Date().toISOString(),
      company_id: relationContext?.companyId || null,
      actor_user_id: relationContext?.actorUserId || null,
      approval_request_id: relationContext?.approvalRequestId || null,
      command_log_id: relationContext?.commandLogId || null,
    };

    const insertResult = await supabase.from("audit_log").insert(payload);
    if (insertResult.error && insertResult.error.code === "42703") {
      const legacyPayload = { ...payload } as Record<string, unknown>;
      delete legacyPayload.company_id;
      delete legacyPayload.actor_user_id;
      delete legacyPayload.approval_request_id;
      delete legacyPayload.command_log_id;
      await supabase.from("audit_log").insert(legacyPayload);
    }
  } catch (error) {
    console.error("[SecurityManager] Failed to log audit event:", error);
  }
}

/**
 * Get recent audit events
 */
export async function getAuditEvents(
  limit: number = 100,
  eventType?: string
): Promise<{
  success: boolean;
  events?: Array<{
    id: string;
    eventType: string;
    action: string;
    actor: string;
    details: Record<string, unknown>;
    result: string;
    timestamp: Date;
  }>;
  error?: string;
}> {
  const supabase = await createServerClient();

  try {
    let query = supabase
      .from("audit_log")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (eventType) {
      query = query.eq("event_type", eventType);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      success: true,
      events: (data || []).map((row) => ({
        id: row.id,
        eventType: row.event_type,
        action: row.action,
        actor: row.actor,
        details: row.details,
        result: row.result,
        timestamp: new Date(row.timestamp),
      })),
    };
  } catch (error) {
    console.error("[SecurityManager] Failed to get audit events:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check daily critical action limit
 */
export async function checkDailyCriticalLimit(): Promise<{
  allowed: boolean;
  remaining: number;
}> {
  const supabase = await createServerClient();

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from("audit_log")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "critical_action")
      .gte("timestamp", today.toISOString());

    if (error) throw error;

    const remaining = DEFAULT_POLICY.maxDailyCriticalActions - (count || 0);
    return {
      allowed: remaining > 0,
      remaining: Math.max(0, remaining),
    };
  } catch (error) {
    console.error("[SecurityManager] Failed to check limit:", error);
    return { allowed: false, remaining: 0 };
  }
}

/**
 * Get security statistics
 */
export async function getSecurityStats(): Promise<{
  success: boolean;
  stats?: {
    totalAuditEvents: number;
    pendingApprovals: number;
    approvedToday: number;
    rejectedToday: number;
    criticalActionsToday: number;
  };
  error?: string;
}> {
  const supabase = await createServerClient();

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get pending approvals
    const { count: pendingCount } = await supabase
      .from("approval_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    // Get approved today
    const { count: approvedCount } = await supabase
      .from("approval_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved")
      .gte("approved_at", today.toISOString());

    // Get rejected today
    const { count: rejectedCount } = await supabase
      .from("approval_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "rejected")
      .gte("approved_at", today.toISOString());

    // Get critical actions today
    const { count: criticalCount } = await supabase
      .from("audit_log")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "critical_action")
      .gte("timestamp", today.toISOString());

    // Get total audit events
    const { count: totalEvents } = await supabase
      .from("audit_log")
      .select("*", { count: "exact", head: true });

    return {
      success: true,
      stats: {
        totalAuditEvents: totalEvents || 0,
        pendingApprovals: pendingCount || 0,
        approvedToday: approvedCount || 0,
        rejectedToday: rejectedCount || 0,
        criticalActionsToday: criticalCount || 0,
      },
    };
  } catch (error) {
    console.error("[SecurityManager] Failed to get stats:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
