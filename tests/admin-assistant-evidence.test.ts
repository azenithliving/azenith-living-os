import { describe, expect, it } from "vitest";
import { buildAssistantEvidenceLedger } from "@/lib/admin-assistant-evidence";
import type { AssistantExecutionEntry } from "@/lib/admin-assistant-log";

function execution(
  overrides: Partial<AssistantExecutionEntry>
): AssistantExecutionEntry {
  return {
    id: "exec-1",
    execution_type: "assistant:backup_create",
    execution_status: "success",
    execution_data: { tool: "backup_create", userMessage: "backup settings" },
    execution_result: { success: true, checksum: "abc123", snapshotId: "snap-1" },
    started_at: "2026-05-17T12:00:00.000Z",
    execution_time_ms: 120,
    ...overrides,
  };
}

describe("assistant evidence ledger", () => {
  it("classifies execution outcomes by proof strength", () => {
    const ledger = buildAssistantEvidenceLedger([
      execution({ id: "verified" }),
      execution({
        id: "approval",
        execution_result: { success: true, requiresApproval: true, approvalId: "apr-1" },
      }),
      execution({
        id: "failed",
        execution_status: "failure",
        execution_result: { success: false, message: "tool failed" },
      }),
      execution({
        id: "unverified",
        execution_result: { success: true, message: "done" },
      }),
    ]);

    expect(ledger.total).toBe(4);
    expect(ledger.byOutcome.verified_success).toBe(1);
    expect(ledger.byOutcome.approval_pending).toBe(1);
    expect(ledger.byOutcome.failed).toBe(1);
    expect(ledger.byOutcome.unverified).toBe(1);
    expect(ledger.items.find((item) => item.id === "verified")?.proof).toContain(
      "snapshot: snap-1"
    );
  });
});
