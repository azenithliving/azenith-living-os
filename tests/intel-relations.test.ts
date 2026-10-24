import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/company-resolver", () => ({
  resolvePrimaryCompanyId: vi.fn(async () => "00000000-0000-0000-0000-000000000001"),
}));

/**
 * The door reads the record the only way it can be read from a serverless function: by asking for
 * the columns and listening to the refusal. These fakes answer the way the live store was measured
 * to answer on 2026-10-24 — 42703 naming a column it does not have, PGRST205 for a table it does
 * not have, and an empty row list with no error for a table that has the column but no rows.
 */
const FULL_SCHEMA: Record<string, string[]> = {
  automation_rules: ["company_id", "enabled"],
  approval_requests: ["company_id", "actor_user_id", "command_log_id"],
  audit_log: ["company_id", "actor_user_id", "approval_request_id", "command_log_id"],
  agent_memory: [
    "memory_type",
    "type",
    "category",
    "content",
    "context",
    "user_id",
    "priority",
    "outcome",
    "user_feedback",
    "expires_at",
  ],
};

type TableAnswer = string[] | "ABSENT" | "REFUSED";

function recordClient(shape: Record<string, TableAnswer>) {
  const calls: string[] = [];
  const client = {
    from: (table: string) => ({
      select: (projection: string) => ({
        limit: () => {
          calls.push(`${table}?${projection}`);
          const answer = shape[table];
          if (answer === "ABSENT") {
            return Promise.resolve({
              data: null,
              error: { code: "PGRST205", message: `Could not find the table 'public.${table}'` },
            });
          }
          if (answer === "REFUSED") {
            return Promise.resolve({
              data: null,
              error: { code: "42501", message: "permission denied for table " + table },
            });
          }
          const asked = projection.split(",");
          const missing = asked.filter((column) => !answer.includes(column));
          if (missing.length > 0) {
            return Promise.resolve({
              data: null,
              error: { code: "42703", message: `column ${table}.${missing[0]} does not exist` },
            });
          }
          return Promise.resolve({ data: [], error: null });
        },
      }),
    }),
  };
  return { client, calls };
}

async function loadDoor(client: unknown) {
  vi.resetModules();
  vi.doMock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => client }));
  return await import("../app/api/admin/intel/relations/health/route");
}

const ask = () =>
  new Request("http://localhost:3000/api/admin/intel/relations/health", {
    headers: { "x-admin-user-id": "admin-test" },
  });

describe("Intel Relations Health API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("refuses a caller with no identity, and asks the record nothing", async () => {
    const { client, calls } = recordClient(FULL_SCHEMA);
    const { GET } = await loadDoor(client);

    const response = await GET(
      new Request("http://localhost:3000/api/admin/intel/relations/health")
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(calls).toEqual([]);
  });

  it("answers 500 when the store's own credential is missing", async () => {
    const { GET } = await loadDoor(null);
    const response = await GET(ask());

    expect(response.status).toBe(500);
    expect((await response.json()).success).toBe(false);
  });

  it("calls the schema healthy when every column the code writes answers", async () => {
    const { client, calls } = recordClient(FULL_SCHEMA);
    const { GET } = await loadDoor(client);

    const json = await (await GET(ask())).json();

    expect(json.success).toBe(true);
    expect(json.data.healthy).toBe(true);
    expect(json.data.totalMissing).toBe(0);
    expect(json.data.unreadableTables).toEqual([]);
    expect(json.data.absentTables).toEqual([]);
    expect(json.message).toBe("Intel relation schema is healthy");
    expect(json.meta.migrationHint).toBe("No table is missing a column the code writes");
    // One round trip per table: a healthy record is not probed column by column.
    expect(calls).toHaveLength(Object.keys(FULL_SCHEMA).length);
  });

  it("names the exact columns the record refuses", async () => {
    const { client } = recordClient({ ...FULL_SCHEMA, audit_log: ["event_type", "actor", "result"] });
    const { GET } = await loadDoor(client);

    const json = await (await GET(ask())).json();
    const audit = json.data.checks.find((check: { table: string }) => check.table === "audit_log");

    expect(json.data.healthy).toBe(false);
    expect(audit.readFailed).toBe(false);
    expect(audit.tableMissing).toBe(false);
    expect(audit.missingColumns).toEqual([
      "company_id",
      "actor_user_id",
      "approval_request_id",
      "command_log_id",
    ]);
    expect(json.data.totalMissing).toBe(4);
    expect(json.data.gapTables).toEqual(["audit_log"]);
    expect(json.message).toContain("Columns missing in: audit_log");
    expect(json.meta.migrationHint).toContain("audit_log");
  });

  it("calls an absent table absent, not a column gap", async () => {
    const { client } = recordClient({ ...FULL_SCHEMA, audit_log: "ABSENT" });
    const { GET } = await loadDoor(client);

    const json = await (await GET(ask())).json();
    const audit = json.data.checks.find((check: { table: string }) => check.table === "audit_log");

    expect(audit.tableMissing).toBe(true);
    expect(audit.missingColumns).toEqual([]);
    expect(json.data.totalMissing).toBe(0);
    expect(json.data.absentTables).toEqual(["audit_log"]);
    expect(json.data.healthy).toBe(false);
    expect(json.message).toContain("Table absent from the record: audit_log");
    expect(json.meta.migrationHint).toContain("audit_log (absent)");
  });

  it("admits an unreadable record instead of inventing a gap", async () => {
    const { client } = recordClient({
      automation_rules: "REFUSED",
      approval_requests: "REFUSED",
      audit_log: "REFUSED",
      agent_memory: "REFUSED",
    });
    const { GET } = await loadDoor(client);

    const json = await (await GET(ask())).json();

    expect(json.data.unreadableTables).toEqual([
      "automation_rules",
      "approval_requests",
      "audit_log",
      "agent_memory",
    ]);
    for (const check of json.data.checks) {
      expect(check.readFailed, check.table).toBe(true);
      expect(check.missingColumns, check.table).toEqual([]);
      expect(check.healthy, check.table).toBe(false);
    }
    expect(json.data.totalMissing).toBe(0);
    expect(json.message).toContain("Schema read unavailable for:");
    expect(json.meta.migrationHint).toBe("No gap measured — this door cannot read the schema");
  });

  it("keeps counting a half-read table as unreadable", async () => {
    const client = {
      from: (table: string) => ({
        select: (projection: string) => ({
          limit: () => {
            if (table !== "agent_memory") {
              return Promise.resolve({ data: [], error: null });
            }
            if (projection.includes(",")) {
              return Promise.resolve({
                data: null,
                error: { code: "42703", message: "column agent_memory.outcome does not exist" },
              });
            }
            if (projection === "outcome") {
              return Promise.resolve({
                data: null,
                error: { code: "42703", message: "column agent_memory.outcome does not exist" },
              });
            }
            if (projection === "user_feedback") {
              return Promise.resolve({
                data: null,
                error: { code: "42501", message: "permission denied for table agent_memory" },
              });
            }
            return Promise.resolve({ data: [], error: null });
          },
        }),
      }),
    };
    const { GET } = await loadDoor(client);

    const json = await (await GET(ask())).json();
    const memory = json.data.checks.find((check: { table: string }) => check.table === "agent_memory");

    expect(memory.readFailed).toBe(true);
    expect(memory.missingColumns).toEqual(["outcome"]);
    expect(memory.healthy).toBe(false);
    expect(json.data.unreadableTables).toEqual(["agent_memory"]);
  });

  it("reads the record, never a system view the store cannot serve", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/admin/intel/relations/health/route.ts"),
      "utf8"
    );

    expect(source).not.toContain("information_schema");
    expect(source).toContain("MEMORY_WRITE_COLUMNS");
    expect(source).toMatch(/select\(columns\.join\(","\)\)/);
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
