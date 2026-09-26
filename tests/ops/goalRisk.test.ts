// @vitest-environment node
import { describe, it, expect } from "vitest";
import { assessGoals, renderGoalRisk, type GoalRow } from "@/lib/ops/goal-risk";

const goal = (over: Partial<GoalRow> = {}): GoalRow => ({
  id: "g1",
  name: "رفع مبيعات الصالونات",
  target_value: 100,
  current_value: 40,
  deadline: null,
  status: "active",
  ...over,
});

describe("assessGoals", () => {
  const now = new Date("2026-09-25T00:00:00Z");

  it("flags a goal whose deadline passed", () => {
    const r = assessGoals([goal({ deadline: "2026-09-01T00:00:00Z", current_value: 90 })], now);
    expect(r).toHaveLength(1);
    expect(r[0].reasons).toContain("تجاوز موعده");
    expect(r[0].progressPct).toBe(90);
  });

  it("flags a goal below a quarter of its target", () => {
    const r = assessGoals([goal({ current_value: 24 })], now);
    expect(r[0].reasons.join(" ")).toMatch(/أقل من ربع/);
  });

  it("does not invent a percentage when no target is recorded", () => {
    const r = assessGoals([goal({ target_value: null, current_value: 12 })], now);
    expect(r[0].progressPct).toBeNull();
    expect(r[0].reasons).toContain("بدون مستهدف مسجّل — لا يمكن قياس تقدمه");
  });

  it("leaves healthy goals alone", () => {
    expect(assessGoals([goal({ current_value: 80, deadline: "2026-12-31T00:00:00Z" })], now)).toEqual([]);
  });

  it("accepts numeric strings and clamps absurd progress", () => {
    const r = assessGoals([goal({ target_value: "10" as unknown as number, current_value: "37" as unknown as number })], now);
    expect(r).toEqual([]); // 370% clamps to 100 and is on track
  });
});

describe("renderGoalRisk", () => {
  it("reports a query failure instead of an empty all-clear", () => {
    const m = renderGoalRisk(null, 'column qayyim_goals.title does not exist', []);
    expect(m).toContain("لم أستطع قراءة الأهداف");
    expect(m).toContain("column qayyim_goals.title");
    expect(m).not.toContain("لا أهداف مهددة");
  });

  it("names the at-risk goals with their real numbers", () => {
    const rows = [goal({ name: "غرف النوم", current_value: 10, deadline: "2026-09-01T00:00:00Z" })];
    const m = renderGoalRisk(rows, null, assessGoals(rows, new Date("2026-09-25T00:00:00Z")));
    expect(m).toContain("غرف النوم");
    expect(m).toContain("10%");
  });

  it("says zero active goals when there genuinely are none", () => {
    expect(renderGoalRisk([], null, [])).toContain("لا يوجد هدف نشط");
  });
});
