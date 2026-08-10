import { describe, expect, test, vi, beforeEach } from "vitest";
import { GET as fateGet, POST as fatePost, PATCH as fatePatch } from "@/app/api/admin/fate/route";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { NextRequest } from "next/server";

// ── Admin API guard mock (unit tests run outside a real session) ──────────
vi.mock("@/lib/admin-api-guard", () => ({
  requireAdminApi: vi.fn().mockResolvedValue({
    user: { id: "test-admin", email: "admin@test.local" },
    unauthorized: null,
  }),
}));

// ── Supabase admin mock: thenable chain builder ───────────────────────────
// Each awaited query resolves to the next result in the queue (last one repeats).
function makeQ(results: any[]) {
  let i = 0;
  const q: any = {};
  const chain = () => q;
  q.from = vi.fn(chain);
  q.select = vi.fn(chain);
  q.eq = vi.fn(chain);
  q.gte = vi.fn(chain);
  q.order = vi.fn(chain);
  q.limit = vi.fn(chain);
  q.in = vi.fn(chain);
  q.insert = vi.fn(chain);
  q.update = vi.fn(chain);
  Object.defineProperty(q, "then", {
    value: (resolve: (v: any) => void, _reject: (e: any) => void) => {
      const r = results[Math.min(i, results.length - 1)];
      i++;
      resolve(r);
    },
  });
  return q;
}

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

function makeRequest(url: string, body?: object): NextRequest {
  const req = new NextRequest(url) as NextRequest;
  const headers = new Headers({ "content-type": "application/json" });
  Object.defineProperty(req, "headers", { value: headers, writable: true, configurable: true });
  if (body !== undefined) {
    Object.defineProperty(req, "json", {
      value: vi.fn().mockResolvedValue(body),
      writable: true,
      configurable: true,
    });
  }
  return req;
}

function lastSupabaseInstance(): any {
  const results = vi.mocked(getSupabaseAdminClient).mock.results;
  return results[results.length - 1]?.value;
}

describe("Fate Control API (Part 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("1. POST single-session trigger inserts an active mutation row", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      makeQ([{ data: [{ id: "m1", action: "THUNDER", session_id: "s1" }], error: null }])
    );

    const res = await fatePost(makeRequest("http://localhost:3000/api/admin/fate", { sessionId: "s1", action: "THUNDER" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    const sup = lastSupabaseInstance();
    const insertArgs = vi.mocked(sup.insert).mock.calls[0][0];
    expect(insertArgs.session_id).toBe("s1");
    expect(insertArgs.action).toBe("THUNDER");
    expect(insertArgs.active).toBe(true);
    expect(insertArgs.type).toBe("FATE_ACTION");
  });

  test("2. POST global broadcast dedupes and targets every active session", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      makeQ([
        { data: [{ session_id: "a" }, { session_id: "b" }, { session_id: "a" }], error: null },
        { data: null, error: null },
      ])
    );

    const res = await fatePost(makeRequest("http://localhost:3000/api/admin/fate", { action: "QUANTUM_OFFER", global: true }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.global).toBe(true);
    expect(data.targetedSessions).toBe(2);

    const sup = lastSupabaseInstance();
    const insertRows = vi.mocked(sup.insert).mock.calls[0][0];
    expect(insertRows).toHaveLength(2);
    expect(insertRows.map((r: any) => r.session_id).sort()).toEqual(["a", "b"]);
  });

  test("3. POST global with no active sessions records a __GLOBAL__ marker", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      makeQ([
        { data: [], error: null },
        { data: null, error: null },
      ])
    );

    const res = await fatePost(makeRequest("http://localhost:3000/api/admin/fate", { action: "FREEZE", global: true }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.targetedSessions).toBe(0);

    const sup = lastSupabaseInstance();
    expect(vi.mocked(sup.insert).mock.calls[0][0].session_id).toBe("__GLOBAL__");
  });

  test("4. GET lists mutations with customer names and active sessions", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      makeQ([
        {
          data: [
            { id: "m1", session_id: "s1", action: "THUNDER", active: true, created_at: "2026-01-01T00:00:00Z" },
            { id: "m2", session_id: "__GLOBAL__", action: "FREEZE", active: false, created_at: "2026-01-01T00:00:00Z" },
          ],
          error: null,
        },
        { data: [{ session_id: "s1", insights: { userName: "سالم" } }], error: null },
        { data: [{ session_id: "s1", insights: { userName: "سالم" }, updated_at: "2026-01-01T00:00:00Z" }], error: null },
      ])
    );

    const res = await fateGet(makeRequest("http://localhost:3000/api/admin/fate"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.mutations).toHaveLength(2);
    expect(data.mutations[0].name).toBe("سالم");
    expect(data.mutations[1].name).toBeUndefined();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].name).toBe("سالم");
  });

  test("5. PATCH deactivates a single mutation by id", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(makeQ([{ data: null, error: null }]));

    const res = await fatePatch(makeRequest("http://localhost:3000/api/admin/fate", { id: "m1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    const sup = lastSupabaseInstance();
    expect(vi.mocked(sup.update).mock.calls[0][0]).toEqual({ active: false });
    const eqCalls = vi.mocked(sup.eq).mock.calls.map((c) => c[0]);
    expect(eqCalls).toContain("id");
  });

  test("6. PATCH { all: true } is the emergency kill-switch", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(makeQ([{ data: null, error: null }]));

    const res = await fatePatch(makeRequest("http://localhost:3000/api/admin/fate", { all: true }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    const sup = lastSupabaseInstance();
    expect(vi.mocked(sup.update).mock.calls[0][0]).toEqual({ active: false });
  });

  test("7. POST rejects missing target (no sessionId, not global)", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(makeQ([]));
    const res = await fatePost(makeRequest("http://localhost:3000/api/admin/fate", { action: "THUNDER" }));
    expect(res.status).toBe(400);
  });

  test("8. POST rejects unknown fate action", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(makeQ([]));
    const res = await fatePost(makeRequest("http://localhost:3000/api/admin/fate", { sessionId: "s1", action: "PLOT_TWIST" }));
    expect(res.status).toBe(400);
  });
});
