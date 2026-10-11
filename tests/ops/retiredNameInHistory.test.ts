// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { ownerRowText } from "@/lib/ops/owner-voice";

/**
 * The retired name is dead, so it must not survive in the row he scrolls past.
 *
 * `finalizeReply` scrubs it from a live answer, and a guard keeps it out of the source — but the
 * database holds 156 rows written before that scrub existed (measured 2026-10-11, `select count(*)
 * where content ~ 'قيّم الدار'`), and the chat prints a stored row through the voice pass only. So the
 * product name the owner retired twice is still signing his history, and the swarm is introducing
 * itself to him with a name that no longer exists.
 *
 * One function now does both passes, so a surface cannot get the voice and forget the name.
 */
describe("a stored row is spoken and scrubbed together", () => {
  it("replaces the retired product name with whoever wrote the row", () => {
    expect(ownerRowText("بصفتي **قيّم الدار**، المسؤول عن الجودة", "ops-qa")).toContain("وكيل الجودة");
    expect(ownerRowText("بصفتي **قيّم الدار**، المسؤول عن الجودة", "ops-qa")).not.toContain("قيّم الدار");
  });

  it("leaves ordinary Arabic that merely looks like it alone", () => {
    const keep = "القيّم على القسم راجع التقييم، وقيّم جودتها قبل النشر";
    expect(ownerRowText(keep, "ops-lead")).toBe(keep);
  });

  it("still speaks the machine words, in one pass", () => {
    const out = ownerRowText("المسؤول: ops-content — النتيجة 5", "ops-content");
    expect(out).toContain("وكيل المحتوى");
    expect(out).toContain("٥");
  });

  it("is what the chat actually calls for a row that is not his own", () => {
    const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");
    expect(panel).toContain("ownerRowText(");
    expect(panel).not.toContain("ownerVoice(message.content)");
  });
});
