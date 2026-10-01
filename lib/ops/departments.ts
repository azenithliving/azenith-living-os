/**
 * departments.ts — the six departments of the owner's architecture, and which live
 * employee actually stands behind each one.
 *
 * The department names come from the company's own structural map; the employee keys
 * come from `identity.ts`, which owns every identity in the store. Nothing here
 * invents a staff member: a department with no live employee carries a written line
 * instead of a card, so no door on the owner's phone can open onto something that
 * does not exist.
 */

import { AGENT_KEYS, agentLabel } from "./identity";

/** The sales employee is not a ninth swarm member — his body is `vanguard`. */
export const SALES_KEY = "vanguard";
export const SALES_TITLE = "مدير المبيعات";

export type Department = {
  id: string;
  /** Section name only. A person is never named here — `agentLabel` owns people. */
  title: string;
  members: string[];
  /** Shown in place of a card when the department has no live employee. */
  vacancy: string | null;
};

/**
 * Every live swarm key appears exactly once, plus the sales employee. The count is
 * what `tests/ops/departments.test.ts` guards: a key dropped from this list loses
 * its only door on the owner's screens, and a key listed twice gives him two cards
 * for one employee.
 */
export const DEPARTMENTS: Department[] = [
  {
    id: "operations",
    title: "قسم العمليات والجودة المركزية",
    members: ["ops-lead", "ops-qa"],
    vacancy: null,
  },
  {
    id: "sales",
    title: "قسم المبيعات وتجربة العميل",
    members: [SALES_KEY],
    vacancy: null,
  },
  {
    id: "content",
    title: "قسم المحتوى والمعرض البصري",
    members: ["ops-content", "ops-visual", "ops-seo"],
    vacancy: null,
  },
  {
    id: "analytics",
    title: "قسم التحليلات واستخبارات السوق",
    members: ["ops-analytics", "ops-ux"],
    vacancy: null,
  },
  {
    id: "engineering",
    title: "قسم الهندسة والتطوير البرمجي",
    members: ["ops-dev"],
    vacancy: null,
  },
  {
    id: "security",
    title: "قسم الأمان وحماية البيانات",
    members: [],
    vacancy:
      "القسم ده شغال لسه بآلات بلا موظف: البوابات والحراسات موجودة، بس مفيش وكيل محدد لسه اسمه. أول ما يتعيّن هيظهر كارته هنا — ما بنفتحش باب على موظف مش موجود.",
  },
];

export const DEPARTMENT_KEYS: string[] = DEPARTMENTS.flatMap((d) => d.members);

/** Where a card takes the owner: the employee's own house, never a guess. */
export function employeeHref(key: string): string {
  return key === SALES_KEY
    ? "/admin/v2/sales"
    : `/admin/v2/agents/ops?agent=${key}`;
}

/** The Arabic name a human reads under this key. */
export function employeeTitle(key: string): string {
  return key === SALES_KEY ? SALES_TITLE : agentLabel(key);
}

/** True only for keys this module is allowed to put a card for. */
export function isStaffedEmployee(key: string): boolean {
  return (AGENT_KEYS as readonly string[]).includes(key) || key === SALES_KEY;
}
