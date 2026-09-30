// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

/**
 * The scenario door is a what-if machine, and it used to write.
 *
 * Measured on the live store: the two customers in the lead ledger and the two 350,000
 * orders in the sales ledger are its residue — a fake buyer with a fake phone who then
 * showed up on the owner's customers screen as a real person, twice. A demo that plants
 * rows in the ledgers the dashboards count is not a demo, it is a false witness.
 *
 * These tests hold the line: the door may read, it may propose, it may not write.
 */
const world = vi.hoisted(() => {
  const state = { writes: [] as string[] };
  const chain = (table: string, data: unknown = null) => {
    const q: any = {
      eq: () => q,
      ilike: () => q,
      limit: () => q,
      select: () => q,
      single: () => Promise.resolve({ data, error: null }),
      maybeSingle: () => Promise.resolve({ data, error: null }),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ data, error: null, count: 0 }).then(res, rej),
    };
    ["insert", "update", "delete"].forEach((verb) => {
      q[verb] = (values: unknown) => {
        void values;
        state.writes.push(`${verb} ${table}`);
        return q;
      };
    });
    return q;
  };
  return {
    state,
    server: { from: (table: string) => chain(table, table === "inventory_items" ? { id: "wood-1", current_quantity: 18.5 } : null) },
  };
});

vi.mock("@/lib/dal/unified-supabase", () => ({ supabaseServer: world.server }));
vi.mock("@/lib/admin-company", () => ({ resolveAdminCompanyId: async () => "company-1" }));

const run = async (scenarioKey: string) => {
  const { POST } = await import("@/app/api/admin/agents/simulate-scenario/route");
  const req = { json: async () => ({ scenarioKey }) } as never;
  const res = await POST(req);
  return { status: res.status, body: await res.json() };
};

beforeEachEnv();
function beforeEachEnv() {
  // The door refuses production writes unless a flag is set; run as a dev box so the
  // test proves it writes nothing even when the old guard would have let it.
  process.env.NODE_ENV = "development";
}

describe("the scenario door proposes without touching a ledger", () => {
  it("writes nothing for the VIP order scenario", async () => {
    const out = await run("vip_custom_order");
    expect(out.status).toBe(200);
    expect(world.state.writes).toEqual([]);
    expect(out.body.data.written).toBe(false);
  });

  it("writes nothing for the shortage or the security sweep", async () => {
    await run("stock_shortage_alert");
    await run("security_backup_sweep");
    expect(world.state.writes).toEqual([]);
  });

  it("says what it is: a proposal, not a completed action", async () => {
    const out = await run("vip_custom_order");
    const text = JSON.stringify(out.body.data.steps);
    expect(text).not.toMatch(/تم إنشاء أمر بيع|تم إدراج|تم حفظ|تم إنشاء نسخة/);
    expect(out.body.data.kind).toBe("proposal");
  });

  it("quotes a real number where one is readable", async () => {
    const out = await run("vip_custom_order");
    const text = JSON.stringify(out.body.data.steps);
    expect(text).toContain("18.5");
  });
});
