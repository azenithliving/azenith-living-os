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

describe("the plan line promises nothing the message then refuses", () => {
  it("says what changes in the store for a conversation — nothing", () => {
    const plan = buildExecutionPlan("إيه اللي لسه ما اتعملش؟", { kind: "conversation", confidence: 1 });
    // Measured on the published cockpit: this line promised an AI answer and the very next
    // sentence said it could not tell him anything. A promise he has to decode is worse than none.
    expect(plan).not.toContain("بالذكاء الاصطناعي");
    expect(plan).toContain("من غير ما أغيّر حاجة");
  });

  it("carries no arrow into an Arabic line", () => {
    for (const kind of ["command", "agents", "architect", "analytics", "health", "conversation"]) {
      expect(buildExecutionPlan("اختبار", { kind, confidence: 1 })).not.toMatch(/[→←]/);
    }
  });
});
