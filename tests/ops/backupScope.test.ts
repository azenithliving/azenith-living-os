// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  SNAPSHOT_EXCLUSIONS,
  SNAPSHOT_TARGETS,
  coverageVerdict,
  formatCoverageLine,
} from "@/lib/ops/snapshot-scope";

/**
 * The nightly copy existed for eleven tables while the owner's business record — his orders, his
 * leads, his customers' drawn papers — sat outside it. Measured 2026-11-05: 160 rows of business
 * tables were not copied. The rule that keeps that from happening again is that every table in the
 * record must be either copied or named with a reason; a quiet absence is the defect, not an empty set.
 */
describe("the backup scope", () => {
  it("copies the business record, not only the swarm's memory", () => {
    const copied = SNAPSHOT_TARGETS.map((t) => t.table);
    for (const table of [
      "sales_orders",
      "sales_order_items",
      "leads",
      "room_sketches",
      "room_sections",
      "ops_drafts",
      "production_jobs",
      "inventory_items",
      "products",
    ]) {
      expect(copied, `${table} is still outside the copy`).toContain(table);
    }
  });

  it("keeps a composite-key table out with a reason instead of a broken ordering key", () => {
    // Measured on the live record: sheet_visits' primary key is (sketch_id, device_key).
    const copied = SNAPSHOT_TARGETS.map((t) => t.table);
    expect(copied).not.toContain("sheet_visits");
    const reason = SNAPSHOT_EXCLUSIONS.find((e) => e.table === "sheet_visits")?.reason ?? "";
    expect(reason).toContain("مركّب");
  });

  it("keys every copy with a stable order column, so paging cannot skip a row", () => {
    const seen = new Set<string>();
    for (const target of SNAPSHOT_TARGETS) {
      expect(target.order, `${target.table} has no ordering key`).toBeTruthy();
      expect(seen.has(target.table), `${target.table} is listed twice`).toBe(false);
      seen.add(target.table);
    }
  });

  it("names a reason for everything it leaves out", () => {
    expect(SNAPSHOT_EXCLUSIONS.length).toBeGreaterThan(0);
    for (const item of SNAPSHOT_EXCLUSIONS) {
      expect(item.reason.trim().length, `${item.table} is excluded without a reason`).toBeGreaterThan(10);
      expect(SNAPSHOT_TARGETS.map((t) => t.table), `${item.table} is both copied and excluded`).not.toContain(item.table);
    }
    const excluded = SNAPSHOT_EXCLUSIONS.map((e) => e.table);
    expect(excluded).toContain("image_bank");
  });

  it("flags a table that is neither copied nor excluded", () => {
    const verdict = coverageVerdict([
      { table: "sales_orders", rows: 5 },
      { table: "mystery_table", rows: 7 },
      { table: "agent_messages", rows: 1435 },
    ]);
    expect(verdict.copied.map((c) => c.table)).toContain("sales_orders");
    expect(verdict.unexplained).toEqual(["mystery_table"]);
    expect(verdict.excludedNames).not.toContain("mystery_table");
  });

  it("does not count an empty table as a loss", () => {
    const verdict = coverageVerdict([{ table: "a_table_nobody_filled", rows: 0 }]);
    expect(verdict.unexplained).toEqual([]);
    expect(verdict.emptyUncovered).toContain("a_table_nobody_filled");
  });

  it("keeps a credential-carrying table out on measured evidence, not on its name", () => {
    // The copy's own brake says no credential travels into it — proven by the table's columns.
    const verdict = coverageVerdict([{ table: "mystery_tokens", rows: 4, columns: ["id", "refresh_token"] }]);
    expect(verdict.unexplained).toEqual([]);
    expect(verdict.credentialTables).toEqual(["mystery_tokens"]);
  });

  it("prints the coverage in his digits and refuses a placating zero", () => {
    const line = formatCoverageLine(coverageVerdict([{ table: "mystery", rows: 3 }]));
    expect(line).toContain("جدول");
    expect(/[0-9]/.test(line)).toBe(false);
    expect(line).toContain("مفيش سبب مكتوب");
  });

  it("says what is not measured when the record did not answer", () => {
    const line = formatCoverageLine(null);
    expect(line).toContain("ما اتقارش");
    expect(line).not.toMatch(/٠ جدول/);
  });
});
