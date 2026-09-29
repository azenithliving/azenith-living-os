// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Two doors answer «who are my customers?»: the roll the ledger stands on, and the one
 * the customers screen reads. Measured on production they disagreed — the screen showed
 * four while the roll saw six, so a buyer with a real phone number never reached the
 * owner's eyes. These tests hold the one rule both doors must answer to.
 */
const world = vi.hoisted(() => {
  const state = { tables: {} as Record<string, Record<string, unknown>[]> };

  const query = (rows: Record<string, unknown>[]): any => ({
    order: () => query(rows),
    limit: () => query(rows),
    in: (column: string, values: unknown[]) => query(rows.filter((r) => values.includes(r[column]))),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve, reject),
  });

  const client = () => ({
    from(table: string) {
      return { select: () => query(state.tables[table] ?? []) };
    },
  });
  return { state, client };
});

vi.mock("@/lib/admin-api-guard", () => ({
  requireAdminApi: async () => ({ user: { id: "admin-1" }, unauthorized: null }),
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => world.client() as never }));

const ali = {
  id: "u1",
  session_id: "s1",
  full_name: "علي سيد",
  phone: "01005554444",
  tier: "silver",
  updated_at: "2026-09-20T10:00:00.000Z",
};
// A buyer who only ever filled the profile: no conversation, no quote request. The old
// reading path could not see him at all, which is the defect this file exists to keep dead.
const rana = {
  id: "u2",
  session_id: null,
  full_name: "رنا فؤاد",
  phone: "01001112233",
  updated_at: "2026-09-26T08:00:00.000Z",
};

beforeEach(() => {
  world.state.tables = {
    users: [ali, rana],
    consultant_sessions: [
      {
        id: "c1",
        session_id: "s1",
        created_at: "2026-09-25T17:00:00.000Z",
        updated_at: "2026-09-25T17:00:00.000Z",
        messages: [{ role: "user", content: "مساء الخير، أنا علي" }],
        insights: { roomType: "ريسبشن", budget: "٨٠ الف", summary: "عاث ريسبشن" },
        ui_state: {},
      },
    ],
    requests: [],
    leads: [],
    sales_orders: [],
    bookings: [],
    lead_conversions: [],
    visitor_telemetry: [],
  };
});

const leadsOf = async () => {
  const { GET } = await import("@/app/api/admin/leads/route");
  return (await (await GET(new Request("http://x/api/admin/leads") as never)).json()).leads;
};

describe("the customers screen and the roll answer with one voice", () => {
  it("shows as many customers as the roll counts", async () => {
    const { GET: rollGet } = await import("@/app/api/admin/customers/route");
    const rollBody = await (await rollGet()).json();
    const leads = await leadsOf();
    expect(rollBody.totals.customers).toBe(2);
    expect(leads.length).toBe(rollBody.totals.customers);
  });

  it("carries the customer who has no conversation instead of hiding him", async () => {
    const leads = await leadsOf();
    const quiet = leads.find((l: { phone: string }) => l.phone.includes("01001112233"));
    expect(quiet).toBeTruthy();
    expect(quiet.name).toBe("رنا فؤاد");
    // No conversation means no chat to open, and the screen must be able to tell them apart.
    expect(quiet.session_id ?? null).toBe(null);
  });

  it("keeps the conversation tools for the customer who has one", async () => {
    const leads = await leadsOf();
    const talked = leads.find((l: { session_id?: string }) => l.session_id === "s1");
    expect(talked).toBeTruthy();
    expect(talked.messages.length).toBe(1);
    expect(talked.roomType).toBe("ريسبشن");
  });

  it("dials the number the way the owner reads it, not the way the key stores it", async () => {
    const leads = await leadsOf();
    expect(leads.map((l: { phone: string }) => l.phone).every((p: string) => /^01\d{9}$/.test(p))).toBe(true);
  });
});
