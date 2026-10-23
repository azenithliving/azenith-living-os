// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * One writer for the store's ledger, and the owner's two controls recording what they did.
 *
 * Measured on the live record 2026-10-23: `agent_events` has 8 columns, and every writer that
 * passed `severity` / `message` / `metadata` was rejected with 42703 — so the emergency stop and
 * the approval decision left no trace. `emergency_stop_state` and `device_locks`, the two tables
 * the stop control aimed at, do not exist at all, and nothing in the store reads a stop flag, so
 * its only real effect is cancelling tasks — which it now counts from the rows the database gave
 * back, and records in the ledger both of his alert strips read.
 */

import { SYNC_EVENT_TYPES } from "@/lib/ops/syncTypes";
import { ALERT_EVENT_TYPES, alertLabel } from "@/lib/ops/alerts";

const COMPANY = "11111111-1111-4111-8111-111111111111";

function fakeClient(reply: { data: unknown; error: unknown }) {
  const calls: unknown[] = [];
  const self: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "then") return (resolve: (value: unknown) => void) => resolve(reply);
        if (prop === "insert") return (rows: unknown) => (calls.push(rows), self);
        return () => self;
      },
    },
  );
  return { client: self as any, calls };
}

async function loadLedger(client: any, companyId: string | null) {
  vi.resetModules();
  vi.doMock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => client }));
  vi.doMock("@/lib/admin-company", () => ({ resolveAdminCompanyId: async () => companyId }));
  return await import("@/lib/ops/ledger");
}

describe("the one ledger writer", () => {
  it("returns the id the ledger gave back", async () => {
    const { client, calls } = fakeClient({ data: [{ id: 4121 }], error: null });
    const ledger = await loadLedger(client, COMPANY);
    const wrote = await ledger.recordLedgerEvent({
      eventType: "emergency_stop",
      source: "owner",
      payload: { cancelled: 3 },
    });
    expect(wrote).toEqual({ ok: true, id: 4121 });
    expect(calls[0]).toMatchObject({
      company_id: COMPANY,
      event_type: "emergency_stop",
      source_agent: "owner",
      payload: { cancelled: 3 },
    });
  });

  it("refuses an event kind that is not in the store's vocabulary", async () => {
    const { client, calls } = fakeClient({ data: [{ id: 1 }], error: null });
    const ledger = await loadLedger(client, COMPANY);
    const wrote = await ledger.recordLedgerEvent({ eventType: "chat_interaction" as never, source: "owner" });
    expect(wrote.ok).toBe(false);
    expect(calls.length, "a refused event must never reach the ledger").toBe(0);
  });

  it("reports a ledger that refused the row instead of inventing an id", async () => {
    const refused = await loadLedger(fakeClient({ data: null, error: { code: "42501" } }).client, COMPANY);
    expect(await refused.recordLedgerEvent({ eventType: "approval_granted", source: "owner" })).toEqual({
      ok: false,
      error: "الدفتر رفض السطر",
    });

    const silent = await loadLedger(fakeClient({ data: [], error: null }).client, COMPANY);
    const wrote = await silent.recordLedgerEvent({ eventType: "approval_granted", source: "owner" });
    expect(wrote.ok).toBe(false);
    expect((wrote as { error: string }).error).toContain("ما اتسجّلش");
  });

  it("says so when the store's company is not configured", async () => {
    const { client } = fakeClient({ data: [{ id: 1 }], error: null });
    const ledger = await loadLedger(client, null);
    const wrote = await ledger.recordLedgerEvent({ eventType: "emergency_stop", source: "owner" });
    expect(wrote.ok).toBe(false);
  });

  it("owns the new event kinds in the one vocabulary", () => {
    for (const type of ["emergency_stop", "emergency_stop_released", "approval_granted", "approval_rejected"]) {
      expect(SYNC_EVENT_TYPES as readonly string[], type).toContain(type);
    }
  });

  it("counts a stop as trouble on his strips, in his Arabic", () => {
    expect(ALERT_EVENT_TYPES as readonly string[]).toContain("emergency_stop");
    expect(alertLabel("emergency_stop")).toBe("الإيقاف الطارئ اتفعّل — الموظفين واقفين");
    // A release is a receipt, not an alarm.
    expect(ALERT_EVENT_TYPES as readonly string[]).not.toContain("emergency_stop_released");
  });
});

/** Source guards: the shape of the repair, so the dead paths cannot come back. */
/** The file's code, with its comments stripped — a header may name the dead thing it retired. */
function codeOf(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("the owner's controls record what they did", () => {
  const stopDoor = "app/api/admin/owner/emergency-stop/route.ts";
  const decisionDoor = "app/api/admin/owner/approval/decision/route.ts";
  const syncLayer = "lib/ops/memory/SyncLayer.ts";
  const cockpitDoors = "components/admin/CockpitDoors.tsx";

  it("the stop door aims at no table that does not exist", () => {
    const door = codeOf(stopDoor);
    expect(door).not.toMatch(/emergency_stop_state|device_locks/);
    expect(door).toContain("recordLedgerEvent");
    // The count comes from the rows the database returned, not from a claim.
    expect(door).toMatch(/\.select\('id'\)/);
  });

  it("the decision door writes the columns the record answers to", () => {
    const door = codeOf(decisionDoor);
    expect(door).not.toMatch(/decided_by|decided_at|notes:/);
    expect(door).toMatch(/approved_by/);
    expect(door).toMatch(/approved_at/);
    expect(door).toContain("recordLedgerEvent");
  });

  it("neither door sends the database's English text to his screen", () => {
    for (const file of [stopDoor, decisionDoor]) {
      expect(codeOf(file)).not.toMatch(/error:\s*error\.message/);
    }
  });

  it("the sync layer no longer fabricates an event id", () => {
    const layer = readFileSync(syncLayer, "utf8");
    expect(layer).not.toMatch(/evt_\$\{Date\.now\(\)\}/);
    expect(layer).toContain("recordLedgerEvent");
  });

  it("the cockpit says how much was cancelled, and admits an unrecorded stop", () => {
    const doors = readFileSync(cockpitDoors, "utf8");
    expect(doors).toContain("data?.recorded");
    expect(doors).toMatch(/data\?\.data\?\.cancelled/);
    expect(doors).toContain("arNum(");
  });

  it("the arming timer clears its own warning, never the door's answer", () => {
    const doors = codeOf(cockpitDoors);
    // Measured 2026-10-23: one shared line held both the three-second warning and the reply, and
    // the warning's timer wiped it — so on a cold server the confirmation vanished before it came.
    expect(doors).toContain("const [hint, setHint]");
    expect(doors).toMatch(/setTimeout\(\(\) => \{[^}]*setHint\(""\)/);
    expect(doors).not.toMatch(/setTimeout\(\(\) => \{[^}]*setNews\(""\)/);
  });

  it("the orchestrator's dead telemetry writer is gone, and the chat keeps its own store", () => {
    expect(readFileSync("lib/agents/AgentOrchestrator.ts", "utf8")).not.toMatch(/logEvent|agent_events/);
    expect(readFileSync("app/api/admin/agents/chat/route.ts", "utf8")).not.toMatch(/logEvent/);
    expect(readFileSync("lib/agents/AgentOrchestrator.ts", "utf8")).toContain("agent_messages");
  });

  it("leaves only the two named debts on the dead table, and no new ones", () => {
    const files: string[] = [];
    for (const dir of ["app", "lib", "services"]) {
      const walk = (p: string) => {
        if (!existsSync(p)) return;
        for (const entry of readdirSync(p)) {
          const full = join(p, entry);
          if (statSync(full).isDirectory()) walk(full);
          else if (/\.tsx?$/.test(full) && /from\(\s*["'`]agent_events/.test(readFileSync(full, "utf8"))) {
            files.push(full.replace(/\\/g, "/"));
          }
        }
      };
      walk(dir);
    }
    // Only the CRM service still builds a query against it, and that class has no caller at all
    // (task #137). The owner dashboard's dead-table read was retired in task #130.
    expect(files.sort()).toEqual(["services/crm/customer-communications.ts"]);
  });
});
