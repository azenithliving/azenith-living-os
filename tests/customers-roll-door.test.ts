import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The customers roll door, read as a human would: what does it ask the database for,
 * and what does it hand back? The important assertion is the one nobody can fake —
 * it never sends a write, because this address exists to end a disagreement between
 * two screens, not to change a row.
 */
const world = vi.hoisted(() => {
  const state = { log: [] as string[], tables: {} as Record<string, Record<string, unknown>[]> };
  const client = () => ({
    from(table: string) {
      return {
        select(columns: string) {
          state.log.push(`select ${table}`);
          void columns;
          return Promise.resolve({ data: state.tables[table] ?? [], error: null });
        },
        insert(values: Record<string, unknown>) {
          state.log.push(`insert ${table}`);
          void values;
          return Promise.resolve({ data: null, error: null });
        },
        delete() {
          state.log.push(`delete ${table}`);
          return { in: () => Promise.resolve({ data: null, error: null }) };
        },
      };
    },
  });
  return { state, client };
});

vi.mock("@/lib/admin-api-guard", () => ({
  requireAdminApi: async () => ({ user: { id: "admin-1" }, unauthorized: null }),
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => world.client() as never }));

const writes = () => world.state.log.filter((l) => !l.startsWith("select"));

beforeEach(() => {
  world.state.log.length = 0;
  world.state.tables = {
    users: [
      { id: "u1", session_id: "s1", full_name: "علي سيد", phone: "01005554444", tier: "silver", updated_at: "2026-09-20T10:00:00.000Z" },
    ],
    consultant_sessions: [{ id: "c1", session_id: "s1", updated_at: "2026-09-25T17:00:00.000Z" }],
    requests: [{ id: "r1", user_id: "u1", price: 60000, paid: 15000, updated_at: "2026-09-25T07:00:00.000Z" }],
    leads: [{ id: "l1", name: "هلا", phone: "+20 111 222 3344", updated_at: "2026-09-28T07:00:00.000Z" }],
    sales_orders: [{ id: "o1", customer_name: "عميل بلا وسيلة تواصل", total_amount: 1000, updated_at: "2026-09-21T07:00:00.000Z" }],
    bookings: [],
    lead_conversions: [{ id: "v1", session_id: "s9", contactMethod: "phone", contactValue: "01223334455", updated_at: "2026-09-24T07:00:00.000Z" }],
  };
});

describe("the customers roll door", () => {
  it("reads every space and writes nothing", async () => {
    const { GET } = await import("@/app/api/admin/customers/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(world.state.log.sort()).toEqual([
      "select bookings", "select consultant_sessions", "select lead_conversions",
      "select leads", "select requests", "select sales_orders", "select users",
    ]);
    expect(writes()).toEqual([]);
  });

  it("answers one line per human, with the money and the spaces attached", async () => {
    const { GET } = await import("@/app/api/admin/customers/route");
    const body = await (await GET()).json();
    const ali = body.customers.find((c: { name: string }) => c.name === "علي سيد");
    expect(ali.spaces).toEqual(["profile", "conversation", "quote"]);
    expect(ali.money).toEqual({ quoted: 60000, paid: 15000 });
    expect(body.totals.customers).toBe(4);
    expect(body.totals.bySpace.profile).toBe(1);
  });

  it("counts what it cannot identify instead of dropping it quietly", async () => {
    world.state.tables.sales_orders = [{ id: "o1", total_amount: 1000, updated_at: "2026-09-21T07:00:00.000Z" }];
    const { GET } = await import("@/app/api/admin/customers/route");
    const body = await (await GET()).json();
    expect(body.totals.anonymous).toBe(1);
    expect(body.totals.rowsRead).toBeGreaterThan(0);
  });

  it("says so when a ledger refuses to answer, instead of returning an empty list", async () => {
    const { getSupabaseAdminClient } = await import("@/lib/supabase-admin");
    void getSupabaseAdminClient;
    const broken = { from: () => ({ select: () => Promise.resolve({ data: null, error: { message: "permission denied" } }) }) };
    vi.doMock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => broken as never }));
    vi.resetModules();
    const { GET } = await import("@/app/api/admin/customers/route");
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/[\u0600-\u06FF]/);
    expect(body.failures.length).toBe(7);
    vi.doUnmock("@/lib/supabase-admin");
  });
});
