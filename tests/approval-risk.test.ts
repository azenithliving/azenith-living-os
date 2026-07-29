import { describe, expect, it } from "vitest";
import { normalizeApprovalRiskLevel } from "@/lib/approval-risk";

describe("approval risk normalization", () => {
  it("maps internal risk levels to approval_requests database values", () => {
    expect(normalizeApprovalRiskLevel("low")).toBe("info");
    expect(normalizeApprovalRiskLevel("medium")).toBe("normal");
    expect(normalizeApprovalRiskLevel("high")).toBe("critical");
    expect(normalizeApprovalRiskLevel("destructive")).toBe("forbidden");
  });

  it("preserves existing database-compatible risk values", () => {
    expect(normalizeApprovalRiskLevel("info")).toBe("info");
    expect(normalizeApprovalRiskLevel("normal")).toBe("normal");
    expect(normalizeApprovalRiskLevel("critical")).toBe("critical");
    expect(normalizeApprovalRiskLevel("forbidden")).toBe("forbidden");
  });
});
