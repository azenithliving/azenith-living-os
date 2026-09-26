// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildApprovalRow, isUuid } from "@/lib/qayyim/approval-intake";

/**
 * `POST /api/admin/agents/approval-queue` writes into a table whose contract is
 * stricter than its callers assume: `action_id` is a NOT NULL uuid, `risk_level`
 * is NOT NULL with a CHECK list, and `description` must not be empty. Every one
 * of those has been the reason a caller got a raw Postgres error back.
 *
 * So the shape is decided here, in the open, with the database's rules written
 * down — the route just inserts what this returns.
 */
const NOW = () => new Date("2026-09-26T09:00:00.000Z");
const ok = (body: unknown, company: string | null = null) => {
  const out = buildApprovalRow(body, company, NOW);
  if (!out.ok) throw new Error(out.error);
  return out.row;
};

describe("isUuid", () => {
  it("recognises the shapes the schema accepts", () => {
    expect(isUuid("b975cea6-2fa3-42a8-86be-b117078fbcaf")).toBe(true);
    expect(isUuid("B975CEA6-2FA3-42A8-86BE-B117078FBCAF")).toBe(true);
    expect(isUuid("uitest-1777000000")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe("buildApprovalRow", () => {
  it("refuses what the owner would only call a blank card", () => {
    expect(buildApprovalRow({ action_type: "assistant_health" }, null, NOW)).toEqual({
      ok: false,
      error: "الوصف مطلوب عشان القرار يبقى مفهوم",
    });
    expect(buildApprovalRow({ description: "   ", action_type: "assistant_health" }, null, NOW).ok).toBe(false);
    expect(buildApprovalRow({ description: "شيء" }, null, NOW)).toEqual({
      ok: false,
      error: "نوع الإجراء مطلوب",
    });
  });

  it("keeps a real action_id and invents one when the caller sends prose", () => {
    const given = "b975cea6-2fa3-42a8-86be-b117078fbcaf";
    expect(ok({ action_id: given, action_type: "assistant_health", description: "افحص" }).action_id).toBe(given);
    const made = ok({ action_id: "uitest-1", action_type: "assistant_health", description: "افحص" }).action_id;
    expect(isUuid(made)).toBe(true);
    expect(made).not.toBe("uitest-1");
  });

  /** The CHECK list is not decoration: writing anything else aborts the insert. */
  it.each(["low", "HIGH", "", null, undefined, 7])("maps risk %s onto the allowed ladder", (risk) => {
    const row = ok({ action_type: "assistant_health", description: "افحص", risk_level: risk });
    expect(["info", "normal", "critical", "forbidden"]).toContain(row.risk_level);
  });

  it("keeps a real risk level", () => {
    expect(ok({ action_type: "assistant_health", description: "افحص", risk_level: "critical" }).risk_level).toBe(
      "critical",
    );
    expect(ok({ action_type: "assistant_health", description: "افحص", risk_level: "info" }).risk_level).toBe("info");
  });

  it("opens as pending with a real expiry window", () => {
    const row = ok({ action_type: "assistant_health", description: "افحص" });
    expect(row.status).toBe("pending");
    expect(row.requested_at).toBe("2026-09-26T09:00:00.000Z");
    expect(Date.parse(row.expires_at) - Date.parse(row.requested_at)).toBe(48 * 3_600_000);
  });

  it("carries metadata only when it is an object", () => {
    expect(ok({ action_type: "t", description: "د", metadata: { a: 1 } }).metadata).toEqual({ a: 1 });
    expect(ok({ action_type: "t", description: "د", metadata: "junk" }).metadata).toEqual({});
    expect(ok({ action_type: "t", description: "د" }).metadata).toEqual({});
  });

  it("stamps the company only when one was resolved", () => {
    expect(ok({ action_type: "t", description: "د" }, null).company_id).toBeNull();
    expect(ok({ action_type: "t", description: "د" }, "  ").company_id).toBeNull();
    expect(ok({ action_type: "t", description: "د" }, "dbb9b420-f2ec-4dd3-88d6-4d1a9a74364d").company_id).toBe(
      "dbb9b420-f2ec-4dd3-88d6-4d1a9a74364d",
    );
  });

  /** A 4000-character description is a document, not a decision card. */
  it("trims an over-long description instead of failing the row", () => {
    const row = ok({ action_type: "t", description: "أ".repeat(9000) });
    expect(row.description.length).toBeLessThanOrEqual(2000);
    expect(row.description).toContain("…");
  });

  it("refuses a body that is not an object at all", () => {
    for (const bad of [null, undefined, "x", 7, []]) {
      expect(buildApprovalRow(bad, null, NOW)).toEqual({ ok: false, error: "محتوى الطلب غير صالح" });
    }
  });
});
