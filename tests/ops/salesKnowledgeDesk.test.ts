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
    expect(desk).toContain("الردّ ما اتسجلش");
    // A reply that landed but did not become a rule must not be reported as a clean success:
    // the door says which half happened and the panel repeats it.
    expect(desk).toContain("compiled");
    expect(desk).toContain("compiled.note");
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

  it("a missing model is a spoken refusal, never an empty list that looks like a clean shop", () => {
    const door = readFileSync("app/api/admin/knowledge/audit/route.ts", "utf8");
    expect(door).toContain("مفيش نموذج ذكي ردّ دلوقتي");
    expect(door).toContain("status: 503");
    expect(door).toContain("قواعد المعرفة ما قريتش");
    expect(door).toContain("التدقيق وقف");
    // The old shape answered 200 with an empty list and a Latin warning nobody rendered.
    expect(door).not.toContain("AI audit unavailable");
    expect(door).not.toContain('"Internal server error"');
  });

  it("keeps a Latin machine sentence off the owner's screen", () => {
    const desk = readFileSync(deskPath, "utf8");
    expect(desk).toContain("من غير ما يوصّل سبب بالعربي");
    expect(desk).toMatch(/\[؀-ۿ\]/);
  });

  it("the audit door answers in his language on every stop, and a rough reply is not a crash", () => {
    const door = readFileSync("app/api/admin/knowledge/audit/route.ts", "utf8");
    // Every refusal the owner can see must already be Arabic at the door, not only cleaned by the panel.
    // Machine prose is allowed in the log lines, so this walks the response fields, not the whole file.
    const spoken = [...door.matchAll(/error:\s*"([^"]*)"/g)].map((m) => m[1]);
    expect(spoken.length).toBeGreaterThanOrEqual(4);
    for (const line of spoken) {
      expect(line, `the door answers in Latin: ${line}`).toMatch(/[\u0600-\u06FF]/);
    }
    expect(door).toContain("القاعدة ما اتوصلش");
    expect(door).toContain("سببه اتسجل في اللوج مش على الشاشة");
    expect(door).not.toContain("What locations in Egypt");
    // Brackets that are not JSON used to throw out of the parser and surface as an unnamed 500.
    expect(door).toMatch(/try \{\s*\n\s*parsed = JSON\.parse/);
  });

  it("does not print a reassuring zero before the hunt has really finished", () => {
    const desk = readFileSync(deskPath, "utf8");
    // An empty list beside a heading reads as «clean shop», whether the audit refused or never ran.
    expect(desk).toContain("count={auditing || auditError || !auditRan ? null : gaps.length}");
    expect(desk).toContain("setAuditRan(true)");
    expect(desk).toContain("لسه ما دورتش");
    expect(desk).toContain("دوّر وما لقاش فجوة");
    expect(desk).not.toContain("لما تدوّر ولقي فجوة");
  });

  it("the door that answers a question is the one owner of the rule it turns into", () => {
    const desk = readFileSync(deskPath, "utf8");
    const questionDoor = readFileSync("app/api/consultant/pending-questions/route.ts", "utf8");
    // Teaching on an answer used to write two rows: the panel's own and the door's compiled one.
    expect(desk).not.toMatch(/method: "POST"[\s\S]{0,200}instruction: `سؤال:/);
    expect(questionDoor).toContain("سؤال: ${originalQuestion} -> إجابة: ${answered_reply}");
    expect(questionDoor).toContain("القاعدة ما اتكوّنتش");
  });

  it("a door that cannot write stops claiming it wrote", () => {
    const learningsDoor = readFileSync("app/api/consultant/learnings/route.ts", "utf8");
    const questionDoor = readFileSync("app/api/consultant/pending-questions/route.ts", "utf8");
    // Both doors used to park a row in a request-local Map on a database failure and answer «saved».
    // That memory dies with the invocation, so the next visit could not find the rule it promised.
    for (const door of [learningsDoor, questionDoor]) {
      expect(door).not.toContain("IN_MEMORY");
      expect(door).not.toContain("Falling back to");
    }
    expect(learningsDoor).toContain("القاعدة ما اتحفظتش في القاعدة");
    expect(questionDoor).toContain("السؤال ما اتسجلش");
    // An erase now counts the rows that actually went.
    expect(learningsDoor).toContain("فما اتشالش حاجة");
    // The queue door used to write a `user_email` column the table has never had (measured: the table
    // is six columns), so every real insert failed and the memory fallback called it a success.
    expect(questionDoor).not.toContain("user_email");
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
