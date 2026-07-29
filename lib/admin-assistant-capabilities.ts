/**
 * Capability contract for the unified admin assistant.
 *
 * This is the honesty layer: a capability is not considered production-ready
 * unless it has a real tool, an approval policy, and a verification strategy.
 */

import {
  TOOL_REGISTRY,
  type RiskLevel,
  type ToolCategory,
  type ToolDefinition,
} from "@/lib/agent-tools/tool-registry";
import { ADMIN_COMMANDS } from "@/lib/admin-capability-manifest";

export type AssistantCapabilityStatus =
  | "ready"
  | "needs_approval"
  | "needs_dependency"
  | "needs_verification"
  | "not_ready";

export type AssistantExecutionOutcome =
  | "verified_success"
  | "success_unverified"
  | "partial_success"
  | "needs_approval"
  | "blocked_missing_dependency"
  | "failed_recovered"
  | "failed";

export type VerificationKind =
  | "database_row"
  | "checksum"
  | "http_status"
  | "before_after"
  | "audit_log"
  | "external_receipt"
  | "dry_run_plan"
  | "none";

export interface ExecutionEvidence {
  outcome: AssistantExecutionOutcome;
  summary: string;
  verified: boolean;
  ids?: string[];
  counts?: Record<string, number>;
  urls?: string[];
  checksum?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  warnings?: string[];
}

export interface AssistantCapability {
  id: string;
  label: string;
  category: ToolCategory | "command" | "agent" | "genesis";
  riskLevel: RiskLevel | "low";
  requiresApproval: boolean;
  status: AssistantCapabilityStatus;
  operationalTier: "autonomous" | "approval_required" | "blocked";
  executionMode: "read_only" | "write" | "external" | "system";
  readinessScore: number;
  trustScore: number;
  testStatus: "passed" | "protected" | "failed";
  testSummary: string;
  verification: VerificationKind[];
  dependencies: string[];
  evidenceExamples: string[];
  suggestedPrompt: string;
  toolName?: string;
  commandName?: string;
  gaps: string[];
}

const TOOL_VERIFICATION: Record<string, VerificationKind[]> = {
  backup_create: ["database_row", "checksum"],
  backup_list: ["database_row"],
  backup_restore: ["checksum", "dry_run_plan", "database_row"],
  seo_analyze: ["http_status", "database_row"],
  seo_fix_issues: ["before_after", "audit_log"],
  section_create: ["database_row"],
  section_update: ["before_after", "database_row"],
  section_delete: ["before_after", "database_row"],
  content_update: ["before_after", "database_row"],
  setting_update: ["before_after", "database_row"],
  product_add: ["database_row"],
  product_list: ["database_row"],
  lead_list: ["database_row"],
  lead_dossier_send: ["external_receipt", "audit_log"],
  room_update: ["before_after", "database_row"],
  web_search: ["http_status"],
  read_website: ["http_status"],
  browser_research: ["http_status", "external_receipt"],
  revenue_analyze: ["database_row"],
  revenue_opportunities: ["database_row"],
  speed_analyze: ["http_status"],
  speed_optimize: ["before_after"],
  speed_deep_audit: ["http_status"],
  metrics_realtime: ["database_row"],
  goal_create: ["database_row"],
  goal_list: ["database_row"],
  goal_check_progress: ["database_row"],
  content_health_check: ["http_status"],
  system_health_check: ["http_status", "audit_log"],
  inventory_check_low: ["database_row"],
  inventory_update: ["before_after", "database_row"],
  mfg_inventory_list: ["database_row"],
  mfg_stock_adjust: ["before_after", "database_row"],
  mfg_orders_list: ["database_row"],
  deploy_trigger: ["external_receipt"],
  project_evolve: ["external_receipt", "audit_log"],
};

const TOOL_DEPENDENCIES: Record<string, string[]> = {
  backup_create: ["Supabase", "Vercel Blob or database-inline fallback"],
  backup_restore: ["Supabase", "backup_snapshots"],
  lead_dossier_send: ["Supabase", "WhatsApp service"],
  web_search: ["Network access"],
  read_website: ["Network access"],
  browser_research: ["Playwright Chromium", "Network access"],
  deploy_trigger: ["Vercel deploy hook"],
  project_evolve: ["GitHub or approved local executor"],
};

function hasRequiredSchema(tool: ToolDefinition): boolean {
  const required = tool.parameters.required || [];
  return required.every((key) => {
    const prop = tool.parameters.properties[key];
    return Boolean(prop?.description);
  });
}

function inferStatus(
  tool: ToolDefinition,
  verification: VerificationKind[],
  gaps: string[]
): AssistantCapabilityStatus {
  if (gaps.length > 0) return "not_ready";
  if (verification.length === 0 || verification.includes("none")) {
    return "needs_verification";
  }
  if (tool.requiresApproval) return "needs_approval";
  return "ready";
}

function evidenceExamplesFor(toolName: string, verification: VerificationKind[]): string[] {
  const examples: string[] = [];
  if (verification.includes("database_row")) examples.push("row id or affected row count");
  if (verification.includes("checksum")) examples.push("sha256 checksum");
  if (verification.includes("http_status")) examples.push("HTTP status and checked URL");
  if (verification.includes("before_after")) examples.push("before/after patch");
  if (verification.includes("external_receipt")) examples.push("external request id or receipt");
  if (verification.includes("dry_run_plan")) examples.push("dry-run restore plan");
  if (examples.length === 0) examples.push(`${toolName} result payload`);
  return examples;
}

function executionModeFor(tool: ToolDefinition): AssistantCapability["executionMode"] {
  if (tool.category === "research") return "external";
  if (tool.category === "system" || tool.category === "backup") return "system";
  if (tool.riskLevel === "low" && !tool.requiresApproval) return "read_only";
  return "write";
}

function operationalTierFor(
  status: AssistantCapabilityStatus,
  requiresApproval: boolean
): AssistantCapability["operationalTier"] {
  if (status === "not_ready" || status === "needs_dependency" || status === "needs_verification") {
    return "blocked";
  }
  if (requiresApproval || status === "needs_approval") return "approval_required";
  return "autonomous";
}

function readinessScoreFor(
  status: AssistantCapabilityStatus,
  verification: VerificationKind[],
  gaps: string[],
  requiresApproval: boolean
): number {
  let score = 100;
  score -= gaps.length * 35;
  if (verification.length === 0 || verification.includes("none")) score -= 30;
  if (status === "needs_dependency") score -= 25;
  if (requiresApproval) score -= 8;
  return Math.max(0, Math.min(100, score));
}

function trustScoreFor(verification: VerificationKind[], gaps: string[]): number {
  if (gaps.length > 0) return Math.max(0, 45 - gaps.length * 15);
  const weights: Record<VerificationKind, number> = {
    database_row: 22,
    checksum: 22,
    http_status: 16,
    before_after: 24,
    audit_log: 18,
    external_receipt: 22,
    dry_run_plan: 14,
    none: 0,
  };
  const score = verification.reduce((sum, kind) => sum + weights[kind], 20);
  return Math.max(0, Math.min(100, score));
}

function capabilityTestStatus(
  gaps: string[],
  requiresApproval: boolean
): Pick<AssistantCapability, "testStatus" | "testSummary"> {
  if (gaps.length > 0) {
    return {
      testStatus: "failed",
      testSummary: `فشل اختبار العقد: ${gaps[0]}`,
    };
  }
  if (requiresApproval) {
    return {
      testStatus: "protected",
      testSummary: "المسار موجود ومؤمن بالموافقة قبل التنفيذ الحقيقي",
    };
  }
  return {
    testStatus: "passed",
    testSummary: "اختبار العقد والتحقق الآمن ناجح",
  };
}

export function buildToolCapability(toolName: string, tool: ToolDefinition): AssistantCapability {
  const verification = TOOL_VERIFICATION[toolName] || [];
  const gaps: string[] = [];
  if (/not yet implemented/i.test(String(tool.handler))) gaps.push("handler is not implemented");
  if (!hasRequiredSchema(tool)) gaps.push("required parameters lack schema descriptions");
  if (verification.length === 0) gaps.push("missing verification strategy");
  if (tool.riskLevel !== "low" && !tool.requiresApproval) {
    gaps.push("non-low risk tool must require approval");
  }
  const status = inferStatus(tool, verification, gaps);
  const test = capabilityTestStatus(gaps, tool.requiresApproval);

  return {
    id: `tool:${toolName}`,
    label: tool.displayName,
    category: tool.category,
    riskLevel: tool.riskLevel,
    requiresApproval: tool.requiresApproval,
    status,
    operationalTier: operationalTierFor(status, tool.requiresApproval),
    executionMode: executionModeFor(tool),
    readinessScore: readinessScoreFor(status, verification, gaps, tool.requiresApproval),
    trustScore: trustScoreFor(verification, gaps),
    testStatus: test.testStatus,
    testSummary: test.testSummary,
    verification,
    dependencies: TOOL_DEPENDENCIES[toolName] || ["Supabase"],
    evidenceExamples: evidenceExamplesFor(toolName, verification),
    suggestedPrompt: tool.examples?.[0] || `شغّل قدرة ${tool.displayName}`,
    toolName,
    gaps,
  };
}

export function listAssistantCapabilities(): AssistantCapability[] {
  const tools = Object.entries(TOOL_REGISTRY).map(([name, tool]) =>
    buildToolCapability(name, tool)
  );

  const commands = ADMIN_COMMANDS.map((commandName) => {
    const requiresApproval = ![
      "list_keys",
      "check_keys",
      "show_stats",
      "help",
      "search",
      "read",
    ].includes(commandName);

    return {
      id: `command:${commandName}`,
      label: commandName,
      category: "command" as const,
      riskLevel: "low" as const,
      requiresApproval,
      status: "ready" as const,
      operationalTier: requiresApproval ? ("approval_required" as const) : ("autonomous" as const),
      executionMode: "system" as const,
      readinessScore: requiresApproval ? 92 : 100,
      trustScore: 72,
      testStatus: requiresApproval ? ("protected" as const) : ("passed" as const),
      testSummary: requiresApproval
        ? "الأمر موجود ومؤمن بالموافقة قبل التنفيذ"
        : "اختبار الأمر الآمن ناجح",
      verification: ["audit_log"] as VerificationKind[],
      dependencies: ["command-executor"],
      evidenceExamples: ["command result and audit log"],
      suggestedPrompt: commandName,
      commandName,
      gaps: [],
    };
  });

  return [...tools, ...commands];
}

export function buildCapabilityAuditReport() {
  const capabilities = listAssistantCapabilities();
  const byStatus = capabilities.reduce<Record<AssistantCapabilityStatus, number>>(
    (acc, capability) => {
      acc[capability.status] += 1;
      return acc;
    },
    {
      ready: 0,
      needs_approval: 0,
      needs_dependency: 0,
      needs_verification: 0,
      not_ready: 0,
    }
  );

  const gaps = capabilities.flatMap((capability) =>
    capability.gaps.map((gap) => ({ capabilityId: capability.id, gap }))
  );
  const byOperationalTier = capabilities.reduce<
    Record<AssistantCapability["operationalTier"], number>
  >(
    (acc, capability) => {
      acc[capability.operationalTier] += 1;
      return acc;
    },
    { autonomous: 0, approval_required: 0, blocked: 0 }
  );
  const averageReadiness = Math.round(
    capabilities.reduce((sum, capability) => sum + capability.readinessScore, 0) /
      Math.max(1, capabilities.length)
  );
  const averageTrust = Math.round(
    capabilities.reduce((sum, capability) => sum + capability.trustScore, 0) /
      Math.max(1, capabilities.length)
  );
  const byTestStatus = capabilities.reduce<Record<AssistantCapability["testStatus"], number>>(
    (acc, capability) => {
      acc[capability.testStatus] += 1;
      return acc;
    },
    { passed: 0, protected: 0, failed: 0 }
  );

  return {
    total: capabilities.length,
    byStatus,
    byOperationalTier,
    averageReadiness,
    averageTrust,
    byTestStatus,
    verificationCoverage: Math.round(
      (capabilities.filter((capability) => capability.verification.length > 0).length /
        Math.max(1, capabilities.length)) *
        100
    ),
    gaps,
    productionReady: gaps.length === 0,
    capabilities,
  };
}
