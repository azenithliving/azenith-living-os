import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/company-resolver", () => ({
  resolvePrimaryCompanyId: vi.fn(async () => "00000000-0000-0000-0000-000000000001"),
}));

describe("Intel Relations Health API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when admin header is missing", async () => {
    vi.doMock("@/lib/supabase-admin", () => ({
      getSupabaseAdminClient: vi.fn(() => null),
    }));

    const { GET } = await import("../app/api/admin/intel/relations/health/route");
    const response = await GET(new Request("http://localhost:3000/api/admin/intel/relations/health"));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
  });

  it("reports healthy schema when required columns exist", async () => {
    const columnsByTable: Record<string, string[]> = {
      automation_rules: ["company_id", "enabled", "is_active"],
      approval_requests: ["company_id", "actor_user_id", "command_log_id"],
      audit_log: ["company_id", "actor_user_id", "approval_request_id", "command_log_id"],
      agent_memory: ["company_id", "actor_user_id", "source_table", "source_id"],
    };

    const queryState: { tableName?: string } = {};
    const builder: {
      eq: (column: string, value: string) => unknown;
    } = {
      eq(column: string, value: string) {
        if (column === "table_name") {
          queryState.tableName = value;
          const rows = (columnsByTable[value] || []).map((columnName) => ({ column_name: columnName }));
          return Promise.resolve({ data: rows, error: null });
        }
        return builder;
      },
    };

    vi.doMock("@/lib/supabase-admin", () => ({
      getSupabaseAdminClient: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => builder),
        })),
      })),
    }));

    const { GET } = await import("../app/api/admin/intel/relations/health/route");
    const response = await GET(
      new Request("http://localhost:3000/api/admin/intel/relations/health", {
        headers: { "x-admin-user-id": "admin-test" },
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.healthy).toBe(true);
    expect(json.data.totalMissing).toBe(0);
    expect(Array.isArray(json.data.checks)).toBe(true);
    expect(queryState.tableName).toBeDefined();
  });
});

describe("Smart Agent API Contract", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock("@/lib/architect-tools", () => ({
      updateSiteSetting: vi.fn(async () => ({ success: true, message: "updated", data: {} })),
      createAutomationRule: vi.fn(async () => ({ success: true, message: "created", data: {} })),
      getAnalyticsReport: vi.fn(async () => ({ success: true, message: "report", data: {} })),
      getSystemHealth: vi.fn(async () => ({ success: true, message: "healthy", data: {} })),
    }));
    vi.doMock("@/lib/ai-orchestrator", () => ({
      askOrchestratorMessages: vi.fn(async () => ({
        success: true,
        content: JSON.stringify({
          kind: "conversation",
          confidence: 0.9,
          reasoning: "test",
        }),
      })),
    }));
    vi.doMock("@/lib/mastermind-ai", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/mastermind-ai")>();
      return {
        ...actual,
        generateAIResponse: vi.fn(async () => "مرحباً من الاختبار"),
        loadHistory: vi.fn(async () => []),
        saveMessage: vi.fn(async () => undefined),
      };
    });
  });

  it("rejects unauthenticated calls", async () => {
    vi.doMock("@/lib/architect-tools", () => ({
      updateSiteSetting: vi.fn(),
      createAutomationRule: vi.fn(),
      getAnalyticsReport: vi.fn(),
      getSystemHealth: vi.fn(),
    }));
    // The guard answers from the headers alone. Without this, importing the route pulls the whole
    // brain (keys pool, providers, database) and the transform of that graph — not the assertion —
    // is what ran past 15 seconds when the suite ran all at once (measured 2026-10-07, twice).
    vi.doMock("@/lib/admin-natural-brain", () => ({
      processAdminNaturalLanguageReply: vi.fn(async () => ({ reply: "", meta: {} })),
    }));
    /**
     * The stub above is the fix; this is the tripwire. Re-measured 2026-10-09: 56ms alone and
     * 173–223ms inside two full runs, so the 15 seconds was the import graph, not the assertion.
     * Any network call that comes back into this path now fails the guard instead of hiding
     * behind a long timeout.
     */
    const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue(new Error("لا شبكة في حارس التوثيق"));

    const { POST } = await import("../app/api/admin/agent/smart/route");
    const response = await POST(
      new Request("http://localhost:3000/api/admin/agent/smart", {
        method: "POST",
        body: JSON.stringify({ message: "اهلا" }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  }, 3_000);

  it("returns unified success contract in fallback mode", async () => {
    // Mock admin natural brain
    vi.doMock("@/lib/admin-natural-brain", () => ({
      processAdminNaturalLanguageReply: vi.fn(async () => ({
        success: true,
        reply: "تم التنفيذ بنجاح",
        executed: false,
        data: null,
      })),
    }));

    const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("network down"));
    const { POST } = await import("../app/api/admin/agent/smart/route");
    const response = await POST(
      new Request("http://localhost:3000/api/admin/agent/smart", {
        method: "POST",
        headers: { "x-admin-user-id": "admin-test" },
        body: JSON.stringify({ message: "اهلا" }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(typeof json.reply).toBe("string");
    expect(json.meta.actorId).toBe("admin-test");

    fetchSpy.mockRestore();
  }, 30_000);
});
