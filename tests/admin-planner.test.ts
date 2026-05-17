import { describe, expect, it } from "vitest";
import { buildExecutionPlan } from "@/lib/admin-planner";

describe("admin-planner", () => {
  it("builds plan for command intent", () => {
    const plan = buildExecutionPlan("ورّيني المفاتيح", {
      kind: "command",
      confidence: 1,
    });
    expect(plan).toContain("الخطة");
    expect(plan).toContain("أمر الإدارة");
  });

  it("builds plan for genesis", () => {
    const plan = buildExecutionPlan("كوّن قسماً", {
      kind: "genesis",
      confidence: 1,
    });
    expect(plan).toContain("Genesis");
  });
});
