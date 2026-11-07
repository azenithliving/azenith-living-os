// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The settings desk speaks the record's real shape.
 *
 * Measured on the live store 2026-11-06, in this order:
 *  - `site_settings` has exactly four columns — key, value, updated_at, updated_by. There is no `id`,
 *    no `setting_value`, no `current_revision_id`;
 *  - `content_revisions` does not exist at all (PGRST205), so the employee tool that «changes a
 *    setting with revisions and rollback» failed on its very first write, every time, and the
 *    rollback button in the owner's chat had nothing to read;
 *  - `audit_log` DOES exist and already has one writer (`lib/ops/audit-record.ts`), so history gets
 *    recorded there rather than in a second drawer invented for the purpose.
 *
 * These tests hold the contract: one key-based write, one history owner, a read-back before any
 * «اتغير», and a refusal named instead of a value invented.
 */
const world = vi.hoisted(() => ({
  upserts: [] as { payload: Record<string, unknown>; onConflict?: string }[],
  upsertResult: { data: { key: "theme", value: { primary: "gold" } }, error: null } as any,
  reads: [] as { table: string; filters: [string, unknown][] }[],
  existingRow: { value: { primary: "black" }, updated_at: "2026-01-01T00:00:00.000Z" } as any,
  readError: null as any,
  historyCalls: [] as any[],
  historyResult: { ok: true, id: "audit-1" } as any,
  historyRows: [] as any[],
  touched: [] as string[],
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => {
      world.touched.push(table);
      if (table === "site_settings") {
        return {
          select: (cols: string) => ({
            eq: (column: string, value: unknown) => {
              world.reads.push({ table, filters: [[column, value]] });
              return {
                maybeSingle: async () => ({ data: world.existingRow, error: world.readError }),
              };
            },
          }),
          upsert: (payload: Record<string, unknown>, options?: { onConflict?: string }) => {
            world.upserts.push({ payload, onConflict: options?.onConflict });
            return {
              select: () => ({ single: async () => world.upsertResult }),
            };
          },
        };
      }
      if (table === "audit_log") {
        return {
          select: () => ({
            eq: (column: string, value: unknown) => {
              world.reads.push({ table, filters: [[column, value]] });
              return {
                eq: (column2: string, value2: unknown) => {
                  world.reads.push({ table, filters: [[column2, value2]] });
                  return {
                    order: () => ({
                      limit: async () => ({ data: world.historyRows, error: null }),
                    }),
                  };
                },
              };
            },
          }),
        };
      }
      throw new Error(`the desk touched a table it has no contract for: ${table}`);
    },
  }),
}));

vi.mock("@/lib/ops/audit-record", () => ({
  recordAuditEvent: async (event: any) => {
    world.historyCalls.push(event);
    return world.historyResult;
  },
}));

const desk = await import("@/lib/site-settings-desk");

beforeEach(() => {
  world.upserts.length = 0;
  world.reads.length = 0;
  world.touched.length = 0;
  world.historyCalls.length = 0;
  world.existingRow = { value: { primary: "black" }, updated_at: "2026-01-01T00:00:00.000Z" };
  world.readError = null;
  world.upsertResult = { data: { key: "theme", value: { primary: "gold" } }, error: null };
  world.historyResult = { ok: true, id: "audit-1" };
  world.historyRows = [];
});

describe("writing a setting", () => {
  it("offers rollback only for a recorded update with an execution id", async () => {
    const out = await desk.writeSiteSetting({ key: "theme", value: { primary: "gold" }, actor: "ops-lead", executionId: "exec-1" });
    expect(out.canRollback).toBe(true);
  });

  it("does not offer deletion as rollback for a newly created setting", async () => {
    world.existingRow = null;
    const out = await desk.writeSiteSetting({ key: "theme", value: { primary: "gold" }, actor: "ops-lead", executionId: "exec-1" });
    expect(out.applied).toBe(true);
    expect(out.historyId).toBe("audit-1");
    expect(out.canRollback).toBe(false);
  });

  it("does not offer rollback without an execution id the rollback door can use", async () => {
    const out = await desk.writeSiteSetting({ key: "theme", value: { primary: "gold" }, actor: "ops-lead" });
    expect(out.applied).toBe(true);
    expect(out.canRollback).toBe(false);
  });

  it("does not offer rollback when recording the update failed", async () => {
    world.historyResult = { ok: false, error: "سجل الأحداث رفض السطر" };
    const out = await desk.writeSiteSetting({ key: "theme", value: { primary: "gold" }, actor: "ops-lead", executionId: "exec-1" });
    expect(out.applied).toBe(true);
    expect(out.canRollback).toBe(false);
  });

  it("reports a waiting request as failed when its only write was refused", async () => {
    world.historyResult = { ok: false, error: "سجل الأحداث رفض السطر" };
    const out = await desk.writeSiteSetting({ key: "theme", value: { primary: "gold" }, actor: "ops-lead", apply: false });
    expect(out.ok).toBe(false);
    expect(out.applied).toBe(false);
    expect(out.historyId).toBeNull();
    expect(out.message).toContain("ما اتسجّلش");
    expect(world.upserts).toEqual([]);
  });

  it("sends only the three columns the record accepts", async () => {
    await desk.writeSiteSetting({
      key: "theme",
      value: { primary: "gold" },
      actor: "ops-lead",
      reason: "تغيير اللون",
      executionId: "exec-1",
    });

    expect(world.upserts).toHaveLength(1);
    const payload = world.upserts[0].payload;
    // Measured on the live store: `updated_by` is a uuid carrying a foreign key to `users(id)`, so
    // writing an actor name there is refused (22P02) — and filling it would mean inventing a
    // customer row. The actor belongs to the history drawer, which has an `actor` column for it.
    expect(new Set(Object.keys(payload))).toEqual(new Set(["key", "value", "updated_at"]));
    for (const invented of ["id", "setting_value", "current_revision_id", "setting_key", "company_id", "updated_by"]) {
      expect(payload, invented).not.toHaveProperty(invented);
    }
  });

  it("records who changed it in the history row, where the actor column accepts a name", async () => {
    await desk.writeSiteSetting({ key: "theme", value: 1, actor: "ops-lead", executionId: "exec-2" });

    expect(world.upserts[0].payload).not.toHaveProperty("updated_by");
    expect(world.historyCalls[0].actor).toBe("ops-lead");
  });

  it("keys the row by its own key, never by a column the record does not have", async () => {
    await desk.writeSiteSetting({ key: "theme", value: 1, actor: "ops-lead" });

    expect(world.upserts[0].onConflict).toBe("key");
    const read = world.reads.find((r) => r.table === "site_settings");
    expect(read?.filters).toEqual([["key", "theme"]]);
  });

  it("reads the row back from the record before it says the setting changed", async () => {
    const out = await desk.writeSiteSetting({ key: "theme", value: { primary: "gold" }, actor: "ops-lead" });

    expect(out.applied).toBe(true);
    expect(out.ok).toBe(true);
    expect(out.newValue).toEqual({ primary: "gold" });
    expect(out.oldValue).toEqual({ primary: "black" });
    expect(String(out.message)).toContain("شكل الموقع");
    expect(String(out.message)).not.toContain("theme");
  });

  it("never claims a change the record refused", async () => {
    world.upsertResult = { data: null, error: { code: "42501", message: "permission denied" } };

    const out = await desk.writeSiteSetting({ key: "theme", value: 1, actor: "ops-lead" });

    expect(out.ok).toBe(false);
    expect(out.applied).toBe(false);
    expect(String(out.message)).toContain("ما اتغيرش");
  });

  it("says so when the write answered but the read-back came back empty", async () => {
    world.upsertResult = { data: null, error: null };

    const out = await desk.writeSiteSetting({ key: "theme", value: 1, actor: "ops-lead" });

    expect(out.ok).toBe(false);
    expect(String(out.message)).toContain("ما اتأكدش");
  });

  it("refuses a blank key without asking the record for anything", async () => {
    const out = await desk.writeSiteSetting({ key: "   ", value: 1, actor: "ops-lead" });

    expect(out.ok).toBe(false);
    expect(world.touched).toEqual([]);
    expect(world.historyCalls).toEqual([]);
  });

  it("keeps a change it really applied when the history drawer refuses its row", async () => {
    world.historyResult = { ok: false, error: "سجل الأحداث رفض السطر" };

    const out = await desk.writeSiteSetting({
      key: "theme",
      value: 1,
      actor: "ops-lead",
      reason: "سبب",
      executionId: "exec-9",
    });

    expect(out.applied).toBe(true);
    expect(out.historyId).toBeNull();
    expect(String(out.note ?? "")).toContain("السجل");
  });
});

describe("recording the change where the record already keeps history", () => {
  it("writes one audit row carrying the old value, the new value and the execution", async () => {
    await desk.writeSiteSetting({
      key: "theme",
      value: { primary: "gold" },
      actor: "ops-lead",
      reason: "تغيير اللون",
      category: "general",
      executionId: "exec-1",
    });

    expect(world.historyCalls).toHaveLength(1);
    const event = world.historyCalls[0];
    expect(event.kind).toBe("setting_change");
    expect(event.actor).toBe("ops-lead");
    expect(event.details.table).toBe("site_settings");
    expect(event.details.settingKey).toBe("theme");
    expect(event.details.oldValue).toEqual({ primary: "black" });
    expect(event.details.newValue).toEqual({ primary: "gold" });
    expect(event.details.reason).toBe("تغيير اللون");
    expect(event.details.executionId).toBe("exec-1");
    expect(event.outcome).toBe("success");
  });

  it("records whether the key existed before, so a rollback never has to guess", async () => {
    await desk.writeSiteSetting({ key: "theme", value: 1, actor: "ops-lead", executionId: "exec-a" });
    expect(world.historyCalls[0].details.existedBefore).toBe(true);

    world.existingRow = null;
    world.historyCalls.length = 0;
    await desk.writeSiteSetting({ key: "brand_new", value: 1, actor: "ops-lead", executionId: "exec-b" });
    expect(world.historyCalls[0].details.existedBefore).toBe(false);
  });

  it("records a waiting change without touching the live value", async () => {
    const out = await desk.writeSiteSetting({
      key: "theme",
      value: { primary: "gold" },
      actor: "ops-lead",
      apply: false,
    });

    expect(out.applied).toBe(false);
    expect(world.upserts).toEqual([]);
    expect(world.historyCalls).toHaveLength(1);
    expect(world.historyCalls[0].details.status).toBe("waiting");
    // A waiting change is rolled back the same way, so its row carries the same flag — measured by
    // sabotage: without this assertion the desk could drop the flag from the waiting row and every
    // test would stay green while a later rollback guessed about a key that never existed.
    expect(world.historyCalls[0].details.existedBefore).toBe(true);
  });
});

describe("rolling a change back", () => {
  it("puts the recorded old value back through the same one key-based write", async () => {
    world.historyRows = [
      { details: { table: "site_settings", settingKey: "theme", oldValue: { primary: "black" }, existedBefore: true, status: "applied" } },
    ];

    const out = await desk.rollbackSettingsForExecution("exec-1", "ops-lead");

    expect(out.ok).toBe(true);
    expect(out.keys).toEqual(["theme"]);
    expect(world.upserts[0].payload.value).toEqual({ primary: "black" });
    expect(world.upserts[0].payload.key).toBe("theme");
    expect(world.upserts[0].onConflict).toBe("key");
  });

  it("refuses to roll back a setting that did not exist before, because that is a delete", async () => {
    world.historyRows = [
      { details: { table: "site_settings", settingKey: "qa_new_key", oldValue: null, existedBefore: false, status: "applied" } },
    ];

    const out = await desk.rollbackSettingsForExecution("exec-1", "ops-lead");

    expect(out.ok).toBe(false);
    expect(out.appliedCount).toBe(0);
    expect(out.newKeys).toEqual(["qa_new_key"]);
    expect(String(out.message)).toContain("قرار المالك");
    expect(world.upserts).toEqual([]);
  });

  it("rolls back the ones it can and names the one that needs his word", async () => {
    world.historyRows = [
      { details: { table: "site_settings", settingKey: "qa_new_key", oldValue: null, existedBefore: false, status: "applied" } },
      { details: { table: "site_settings", settingKey: "theme", oldValue: 3, existedBefore: true, status: "applied" } },
    ];

    const out = await desk.rollbackSettingsForExecution("exec-1", "ops-lead");

    expect(out.appliedCount).toBe(1);
    expect(out.keys).toEqual(["theme"]);
    expect(out.newKeys).toEqual(["qa_new_key"]);
    expect(String(out.note ?? "")).toContain("إعداد غير مسمّى");
    expect(String(out.note ?? "")).not.toContain("qa_new_key");
  });

  it("says nothing was recorded instead of pretending a rollback happened", async () => {
    world.historyRows = [];

    const out = await desk.rollbackSettingsForExecution("exec-404", "ops-lead");

    expect(out.ok).toBe(false);
    expect(out.appliedCount).toBe(0);
    expect(String(out.message)).toContain("مفيش تغيير مسجّل");
    expect(world.upserts).toEqual([]);
  });

  it("reads the history from the drawer that exists, and never from the invented one", async () => {
    world.historyRows = [{ details: { table: "site_settings", settingKey: "theme", oldValue: 2, status: "applied" } }];

    await desk.rollbackSettingsForExecution("exec-1", "ops-lead");

    expect(world.touched).toContain("audit_log");
    expect(world.touched).not.toContain("content_revisions");
    expect(world.touched).not.toContain("site_settings_revisions");
  });
});
