// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { ConstitutionEngine } from "@/lib/ops/governance/ConstitutionEngine";
import { gateBlockingNote } from "@/lib/ops/governance/gate-note";

/**
 * A refusal the ledger can explain.
 *
 * Measured 2026-11-04 in the store's own ledger: 19 rows said the quality gate refused work and all
 * 19 carried an empty violation list, because the caller filtered result objects on an `enforcement`
 * field those objects do not have. The strip could only print «بوابة الجودة رفضت عملاً».
 */

const read = (f: string) => readFileSync(f, "utf8");

describe("the note the gate writes", () => {
  it("names how many reasons block, and which", () => {
    const note = gateBlockingNote([
      { ruleId: "a", ruleName: "تتبع النسخ", severity: "critical", message: "مفيش رقم نسخة" },
      { ruleId: "b", ruleName: "الموافقة الآدمية", severity: "high", message: "مفيش موافقة" },
    ]);

    expect(note).toContain("٢ سبب يمنع النشر");
    expect(note).toContain("تتبع النسخ");
    expect(note).toContain("مفيش رقم نسخة");
    expect(note).toMatch(/[\u0600-\u06FF]/);
  });

  it("a refusal with no named reason is said as a contradiction, not as a blank", () => {
    expect(gateBlockingNote([])).toContain("تناقض في الفحص");
    expect(gateBlockingNote(undefined as any)).toContain("تناقض في الفحص");
  });

  it("the note stays inside what his screen can print, and never empties", () => {
    const long = gateBlockingNote([
      { ruleId: "a", ruleName: "س".repeat(400), severity: "critical", message: "م".repeat(400) },
    ]);

    expect(long.length).toBeLessThanOrEqual(160);
    expect(long).toContain("سبب يمنع النشر");
  });

  it("a note that is only Latin letters is replaced by the count, never dropped", () => {
    const note = gateBlockingNote([
      { ruleId: "a", ruleName: "Rule A", severity: "critical", message: "no version id" },
    ] as any);

    expect(note).toContain("١");
  });
});

describe("the engine reports the reasons it decided from", () => {
  it("the refusal and the blocking list are the same fact", async () => {
    const engine = new ConstitutionEngine();
    const report = await engine.checkAll({
      actionType: "publish",
      content: "",
      proposedChanges: [],
      targetPage: "",
      targetSection: "",
      evidenceUrls: [],
      humanApproval: false,
    } as any);

    expect(Array.isArray(report.blockingViolations)).toBe(true);
    expect(report.overallPassed).toBe(report.blockingViolations.length === 0);
    expect(report.overallPassed).toBe(false);
    expect(report.blockingViolations.length).toBeGreaterThan(0);
    expect(report.blockingViolations.every((v) => typeof v.ruleName === "string" && v.ruleName.length > 0)).toBe(true);
  });

  it("the note built from that list is printable", async () => {
    const engine = new ConstitutionEngine();
    const report = await engine.checkAll({
      actionType: "publish",
      content: "",
      proposedChanges: [],
      targetPage: "",
      targetSection: "",
      evidenceUrls: [],
      humanApproval: false,
    } as any);

    const note = gateBlockingNote(report.blockingViolations);
    expect(note.length).toBeGreaterThan(10);
    expect(note).toMatch(/[\u0600-\u06FF]/);
  });
});

describe("the writer and the caller cannot drift apart", () => {
  it("the door passes the report's own blocking list", () => {
    const door = read("app/api/admin/ops/route.ts");
    expect(door).toContain("report.blockingViolations");
    expect(door).not.toMatch(/r\.enforcement === ['"]hard_block['"]/);
  });

  it("the door keeps the draft name the refusal is about", () => {
    // A zod object drops keys it does not declare, and the row is filed under the name it reads
    // from the body — so an undeclared draft_id made every refusal look like the same generic check.
    const door = read("app/api/admin/ops/route.ts");
    expect(door).toMatch(/draft_id: z\.string\(\)\.optional\(\)/);
    expect(door).toContain("(input as any).draft_id");
  });

  it("the ledger row carries the Arabic reason with it", () => {
    const layer = read("lib/ops/memory/SyncLayer.ts");
    expect(layer).toContain("gateBlockingNote(violations");
    expect(layer).toMatch(/summary: passed \? undefined/);
  });

  it("the decision is made from one array in the engine", () => {
    const engine = read("lib/ops/governance/ConstitutionEngine.ts");
    expect(engine).toContain("blockingViolations: hardBlockViolations");
  });
});
