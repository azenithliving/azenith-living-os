// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

/**
 * The registry must not overrule a measured flag with an assumed one.
 *
 * Measured on the published site: the settings desk applied the change, wrote its history row and
 * answered `canRollback: true`, and the tool door still said false — because `executeTool` replaces
 * the handler's answer with `!!tool.rollbackHandler`, and this tool has no rollback handler
 * registered (the rollback lives in the door, by execution id). A gate that discards better evidence
 * than it has is not a gate; it is a louder guess.
 */
const writeSiteSetting = vi.fn(async () => ({
  ok: true,
  applied: true,
  canRollback: true,
  key: "theme",
  oldValue: null,
  newValue: { primary: "gold" },
  historyId: "audit-42",
  message: "الإعداد «theme» اتغير، والقراية من المخزن أكّدته.",
}));

vi.mock("@/lib/site-settings-desk", () => ({ writeSiteSetting }));
vi.mock("@/lib/supabase-server", () => ({ createClient: async () => ({}) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));
vi.mock("@vercel/blob", () => ({ put: vi.fn(async () => { throw new Error("blob must not be reached"); }) }));

const { executeTool } = await import("@/lib/agent-tools/tool-registry");

describe("the tool door's rollback flag", () => {
  it("keeps the creation refusal even when the tool successfully stored history", async () => {
    writeSiteSetting.mockResolvedValueOnce({
      ok: true, applied: true, canRollback: false, key: "theme", oldValue: null,
      newValue: { primary: "gold" }, historyId: "audit-create", message: "اتحفظ",
    });
    const out = await executeTool("setting_update", { key: "theme", value: { primary: "gold" }, autoApprove: true }, { executionId: "exec-create", actorUserId: "ops-lead" } as never);
    expect(out.success).toBe(true);
    expect(out.canRollback).toBe(false);
    expect(out.rollbackId).toBeUndefined();
  });

  it("keeps the flag the desk measured instead of recomputing it from a missing handler", async () => {
    const out = await executeTool(
      "setting_update",
      { key: "theme", value: { primary: "gold" }, autoApprove: true },
      { executionId: "exec-5", actorUserId: "ops-lead" } as never
    );

    expect(out.success).toBe(true);
    expect(out.canRollback).toBe(true);
    expect(out.rollbackId).toBe("audit-42");
  });

  it("still says no when the desk could not record the change", async () => {
    writeSiteSetting.mockResolvedValueOnce({
      ok: true,
      applied: true,
      canRollback: false,
      key: "theme",
      oldValue: null,
      newValue: { primary: "gold" },
      historyId: null,
      message: "الإعداد «theme» اتغير، والقراية من المخزن أكّدته.",
      note: "السجل ما استقبلش التغيير",
    });

    const out = await executeTool(
      "setting_update",
      { key: "theme", value: { primary: "gold" }, autoApprove: true },
      { executionId: "exec-6", actorUserId: "ops-lead" } as never
    );

    expect(out.success).toBe(true);
    expect(out.canRollback).toBe(false);
  });

  it("leaves the old rule standing for a tool that states no flag of its own", async () => {
    const out = await executeTool(
      "system_health_check",
      {},
      { executionId: "exec-7", actorUserId: "ops-lead" } as never
    );

    // Whatever that tool answers, the door must not invent a rollback for it.
    if (out.canRollback === undefined) expect(out.canRollback).toBeUndefined();
    else expect(out.canRollback === true).toBe(false);
  });
});
