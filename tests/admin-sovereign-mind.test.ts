import { describe, expect, it, vi } from "vitest";
import { requiresOwnerApproval } from "@/lib/admin-approval-policy";
vi.mock("@/lib/ai-orchestrator", () => ({
  askOrchestratorMessages: vi.fn(),
}));

describe("admin approval policy", () => {
  it("auto-allows list_keys", () => {
    expect(
      requiresOwnerApproval({
        kind: "command",
        command: "list_keys",
        confidence: 1,
      })
    ).toBe(false);
  });

  it("requires approval for agents and genesis", () => {
    expect(requiresOwnerApproval({ kind: "agents", confidence: 1 })).toBe(true);
    expect(requiresOwnerApproval({ kind: "genesis", confidence: 1 })).toBe(true);
  });

  it("requires approval for evolve", () => {
    expect(
      requiresOwnerApproval({
        kind: "command",
        command: "evolve",
        confidence: 1,
      })
    ).toBe(true);
  });
});

describe("sovereign mind fallbacks", () => {
  it("proposes key check after failures when AI unavailable", async () => {
    const { askOrchestratorMessages } = await import("@/lib/ai-orchestrator");
    vi.mocked(askOrchestratorMessages).mockResolvedValueOnce({
      success: false,
      content: "",
    });
    const { thinkAndPropose } = await import("@/lib/admin-sovereign-mind");
    const obs = { recentFailures: 2, pendingApprovals: 0 };
    const { proposals } = await thinkAndPropose(obs, { maxProposals: 2 });
    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals[0]?.intent.kind).toBe("command");
  }, 15_000);
});
