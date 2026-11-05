// @vitest-environment node
import { describe, it, expect } from "vitest";

import { planRestore, rowsToInsert } from "@/lib/ops/restore-plan";

/**
 * The restore door is the one surface in this store that can write over the owner's record, so the
 * plan it produces is the safety: it refuses a table that was never copied, a copy whose read-back
 * disagreed, a day with no object, and any row that is not the instrument's own marker — unless the
 * owner's word is carried in explicitly.
 */
const stamp = { day: "2026-11-05", tables: 20, rows: 260, bytes: 900, failures: [] as string[] };

describe("the restore plan", () => {
  it("refuses a table the copy never held", () => {
    const plan = planRestore({ day: "2026-11-05", table: "image_bank", stamp, marker: "DRILL-9" });
    expect(plan.ok).toBe(false);
    expect(plan.reason).toContain("ما اتنسختش");
  });

  it("refuses when the copy reported a mismatch", () => {
    const dirty = { ...stamp, failures: ["رجوع leads: الملف فيه 2 سطر والسجل فيه 5"] };
    const plan = planRestore({ day: "2026-11-05", table: "leads", stamp: dirty, marker: "DRILL-9" });
    expect(plan.ok).toBe(false);
    expect(plan.reason).toContain("ما اتأكدتش");
  });

  it("refuses a day the stamp does not carry", () => {
    const plan = planRestore({ day: "2026-11-01", table: "leads", stamp, marker: "DRILL-9" });
    expect(plan.ok).toBe(false);
    expect(plan.reason).toContain("2026-11-01");
  });

  it("refuses when there is no stamp at all instead of guessing today", () => {
    const plan = planRestore({ day: "2026-11-05", table: "leads", stamp: null, marker: "DRILL-9" });
    expect(plan.ok).toBe(false);
    expect(plan.reason).toContain("ما اتقارش");
  });

  it("restores only the marker rows unless the owner's word is carried in", () => {
    const plan = planRestore({ day: "2026-11-05", table: "leads", stamp, marker: "DRILL-9" });
    expect(plan.ok).toBe(true);
    expect(plan.scope).toBe("marker");
    expect(plan.marker).toBe("DRILL-9");

    const whole = planRestore({ day: "2026-11-05", table: "leads", stamp, ownerWord: "كلمة المالك ٢٠٢٦-١١-٠٥" });
    expect(whole.ok).toBe(true);
    expect(whole.scope).toBe("whole-table");
  });

  it("refuses a whole-table restore with no word, whatever the caller claims", () => {
    const plan = planRestore({ day: "2026-11-05", table: "leads", stamp, ownerWord: "   " });
    expect(plan.ok).toBe(false);
    expect(plan.reason).toContain("كلمة المالك");
  });

  it("inserts only the rows that are actually missing", () => {
    const rows = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const existing = [{ id: "2" }];
    const toInsert = rowsToInsert(rows, existing, "id");
    expect(toInsert.map((r) => r.id).sort()).toEqual(["1", "3"]);
  });

  it("never overwrites a row that is already there", () => {
    const toInsert = rowsToInsert([{ id: "2", phone: "old" }], [{ id: "2", phone: "live" }], "id");
    expect(toInsert).toEqual([]);
  });

  it("refuses to compare rows when the copy has no key column", () => {
    expect(() => rowsToInsert([{ phone: "x" }], [], "id")).toThrow(/ما فيهوش/);
  });
});
