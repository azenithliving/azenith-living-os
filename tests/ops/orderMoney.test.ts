// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Money has to land on a human, and only on the human it belongs to.
 *
 * An order used to carry a free-text name and nothing else, so the roll turned «عميل بلا
 * وسيلة تواصل» into a customer of its own — twice, in fact, because the same buyer already
 * had a line under his phone number. The rule these tests hold: an order speaks about a
 * person only through its owner; without one, its money is reported as unowned rather than
 * inventing somebody to carry it.
 */
const world = vi.hoisted(() => {
  const state = { tables: {} as Record<string, Record<string, unknown>[]> };
  const client = () => ({
    from(table: string) {
      return {
        select: () => Promise.resolve({ data: state.tables[table] ?? [], error: null }),
      };
    },
  });
  return { state, client };
});

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => world.client() as never }));

beforeEach(() => {
  world.state.tables = {
    users: [{ id: "u1", session_id: "s1", full_name: "علي سيد", phone: "01005554444", updated_at: "2026-09-20T10:00:00.000Z" }],
    consultant_sessions: [],
    requests: [],
    leads: [],
    bookings: [],
    lead_conversions: [],
    sales_orders: [
      { id: "o1", user_id: "u1", customer_name: "علي سيد", total_amount: 40000, deposit_amount: 8000, deposit_paid: true, updated_at: "2026-09-26T07:00:00.000Z" },
      { id: "o2", user_id: null, customer_name: "عميل بلا وسيلة تواصل", total_amount: 12000, deposit_amount: 3000, deposit_paid: false, updated_at: "2026-09-27T07:00:00.000Z" },
    ],
  };
});

const read = async () => {
  const { getSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const { readCustomers } = await import("@/lib/customers/read");
  return readCustomers(getSupabaseAdminClient() as never);
};

describe("an order and the money it carries", () => {
  it("puts the money on the owner, not on a second line", async () => {
    const roll = await read();
    expect(roll.totals.customers).toBe(1);
    const ali = roll.real[0];
    expect(ali.money).toEqual({ quoted: 40000, paid: 8000 });
    expect(ali.spaces).toContain("order");
  });

  it("counts an unowned order as money with no owner, never as a customer", async () => {
    const roll = await read();
    expect(roll.real.some((c) => c.name === "عميل بلا وسيلة تواصل")).toBe(false);
    expect(roll.totals.unowned).toEqual({ orders: 1, quoted: 12000, paid: 0 });
  });

  it("keeps the whole sum visible: owned plus unowned equals what the ledger holds", async () => {
    const roll = await read();
    const owned = roll.real.reduce((s, c) => s + c.money.quoted, 0);
    expect(owned + roll.totals.unowned.quoted).toBe(52000);
  });

  it("reads a paid flag as its amount, not as one pound", async () => {
    world.state.tables.sales_orders = [
      { id: "o1", user_id: "u1", total_amount: 40000, deposit_amount: 8000, deposit_paid: true, updated_at: "2026-09-26T07:00:00.000Z" },
    ];
    const roll = await read();
    expect(roll.real[0].money.paid).toBe(8000);
  });
});
