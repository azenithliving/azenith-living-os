import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEPARTMENTS,
  DEPARTMENT_KEYS,
  SALES_KEY,
  employeeHref,
  employeeTitle,
  isStaffedEmployee,
} from "@/lib/ops/departments";
import { AGENT_KEYS } from "@/lib/ops/identity";

/**
 * The command canvas now shows a card per employee. Two failures are silent and
 * expensive: a department whose card opens onto nobody (a phantom door — the owner
 * taps and finds the leader's chat), and a live employee who is missing from the
 * map (an employee with no door at all, reachable only by typing an address).
 */
describe("the department map only opens doors that lead to a real employee", () => {
  it("staffs every card with a key that exists", () => {
    const ghosts = DEPARTMENTS.flatMap((d) => d.members).filter((k) => !isStaffedEmployee(k));
    expect(ghosts, ghosts.join(", ")).toEqual([]);
  });

  it("gives every swarm member exactly one door", () => {
    const counted = new Map<string, number>();
    for (const key of DEPARTMENT_KEYS) counted.set(key, (counted.get(key) ?? 0) + 1);
    expect(DEPARTMENT_KEYS.length).toBe(counted.size);

    const homeless = AGENT_KEYS.filter((k) => !DEPARTMENT_KEYS.includes(k));
    expect(homeless, `no card for: ${homeless.join(", ")}`).toEqual([]);
  });

  it("puts every live key under one department only", () => {
    const seen = new Set<string>();
    for (const dept of DEPARTMENTS) {
      for (const key of dept.members) {
        expect(seen.has(key), `${key} listed twice`).toBe(false);
        seen.add(key);
      }
    }
  });

  it("writes a line instead of a card when a department has nobody", () => {
    for (const dept of DEPARTMENTS) {
      if (dept.members.length === 0) {
        expect(dept.vacancy, dept.id).toBeTruthy();
      } else {
        expect(dept.vacancy, dept.id).toBeNull();
      }
    }
  });

  it("sends the sales manager to his own house, not to a swarm chat that would reject him", () => {
    expect(employeeHref(SALES_KEY)).toBe("/admin/v2/sales");
    expect(employeeHref("ops-qa")).toBe("/admin/v2/agents/ops?agent=ops-qa");
  });

  it("names every card with an Arabic role, never the raw key", () => {
    for (const key of DEPARTMENT_KEYS) {
      const label = employeeTitle(key);
      expect(label, key).not.toBe(key);
      expect(label, key).not.toMatch(/^[a-z_-]+$/i);
    }
  });

  it("keeps the retired product name out of the map", () => {
    const source = readFileSync("lib/ops/departments.ts", "utf8");
    expect(source.toLowerCase()).not.toContain("qayyim");
  });
});
