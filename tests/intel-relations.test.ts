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
  });

  it("rejects unauthenticated calls", async () => {
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
  });

  it("returns unified success contract in fallback mode", async () => {
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
  });
});
