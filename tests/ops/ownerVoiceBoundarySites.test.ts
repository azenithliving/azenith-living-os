// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { ownerVoice } from "@/lib/ops/owner-voice";

/**
 * The owner-voice boundary sits on every stored sentence he reads, not only on chat bubbles.
 *
 * The rendered census (2026-10-11) left 80 Latin places inside prose the house itself wrote into
 * rows — and the reason was not that the scrubber lacks words for them. Four surfaces print a stored
 * column straight out: the paper desk's failure line, the approval card's body, the task queue's
 * title, and the activity feed's title. Chat bubbles were the one place the boundary was wired.
 *
 * A guard that only reads source files proves nothing about what he sees, so this asserts both: the
 * render site calls the boundary, and the boundary actually says the word in Arabic.
 */
const sites: Array<{ file: string; needs: string[] }> = [
  { file: "app/admin/v2/sketches/page.tsx", needs: ["ownerVoice(row.failure"] },
  { file: "components/admin/agents/ApprovalDecisionBlock.tsx", needs: ["ownerVoice("] },
  { file: "components/admin/agents/TaskQueue.tsx", needs: ["ownerVoice(task.title"] },
  { file: "components/admin/agents/AgentActionsFeed.tsx", needs: ["ownerVoice(item.title"] },
];

describe("stored sentences pass the boundary", () => {
  it.each(sites)("%s speaks what the row holds", ({ file, needs }) => {
    const source = readFileSync(file, "utf8");
    for (const needle of needs) expect(source, `${file} → ${needle}`).toContain(needle);
  });
});

describe("the words those rows carry", () => {
  it("names the house's own nouns in Arabic", () => {
    expect(ownerVoice("تحليل gallery")).toContain("معرض");
    expect(ownerVoice("واتساب dossier")).toContain("ملف العميل");
    expect(ownerVoice("نشر عبر PR")).toContain("طلب تعديل");
    expect(ownerVoice("وكيل visual")).toContain("المرئيات");
    expect(ownerVoice("نوع الحدث: command")).toContain("أمر");
  });

  it("does not translate an English sentence word by word into gibberish", () => {
    // «This model is currently experiencing» is not four nouns; leaving it whole is honest,
    // mangling it into Arabic fragments would read as a broken product.
    const out = ownerVoice("This model is currently experiencing high demand");
    expect(out).not.toMatch(/هو حاليًا|نموذج هو/);
  });
});
