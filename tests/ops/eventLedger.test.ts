// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

/**
 * The swarm has one ledger. `ops_sync_events` is the table the browser stream and the
 * monitoring surfaces already read, so an event that lands anywhere else is an event
 * the owner never sees — which is what happened while the automation bus wrote to
 * `vanguard_api_usage`, a table this database does not have.
 *
 * The database is never touched here: the client is a hoisted recorder, and the
 * assertion is on the write the code actually attempts.
 */
const writes: { table: string; row: Record<string, unknown> }[] = [];
let failNextWrite = false;

const fakeClient = {
  from(table: string) {
    return {
      async insert(row: Record<string, unknown>) {
        writes.push({ table, row });
        if (failNextWrite) return { error: { message: 'simulated ledger outage' } };
        return { error: null };
      },
    };
  },
};

vi.mock("@/lib/vanguard/memory/supabase_persistence", () => ({
  createServiceRoleClient: () => fakeClient,
}));

vi.mock("@/lib/admin-company", () => ({
  resolveAdminCompanyId: async () => "11111111-1111-4111-8111-111111111111",
}));

const { eventBus } = await import("@/lib/vanguard/automation/event_bus");

describe("the automation bus writes into the swarm's one ledger", () => {
  it("lands a published event in ops_sync_events, shaped for that table", async () => {
    writes.length = 0;
    await eventBus.publish("tool:executed", { tool: "seo_analyze" }, { source: "unit-probe" });

    const mine = writes.filter((w) => w.table === "ops_sync_events").pop();
    expect(mine, "the bus wrote somewhere else").toBeTruthy();
    expect(mine!.table).toBe("ops_sync_events");

    const row = mine!.row as Record<string, any>;
    expect(row.event_type).toBe("tool:executed");
    expect(row.source_agent).toBe("unit-probe");
    expect(row.company_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(Array.isArray(row.target_agents)).toBe(true);
    expect(row.payload.data).toEqual({ tool: "seo_analyze" });
  });

  it("never aims at the table this database does not have", async () => {
    writes.length = 0;
    await eventBus.publish("system:error", { where: "unit" }, { source: "unit-probe" });
    expect(writes.map((w) => w.table)).not.toContain("vanguard_api_usage");
  });

  it("keeps automating when the ledger is down", async () => {
    writes.length = 0;
    failNextWrite = true;
    await expect(
      eventBus.publish("task:completed", { id: "t1" }, { source: "unit-probe" })
    ).resolves.toBeUndefined();
    failNextWrite = false;
  });
});
