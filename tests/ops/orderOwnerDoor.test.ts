// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The one write that turns an unowned order into a customer's money.
 *
 * It exists because the order ledger carries a typed name and no handle: five orders,
 * three named, and none of the names matches a profile, so no machine may attach them.
 * The owner does it with his eyes; this door only accepts what he points at — an order
 * that exists and a customer whose profile exists — and writes exactly one column.
 */
const world = vi.hoisted(() => {
  const state = { writes: [] as Array<{ table: string; values: Record<string, unknown> }>, profileExists: true };
  const row = (data: Record<string, unknown> | null) => {
    const q: any = {
      eq: () => q,
      select: () => q,
      maybeSingle: () => Promise.resolve({ data, error: null }),
      single: () => Promise.resolve({ data, error: data ? null : { message: "no row" } }),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ data, error: null }).then(res, rej),
    };
    return q;
  };
  const client = () => ({
    from(table: string) {
      const found = (t: string) =>
        t === "sales_orders" ? { id: "o1", user_id: null } : state.profileExists ? { id: "u1" } : null;
      return {
        select: () => row(found(table)),
        update: (values: Record<string, unknown>) => {
          state.writes.push({ table, values });
          return row(table === "sales_orders" ? { id: "o1", user_id: values.user_id } : null);
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

const post = async (body: unknown) => {
  const { POST } = await import("@/app/api/admin/customers/orders/route");
  const req = { json: async () => body } as never;
  const res = await POST(req);
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

const UUID = "2f1c9a34-7b0e-4d3a-9a11-6c2d5e8f0a1b";

beforeEach(() => {
  world.state.writes.length = 0;
});

describe("attaching an order to its customer", () => {
  it("writes the owner and nothing else", async () => {
    const res = await post({ orderId: UUID, userId: UUID });
    expect(res.status).toBe(200);
    expect(world.state.writes).toEqual([{ table: "sales_orders", values: { user_id: UUID } }]);
  });

  it("refuses an id that is not an id, in Arabic", async () => {
    const res = await post({ orderId: "1; drop table sales_orders", userId: UUID });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/[؀-ۿ]/);
    expect(world.state.writes).toEqual([]);
  });

  it("refuses to attach money to a customer who does not exist", async () => {
    world.state.profileExists = false;
    const res = await post({ orderId: UUID, userId: UUID });
    world.state.profileExists = true;
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/[؀-ۿ]/);
    expect(world.state.writes).toEqual([]);
  });

  it("takes the owner off again when the owner says so", async () => {
    const res = await post({ orderId: UUID, userId: null });
    expect(res.status).toBe(200);
    expect(world.state.writes).toEqual([{ table: "sales_orders", values: { user_id: null } }]);
  });
});
