// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

/**
 * The sales manager's knowledge, measured on the new desk.
 *
 * The generated transfer ledger said the new sales office could not reach five of the old screen's
 * doors. Three of them are the manager's memory — the rules he was taught, the customer questions he
 * could not answer, and the auditor that hunts gaps — so without them the office is a mouth without a
 * memory. These guards hold the move, and hold the two brakes that came with it: a door that refuses
 * must be heard on the panel, and erasing a taught rule stays the owner's word, not a button.
 */
const deskPath = "components/admin/sales/KnowledgeDesk.tsx";
const pagePath = "app/admin/v2/sales/page.tsx";

describe("the sales knowledge desk in the new house", () => {
  it("is mounted under the manager, not left in the old page", () => {
    expect(existsSync(deskPath), "components/admin/sales/KnowledgeDesk.tsx is missing").toBe(true);
    const page = readFileSync(pagePath, "utf8");
    expect(page).toContain("KnowledgeDesk");
    expect(page).toContain("<KnowledgeDesk />");
  });

  it("reaches the three doors the old screen held alone", () => {
    const desk = readFileSync(deskPath, "utf8");
    expect(desk).toContain("/api/consultant/learnings");
    expect(desk).toContain("/api/consultant/pending-questions");
    expect(desk).toContain("/api/admin/knowledge/audit");
    expect(desk).toContain('method: "PATCH"');
  });

  it("carries no erase button — retiring a taught rule is the owner's word", () => {
    const desk = readFileSync(deskPath, "utf8");
    expect(desk).not.toContain('method: "DELETE"');
    expect(desk).toContain("المسح مش في الأيد دي");
  });

  it("says a refusal out loud instead of showing an empty list", () => {
    const desk = readFileSync(deskPath, "utf8");
    expect(desk).toContain("من غير ما يوصّل سبب");
    expect(desk).toContain("القاعدة ما اتسجلتش");
    expect(desk).toContain("التصحيح ما اتعملش");
    expect(desk).toContain("الإجابة ما اتعلمتهاش");
    // A learning that saved but could not be marked must not be reported as a clean success.
    expect(desk).toContain("السؤال اتعلّم، بس الإشارة عليه ما اتقصتش");
  });

  it("shows his digits and never a machine identifier", () => {
    const desk = readFileSync(deskPath, "utf8");
    expect(desk).toContain("arNum");
    expect(desk).toContain("arDigits");
    expect(desk).not.toMatch(/session_id/);
    // A row id may be a React key; it must never be text the owner reads.
    for (const m of desk.matchAll(/([A-Za-z]+\.id)\}/g)) {
      const start = Math.max(0, (m.index ?? 0) - m[1].length - 6);
      expect(desk.slice(start, (m.index ?? 0) + m[1].length + 1), "a machine id is being rendered as text").toContain("key=");
    }
  });

  it("every interactive control is reachable from the keyboard", () => {
    const desk = readFileSync(deskPath, "utf8");
    const buttons = desk.match(/<button/g) ?? [];
    const focusable = desk.match(/focus-visible:ring/g) ?? [];
    expect(focusable.length, "a button without a focus ring is invisible to a keyboard owner").toBeGreaterThanOrEqual(buttons.length);
    expect(desk).toContain('className="sr-only"');
  });

  it("the generated ledger stops counting the knowledge doors as old-only", () => {
    const ledger = JSON.parse(readFileSync("docs/ledger/transfers.json", "utf8")) as {
      rows: { atom: string; kind: string; evidence?: { onlyOldDoors?: string[] } }[];
    };
    const sales = ledger.rows.find((r) => r.atom === "app/admin/sales/page.tsx");
    expect(sales, "the sales screen must still be a row in the ledger").toBeTruthy();
    const left = sales?.evidence?.onlyOldDoors ?? [];
    for (const door of ["/api/consultant/learnings", "/api/consultant/pending-questions", "/api/admin/knowledge/audit"]) {
      expect(left, `${door} is still reachable only from the old house`).not.toContain(door);
    }
  });
});
