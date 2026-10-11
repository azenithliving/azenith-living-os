// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { ownerVoice } from "@/lib/ops/owner-voice";

/**
 * The row is clean when it is written, not only when it is read.
 *
 * Measured on the live database 2026-10-11: the swarm's own prompt law works — 1 of 20 employee rows
 * written in the last week carried an English phrase, against 225 of 850 (26%) before it. What still
 * reaches him from those rows is history, plus tool output the model echoes. The render boundary was
 * wired to every stored-column surface; this closes the other half, so a row stored from now on holds
 * the Arabic the store would have shown him anyway.
 *
 * That only works if speaking a row twice says the same thing as speaking it once — otherwise the
 * write pass and the render pass would compound and eat words. The idempotency test below is the
 * reason it is safe, and it runs on the sentences measured on his screens, not on invented ones.
 */
const SAMPLES = [
  "شغّلت `lead_list` على الدفتر وطلع 5 عملاء",
  "النتيجة العامة: Pass — درجة التباين 3.76 مقابل 4.5",
  "المكتب المسؤول: ops-content خلّص المسودة",
  "تقرير فحص الوصول (Accessibility Audit Report) جاهز",
  "رابط التفاصيل: evidenceUrl — والزيارات 1200",
  "صحة النظام والمحتوى (System & Health) مستقرة",
];

describe("speaking a row twice says the same thing", () => {
  it("is idempotent on every sentence measured on his screens", () => {
    for (const s of SAMPLES) {
      const once = ownerVoice(s);
      expect(ownerVoice(once), s).toBe(once);
    }
  });

  it("keeps a web address intact through both passes", () => {
    const s = "شوف https://azenith-living.vercel.app/rooms/living-room دلوقتي";
    expect(ownerVoice(ownerVoice(s))).toBe(s);
  });
});

describe("the writer speaks what it stores", () => {
  const writes: Array<{ file: string; label: string }> = [
    { file: "lib/agents/AgentOrchestrator.ts", label: "the swarm's own reply" },
    { file: "app/api/cron/ops-proactive/route.ts", label: "the morning round" },
    { file: "app/api/admin/agents/conversations/route.ts", label: "a posted conversation row" },
  ];

  it.each(writes)("%s passes the content through the owner's voice", ({ file }) => {
    const source = readFileSync(file, "utf8");
    expect(source).toMatch(/from\((["'])agent_messages\1\)/);
    expect(source).toMatch(/content:\s*ownerVoice\(/);
  });

  /**
   * The user's own row is deliberately not spoken: his words are his, and a pass that rewrites what he
   * typed would be the store correcting the only person it works for.
   */
  it("leaves the owner's own row as he wrote it", () => {
    const source = readFileSync("lib/agents/AgentOrchestrator.ts", "utf8");
    expect(source).toMatch(/sender_type: "user",\s*\n\s*sender_name: "أنت",\s*\n\s*content: message,/);
  });
});
