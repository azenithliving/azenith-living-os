import type { AssistantExecutionEntry } from "@/lib/admin-assistant-log";

export type AssistantEvidenceOutcome =
  | "verified_success"
  | "approval_pending"
  | "failed"
  | "unverified";

export interface AssistantEvidenceItem {
  id: string;
  tool: string;
  outcome: AssistantEvidenceOutcome;
  confidence: number;
  summary: string;
  proof: string[];
  startedAt: string;
  durationMs: number | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringifyProof(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function collectProof(result: Record<string, unknown>): string[] {
  const proof: string[] = [];
  const candidates = [
    ["executionId", "execution"],
    ["approvalId", "approval"],
    ["snapshotId", "snapshot"],
    ["backupId", "backup"],
    ["id", "row"],
    ["checksum", "checksum"],
    ["storageProvider", "storage"],
    ["affectedRows", "affected rows"],
    ["affectedCount", "affected rows"],
    ["url", "url"],
    ["status", "status"],
  ] as const;

  for (const [key, label] of candidates) {
    const rendered = stringifyProof(result[key]);
    if (rendered) proof.push(`${label}: ${rendered}`);
  }

  const data = asRecord(result.data);
  for (const [key, label] of candidates) {
    const rendered = stringifyProof(data[key]);
    if (rendered) proof.push(`${label}: ${rendered}`);
  }

  return [...new Set(proof)].slice(0, 5);
}

export function summarizeAssistantEvidence(
  execution: AssistantExecutionEntry
): AssistantEvidenceItem {
  const result = asRecord(execution.execution_result);
  const data = asRecord(execution.execution_data);
  const tool = String(data.tool || execution.execution_type.replace("assistant:", ""));
  const proof = collectProof(result);
  const success = result.success !== false && execution.execution_status === "success";
  const requiresApproval = result.requiresApproval === true || Boolean(result.approvalId);

  if (requiresApproval) {
    return {
      id: execution.id,
      tool,
      outcome: "approval_pending",
      confidence: proof.length > 0 ? 82 : 70,
      summary: "التنفيذ متوقف بأمان حتى موافقة المالك.",
      proof: proof.length > 0 ? proof : ["approval required"],
      startedAt: execution.started_at,
      durationMs: execution.execution_time_ms,
    };
  }

  if (!success) {
    return {
      id: execution.id,
      tool,
      outcome: "failed",
      confidence: 100,
      summary:
        stringifyProof(result.message) ||
        stringifyProof(result.error) ||
        "فشل التنفيذ وتم تسجيل السبب.",
      proof: proof.length > 0 ? proof : ["failure recorded"],
      startedAt: execution.started_at,
      durationMs: execution.execution_time_ms,
    };
  }

  if (proof.length > 0) {
    return {
      id: execution.id,
      tool,
      outcome: "verified_success",
      confidence: Math.min(100, 76 + proof.length * 6),
      summary: stringifyProof(result.message) || "نجاح موثق بدليل تنفيذ.",
      proof,
      startedAt: execution.started_at,
      durationMs: execution.execution_time_ms,
    };
  }

  return {
    id: execution.id,
    tool,
    outcome: "unverified",
    confidence: 45,
    summary: "تم تسجيل نجاح التنفيذ، لكن النتيجة لا تحتوي دليلا كافيا.",
    proof: ["execution log only"],
    startedAt: execution.started_at,
    durationMs: execution.execution_time_ms,
  };
}

export function buildAssistantEvidenceLedger(executions: AssistantExecutionEntry[]) {
  const items = executions.map(summarizeAssistantEvidence);
  const byOutcome = items.reduce<Record<AssistantEvidenceOutcome, number>>(
    (acc, item) => {
      acc[item.outcome] += 1;
      return acc;
    },
    {
      verified_success: 0,
      approval_pending: 0,
      failed: 0,
      unverified: 0,
    }
  );
  const averageConfidence = Math.round(
    items.reduce((sum, item) => sum + item.confidence, 0) / Math.max(1, items.length)
  );

  return {
    total: items.length,
    byOutcome,
    averageConfidence,
    items,
  };
}
