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

  // ── مرشّحات المستوى الأول (result مباشرة) ────────────────────────────
  const topLevel: Array<[string, string]> = [
    ["executionId",   "execution"],
    ["approvalId",    "approval"],
    ["snapshotId",    "snapshot"],
    ["backupId",      "backup"],
    ["revisionId",    "revision"],
    ["id",            "row"],
    ["checksum",      "checksum"],
    ["storageProvider","storage"],
    ["affectedRows",  "affected rows"],
    ["affectedCount", "affected rows"],
    ["url",           "url"],
    ["status",        "status"],
    ["seoScore",      "seo score"],
    ["score",         "score"],
    ["entityId",      "entity"],
    ["entityType",    "entity type"],
  ];

  for (const [key, label] of topLevel) {
    const rendered = stringifyProof(result[key]);
    if (rendered) proof.push(`${label}: ${rendered}`);
  }

  // ── مرشّحات من result.data ────────────────────────────────────────────
  const data = asRecord(result.data);
  const dataLevel: Array<[string, string]> = [
    ["backupId",      "backup"],
    ["revisionId",    "revision"],
    ["sectionId",     "section"],
    ["entityId",      "entity"],
    ["entityType",    "entity type"],
    ["id",            "row"],
    ["checksum",      "checksum"],
    ["downloadUrl",   "download url"],
    ["storageProvider","storage"],
    ["affectedRows",  "affected rows"],
    ["score",         "score"],
    ["seoScore",      "seo score"],
    ["url",           "url"],
    ["leadId",        "lead"],
    ["tier",          "tier"],
    ["channel",       "channel"],
    ["plan",          "plan"],
  ];

  for (const [key, label] of dataLevel) {
    const rendered = stringifyProof(data[key]);
    if (rendered) proof.push(`${label}: ${rendered}`);
  }

  // ── before/after (أهم دليل للتغييرات) ───────────────────────────────
  const before = asRecord(data.before ?? result.before);
  const after  = asRecord(data.after  ?? result.after);
  const changedFields = Object.keys(after).filter(
    (k) => JSON.stringify(after[k]) !== JSON.stringify(before[k])
  );
  if (changedFields.length > 0) {
    const sample = changedFields.slice(0, 2);
    proof.push(`before→after: ${sample.map((f) => `${f}="${String(before[f] ?? "—")}"→"${String(after[f])}"`).join(", ")}`);
  }

  // ── affectedFields ────────────────────────────────────────────────────
  const affectedFields = Array.isArray(data.affectedFields) ? (data.affectedFields as string[]) : [];
  if (affectedFields.length > 0) {
    proof.push(`fields: ${affectedFields.slice(0, 4).join(", ")}`);
  }

  // ── canRollback ───────────────────────────────────────────────────────
  if (data.canRollback === true || result.canRollback === true) {
    proof.push("rollback: available");
  }

  return [...new Set(proof)].slice(0, 6);
}

export function summarizeAssistantEvidence(
  execution: AssistantExecutionEntry
): AssistantEvidenceItem {
  const result  = asRecord(execution.execution_result);
  const execData = asRecord(execution.execution_data);
  const tool    = String(execData.tool || execution.execution_type.replace("assistant:", ""));
  const proof   = collectProof(result);

  const success         = result.success !== false && execution.execution_status === "success";
  const requiresApproval = result.requiresApproval === true || Boolean(result.approvalId) ||
    String(result.message ?? "").toLowerCase().includes("approval");

  // ── موافقة معلقة ─────────────────────────────────────────────────────
  if (requiresApproval) {
    const approvalId = stringifyProof(result.approvalId ?? asRecord(result.data).approvalId ?? asRecord(result.data).requestId);
    return {
      id: execution.id,
      tool,
      outcome: "approval_pending",
      confidence: proof.length > 0 ? 82 : 70,
      summary: `طلب موافقة مُنشأ${approvalId ? ` (${approvalId.slice(0, 18)}…)` : ""}. التنفيذ متوقف حتى موافقة المالك.`,
      proof: proof.length > 0 ? proof : ["approval required"],
      startedAt: execution.started_at,
      durationMs: execution.execution_time_ms,
    };
  }

  // ── فشل ──────────────────────────────────────────────────────────────
  if (!success) {
    const errorMsg = stringifyProof(result.error ?? result.message) ?? "فشل التنفيذ";
    return {
      id: execution.id,
      tool,
      outcome: "failed",
      confidence: 100,
      summary: errorMsg.slice(0, 140),
      proof: proof.length > 0 ? proof : ["failure recorded"],
      startedAt: execution.started_at,
      durationMs: execution.execution_time_ms,
    };
  }

  // ── نجاح موثّق (proof موجود) ─────────────────────────────────────────
  if (proof.length > 0) {
    const msgRaw = stringifyProof(result.message) ?? "";
    // ابنِ summary من الـ proof الأهم
    const data = asRecord(result.data);
    let summary = msgRaw;
    if (!summary || summary.length < 8) {
      if (data.backupId)   summary = `نسخة احتياطية مكتملة — ID: ${String(data.backupId).slice(0, 18)}`;
      else if (data.revisionId) summary = `تحديث محتوى مع revision — ${String(data.revisionId).slice(0, 18)}`;
      else if (data.sectionId)  summary = `قسم مُنشأ — ID: ${String(data.sectionId).slice(0, 18)}`;
      else if (data.score !== undefined) summary = `تحليل مكتمل — نتيجة: ${data.score}/100`;
      else summary = "نجاح موثّق بدليل تنفيذ.";
    }
    return {
      id: execution.id,
      tool,
      outcome: "verified_success",
      confidence: Math.min(100, 76 + proof.length * 5),
      summary: summary.slice(0, 160),
      proof,
      startedAt: execution.started_at,
      durationMs: execution.execution_time_ms,
    };
  }

  // ── نجاح بدون دليل كافٍ ──────────────────────────────────────────────
  return {
    id: execution.id,
    tool,
    outcome: "unverified",
    confidence: 45,
    summary: "تم تسجيل نجاح التنفيذ، لكن النتيجة لا تحتوي دليلاً كافياً.",
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
