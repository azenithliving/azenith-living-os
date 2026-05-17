import { describe, it, expect } from "vitest";
import {
  needsMultiAgentMission,
} from "@/lib/admin-natural-brain";

describe("admin-natural-brain", () => {
  it("detects multi-agent missions from natural Arabic", () => {
    expect(
      needsMultiAgentMission("حلل الموقع كامل وشوف المشاكل وصلحها")
    ).toBe(true);
    expect(needsMultiAgentMission("ازيك")).toBe(false);
  });

  it("does not require /وكلاء prefix", () => {
    expect(needsMultiAgentMission("/وكلاء فحص أمن")).toBe(true);
    expect(
      needsMultiAgentMission("راجع أمان الموقع وشغّل الاختبارات")
    ).toBe(true);
  });
});
