import { describe, it, expect } from "vitest";
import {
  buildPlan,
  declaredRowsMatch,
  emptyPlan,
  hasResidue,
  planIsEmpty,
  planTotals,
  residueOf,
  splitKeys,
} from "@/lib/leads-delete-guard";

const SESSION_KEY = "p6m4b-1790357584469";
const RECORD_ID = "3f2a1b9c-7d6e-4f5a-8b9c-0d1e2f3a4b5c";

describe("leads delete guard", () => {
  it("keeps a session key out of the identifier space of a primary key", () => {
    const { uuids, sessions } = splitKeys([SESSION_KEY, RECORD_ID, "", "   "]);
    expect(sessions).toEqual([SESSION_KEY]);
    expect(uuids).toEqual([RECORD_ID]);
  });

  it("counts a record once when both lookups find it", () => {
    const plan = buildPlan({
      consultantSessions: [{ id: RECORD_ID }, { id: RECORD_ID }, { id: null }],
      users: [{ id: "u-1" }, { id: "u-1" }],
      requests: [{ id: "r-1" }],
      visitorTelemetry: [{ id: "t-1" }, { id: "t-2" }],
    });
    expect(plan.consultantSessions).toEqual([RECORD_ID]);
    expect(plan.users).toEqual(["u-1"]);
    expect(planTotals(plan)).toEqual({
      consultantSessions: 1,
      users: 1,
      requests: 1,
      visitorTelemetry: 2,
      total: 5,
    });
  });

  it("refuses a confirmation that declared no number", () => {
    const plan = buildPlan({
      consultantSessions: [{ id: RECORD_ID }],
      users: [],
      requests: [],
      visitorTelemetry: [],
    });
    const outcome = declaredRowsMatch(undefined, plan);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("missing-declaration");
  });

  it("refuses when the measured number moved after the owner was shown it", () => {
    const plan = buildPlan({
      consultantSessions: [{ id: RECORD_ID }],
      users: [{ id: "u-1" }, { id: "u-2" }],
      requests: [],
      visitorTelemetry: [],
    });
    const outcome = declaredRowsMatch(2, plan);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe("count-changed");
      expect(outcome.measured).toBe(3);
      expect(outcome.declared).toBe(2);
    }
    expect(declaredRowsMatch(3, plan).ok).toBe(true);
  });

  it("treats a plan that matched nothing as empty, so nothing gets reported as deleted", () => {
    expect(planIsEmpty(emptyPlan())).toBe(true);
    expect(declaredRowsMatch(0, emptyPlan())).toEqual({ ok: true, total: 0 });
  });

  it("names the rows that survived the sweep instead of claiming success", () => {
    const plan = buildPlan({
      consultantSessions: [{ id: "s-1" }, { id: "s-2" }],
      users: [{ id: "u-1" }],
      requests: [],
      visitorTelemetry: [],
    });
    const stillThere = buildPlan({
      consultantSessions: [{ id: "s-2" }],
      users: [],
      requests: [],
      visitorTelemetry: [],
    });
    const residue = residueOf(plan, stillThere);
    expect(residue.consultantSessions).toEqual(["s-2"]);
    expect(hasResidue(residue)).toBe(true);
    expect(hasResidue(residueOf(plan, emptyPlan()))).toBe(false);
  });
});
