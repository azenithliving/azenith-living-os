// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { deskTruthFor, honestDeskClaims } from "@/lib/ops/claims";

/**
 * A claim that a desk ran is a fact, and a fact has a record.
 *
 * Measured 2026-10-07: of 856 agent rows, 34 say «نفّذنا/شغّلنا/فعّلنا» and 3 of them carry no desk
 * record at all; one live sample (asked on his own chat) read «أضع بين يديك التقرير الاستراتيجي
 * الفوري لعمليات «عالم الدار»، بعد تفعيل الأدوات وتوزيع الأدوار على الوكلاء» while nothing ran — and
 * the internal critic let it through, because the critic is shown the question and the draft only:
 * it has no idea whether a desk was called. So the truth goes to the critic, and the sentence is
 * struck at the write boundary whatever the critic decides.
 */
const LIVE_LIE =
  "أهلاً بك مجدداً.\n\nبصفتي **مدير تشغيل المحتوى**، أضع بين يديك التقرير الاستراتيجي الفوري لعمليات «عالم الدار»، بعد تفعيل الأدوات وتوزيع الأدوار على الوكلاء:\n\n### تقرير حالة عالم الدار\n\nالمبيعات الفترة دي ٧٠٠٠٠٠ ج.م.";

describe("a claim with no desk behind it", () => {
  it("strikes the sentence that says work was done", () => {
    const out = honestDeskClaims(LIVE_LIE, { tool: null });
    expect(out.text).not.toContain("بعد تفعيل الأدوات");
    expect(out.text).not.toContain("توزيع الأدوار");
    expect(out.removed.length).toBeGreaterThan(0);
  });

  it("keeps what he actually asked for and the greeting", () => {
    const out = honestDeskClaims(LIVE_LIE, { tool: null });
    expect(out.text).toContain("أهلاً بك مجدداً");
    expect(out.text).toContain("٧٠٠٠٠");
  });

  it("says out loud that nothing was executed", () => {
    expect(honestDeskClaims(LIVE_LIE, { tool: null }).text).toContain("مفيش مكتب اتشغّل");
  });

  it("does not touch the same words when a desk really ran", () => {
    const out = honestDeskClaims(LIVE_LIE, { tool: "ops_world" });
    expect(out.text).toBe(LIVE_LIE);
    expect(out.removed).toEqual([]);
  });

  it("leaves an answer that claims nothing", () => {
    const text = "عندك ٣ مسودات مستنية، وأقرب موعد رمضان.";
    const out = honestDeskClaims(text, { tool: null });
    expect(out.text).toBe(text);
    expect(out.removed).toEqual([]);
  });

  it("does not mistake a plan for a deed", () => {
    const text = "خطة مقترحة: هنفّذ الفحص الصبح لو موافقت.";
    expect(honestDeskClaims(text, { tool: null }).removed).toEqual([]);
  });

  it("counts a desk that failed to run as no desk", () => {
    const out = honestDeskClaims("شغّلنا الفحص وطلع كل حاجة تمام.", { tool: "qa_accessibility", ok: false });
    expect(out.removed.length).toBe(1);
    expect(out.text).toContain("مفيش مكتب اتشغّل");
  });

  it("keeps a reply that is nothing but the claim, and still says it plainly", () => {
    const out = honestDeskClaims("تم تنفيذ الطلب.", { tool: null });
    expect(out.text).toContain("مفيش مكتب اتشغّل");
  });
});

describe("the truth the critic is handed", () => {
  it("says plainly when nothing ran", () => {
    expect(deskTruthFor({ tool: null })).toBe("ولا مكتب اشتغل في الطلب ده");
    expect(deskTruthFor({ tool: "qa_accessibility", ok: false })).toContain("حاول يشتغل");
  });

  it("names the desk by its Arabic label when one ran", () => {
    const truth = deskTruthFor({ tool: "draft_list", ok: true });
    expect(truth).toContain("جرد المسودات المعلقة");
    expect(truth).not.toContain("draft_list");
  });
});

describe("the critic is told what actually ran", () => {
  const debate = readFileSync("lib/ops/debate.ts", "utf8");
  const orchestrator = readFileSync("lib/agents/AgentOrchestrator.ts", "utf8");

  it("the critic receives the desk truth", () => {
    expect(debate).toContain("deskTruth");
    expect(debate).toContain("بيدّعي تنفيذ خلاف دي");
  });

  it("the polish is told to delete an unsupported claim", () => {
    expect(debate).toContain("مكتب اشتغل");
  });

  it("the leader's path checks its claims before storing", () => {
    expect(orchestrator).toContain("honestDeskClaims(");
    expect(orchestrator).toContain("critiqueAndPolish(message, response,");
  });
});
