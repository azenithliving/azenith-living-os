import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// A recording stand-in for the database client: it answers by the same filters the
// door sends, so the test can read exactly which statements the door issued.
const world = vi.hoisted(() => {
  const state = {
    log: [] as string[],
    tables: {} as Record<string, { id: string; [key: string]: unknown }[]>,
    resistant: new Set<string>(),
  };

  const makeClient = () => ({
    from(table: string) {
      let op: "select" | "delete" = "select";
      return {
        select() {
          return this;
        },
        delete() {
          op = "delete";
          return this;
        },
        in(column: string, values: string[]) {
          const all = state.tables[table] ?? [];
          const matched = all.filter((row) => values.includes(String(row[column])));
          state.log.push(`${op} ${table} by ${column}[${values.length}] -> ${matched.length}`);
          if (op === "delete") {
            state.tables[table] = all.filter(
              (row) => !values.includes(String(row[column])) || state.resistant.has(row.id),
            );
          }
          const result = {
            then: (onOk: (v: unknown) => unknown) =>
              Promise.resolve({ data: matched.map((row) => ({ id: row.id })), error: null }).then(onOk),
            select: () => result,
          };
          return result;
        },
      };
    },
  });

  return { state, makeClient };
});

vi.mock("@/lib/admin-api-guard", () => ({
  requireAdminApi: async () => ({ user: { id: "admin-1", email: "owner@azenith" }, unauthorized: null }),
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () => world.makeClient() as never,
}));

const SESSION_KEY = "p6m4b-1790357584469";

function request(body: unknown): NextRequest {
  // The door only ever reads the JSON body, so a stand-in request is enough.
  return { json: async () => body } as unknown as NextRequest;
}

async function post(body: unknown) {
  const { POST } = await import("@/app/api/admin/leads/delete/route");
  const res = await POST(request(body));
  return { status: res.status, json: await res.json() };
}

const deletes = () => world.state.log.filter((entry) => entry.startsWith("delete"));

beforeEach(() => {
  world.state.log.length = 0;
  world.state.resistant.clear();
  world.state.tables = {
    consultant_sessions: [{ id: "s-1", session_id: SESSION_KEY }],
    users: [{ id: "u-1", session_id: SESSION_KEY }],
    requests: [{ id: "r-1", user_id: "u-1" }],
    visitor_telemetry: [
      { id: "t-1", session_id: SESSION_KEY },
      { id: "t-2", session_id: SESSION_KEY },
    ],
  };
});

describe("leads delete door", () => {
  it("reports the count per ledger and touches nothing until the owner confirms", async () => {
    const { status, json } = await post({ sessionIds: [SESSION_KEY] });

    expect(status).toBe(200);
    expect(json.preview).toBe(true);
    expect(json.ledgers).toEqual({
      consultantSessions: 1,
      users: 1,
      requests: 1,
      visitorTelemetry: 2,
      total: 5,
    });
    expect(deletes()).toEqual([]);
  });

  it("refuses a confirmed delete that declared a number the ledgers do not match", async () => {
    const { status, json } = await post({ sessionIds: [SESSION_KEY], confirm: true, expectedRows: 1 });

    expect(status).toBe(409);
    expect(json.reason).toBe("count-changed");
    expect(json.declared).toBe(1);
    expect(json.ledgers.total).toBe(5);
    expect(deletes()).toEqual([]);
  });

  it("refuses to report success when the records are already gone", async () => {
    world.state.tables = { consultant_sessions: [], users: [], requests: [], visitor_telemetry: [] };
    const { status, json } = await post({ sessionIds: [SESSION_KEY], confirm: true, expectedRows: 5 });

    expect(status).toBe(409);
    expect(json.measured.total).toBe(0);
    expect(deletes()).toEqual([]);
  });

  it("deletes only measured primary keys, requests first, and re-reads them before calling it done", async () => {
    const { status, json } = await post({ sessionIds: [SESSION_KEY], confirm: true, expectedRows: 5 });

    expect(status).toBe(200);
    expect(json).toMatchObject({ success: true, deletedTotal: 5, declared: 5, verified: true });
    expect(deletes()).toEqual([
      "delete requests by id[1] -> 1",
      "delete consultant_sessions by id[1] -> 1",
      "delete visitor_telemetry by id[2] -> 2",
      "delete users by id[1] -> 1",
    ]);
    expect(Object.values(world.state.tables).flat()).toEqual([]);
  });

  it("keeps a session key out of the uuid columns instead of erroring and reporting success", async () => {
    await post({ sessionIds: [SESSION_KEY] });

    expect(world.state.log).toContain("select consultant_sessions by session_id[1] -> 1");
    expect(world.state.log).toContain("select requests by user_id[1] -> 1");
    // No uuid was supplied, so no query may be aimed at a primary key column.
    expect(world.state.log.filter((entry) => entry.startsWith("select") && entry.includes(" by id["))).toEqual([]);
  });

  it("names the rows that survived the sweep instead of claiming a clean delete", async () => {
    world.state.resistant.add("t-2");
    const { status, json } = await post({ sessionIds: [SESSION_KEY], confirm: true, expectedRows: 5 });

    expect(status).toBe(500);
    expect(json.error).toBe("فاضل سجلات ما اتمسحتش");
    expect(json.residue.visitorTelemetry).toBe(1);
    expect(json.deleted.visitorTelemetry).toBe(2);
  });
});
