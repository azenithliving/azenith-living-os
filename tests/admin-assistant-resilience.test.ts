import { describe, expect, it, vi, beforeEach } from "vitest";
import { isGenericAiFailureMessage, formatCommandResultForUser } from "@/lib/admin-response-format";

vi.mock("@/lib/admin-sovereign-mind", () => ({
  createAdminProposal: vi.fn(async () => ({
    success: true,
    requestId: "test-req-1",
  })),
}));

vi.mock("@/lib/admin-intent-classifier", () => ({
  classifyAdminIntent: vi.fn(async (message: string) => {
    if (/list_keys/i.test(message)) {
      return {
        kind: "command",
        command: "list_keys",
        commandLine: "list_keys",
        confidence: 1,
      };
    }
    if (/VIP|غرفة|حدّث|حدث/i.test(message)) {
      return { kind: "agents", confidence: 0.9, reasoning: "test-agents" };
    }
    return { kind: "conversation", confidence: 0.6 };
  }),
  detectActionOrientedRequest: vi.fn((message: string) => /حدّث|غرفة/i.test(message)),
  needsMultiAgentMission: vi.fn(() => false),
}));

vi.mock("@/lib/mastermind-ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mastermind-ai")>();
  return {
    ...actual,
    generateAIResponse: vi.fn(async () => "مشكلة تقنية مؤقتة. جرب مرة أخرى."),
    loadHistory: vi.fn(async () => []),
    saveMessage: vi.fn(async () => undefined),
  };
});

vi.mock("@/lib/command-executor", () => ({
  executeCommand: vi.fn(async (line: string) => ({
    success: true,
    message: `executed ${line}`,
    data: {
      keys: [{ provider: "groq", status: "active", totalRequests: 10 }],
      total: 1,
    },
  })),
}));

vi.mock("@/lib/aaca-client", () => ({
  runAdminAgentMission: vi.fn(async () => ({
    delegated: true,
    message: "تم تكليف الوكلاء السحابيين.",
    task: { id: "t1" },
  })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(async () => ({ data: [] })),
          })),
        })),
      })),
      insert: vi.fn(async () => ({ error: null })),
    })),
  })),
}));

describe("admin assistant resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("never surfaces generic AI failure when command succeeded", async () => {
    const { processAdminNaturalLanguage } = await import(
      "@/lib/admin-natural-brain"
    );
    const result = await processAdminNaturalLanguage("list_keys", {
      sessionId: "test-session",
      userId: "00000000-0000-0000-0000-000000000001",
      userEmail: "admin@test.com",
      bypassRls: true,
      isOwner: true,
    });

    expect(isGenericAiFailureMessage(result.message)).toBe(false);
    expect(result.message).toMatch(/مفتاح|executed|groq/i);
  }, 15_000);

  it("escalates unprogrammed action to agents not empty chat", async () => {
    const { processAdminNaturalLanguage } = await import(
      "@/lib/admin-natural-brain"
    );
    const result = await processAdminNaturalLanguage(
      "حدّث صور غرفة الـ VIP وارفعها على الموقع",
      {
        sessionId: "test-session-2",
        userId: "00000000-0000-0000-0000-000000000001",
        userEmail: "admin@test.com",
      }
    );

    expect(result.message).toMatch(/أحتاج إذنك|موافقة|عقل النظام/i);
  }, 15_000);

  it("formatCommandResultForUser handles list_keys data", () => {
    const text = formatCommandResultForUser(
      {
        success: true,
        message: "ok",
        data: { keys: [{ provider: "groq" }], total: 1 },
      },
      "list_keys"
    );
    expect(text).toContain("groq");
    expect(isGenericAiFailureMessage(text)).toBe(false);
  });
});
