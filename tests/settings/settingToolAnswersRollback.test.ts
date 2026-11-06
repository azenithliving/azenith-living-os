// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the owner's chat reads to decide whether the «تراجع» button does anything.
 *
 * Measured on the published site: the change landed and the history row was written, but the tool
 * still answered `canRollback: false` — because the door reads that flag at the TOP of the result
 * (`ToolExecutionResult.canRollback`), and the handler had put it inside `data`. A capability that
 * works and reports that it does not is the same failure as one that does not work: the owner
 * presses nothing, or presses it and is told there is nothing to undo.
 */
const deskCall = vi.hoisted(() => ({ out: null as any }));
const writeSiteSetting = vi.fn(async () => deskCall.out);

vi.mock("@/lib/site-settings-desk", () => ({ writeSiteSetting }));
vi.mock("@/lib/supabase-server", () => ({ createClient: async () => ({}) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));
vi.mock("@vercel/blob", () => ({ put: vi.fn(async () => { throw new Error("blob must not be reached"); }) }));

const handlers = await import("@/lib/agent-tools/tool-handlers");

const context = {
  executionId: "exec-77",
  actorUserId: "03105dde-325a-43ff-987d-50a0424505b9",
  companyId: null,
} as never;

beforeEach(() => {
  writeSiteSetting.mockClear();
  deskCall.out = {
    ok: true,
    applied: true,
    key: "theme",
    oldValue: { primary: "black" },
    newValue: { primary: "gold" },
    historyId: "audit-9",
    message: "الإعداد «theme» اتغير، والقراية من المخزن أكّدته.",
  };
});

describe("the settings tool's answer", () => {
  it("carries the rollback flag where the door reads it, not buried in data", async () => {
    const out = await handlers.executeSettingUpdate(
      { key: "theme", value: { primary: "gold" }, autoApprove: true },
      context
    );

    expect(out.success).toBe(true);
    expect(out.canRollback).toBe(true);
    expect(out.rollbackId).toBe("audit-9");
  });

  it("does not promise a rollback the history row never covered", async () => {
    deskCall.out = { ...deskCall.out, historyId: null, note: "السجل ما استقبلش التغيير" };

    const out = await handlers.executeSettingUpdate(
      { key: "theme", value: 1, autoApprove: true },
      context
    );

    expect(out.success).toBe(true);
    expect(out.canRollback).toBe(false);
    expect(out.rollbackId).toBeUndefined();
  });

  it("passes the execution id so the rollback can find this change later", async () => {
    await handlers.executeSettingUpdate({ key: "theme", value: 1, autoApprove: true }, context);

    expect(writeSiteSetting.mock.calls[0][0].executionId).toBe("exec-77");
    expect(writeSiteSetting.mock.calls[0][0].apply).toBe(true);
  });

  it("records a waiting change without applying it when approval is not waived", async () => {
    deskCall.out = { ...deskCall.out, applied: false };

    const out = await handlers.executeSettingUpdate({ key: "theme", value: 1 }, context);

    expect(writeSiteSetting.mock.calls[0][0].apply).toBe(false);
    expect(out.requiresApproval).toBe(true);
    expect(out.canRollback).toBe(false);
  });
});
