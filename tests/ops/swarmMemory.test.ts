// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { arDigits, arNum } from "@/lib/ops/metricLabels";

import { memoryTokens } from "@/lib/ops/memory/SharedMemory";
import { roundLines } from "@/lib/ops/memory/remember-round";

/**
 * The swarm's memory: what it may say, and how it is read back.
 *
 * Measured 2026-10-15: `ops_semantic_memory` held 0 rows while its recall ran on every answer the
 * owner got from the cockpit chat — the only writer needed a model key, threw when none answered, and
 * was called by no surface. These guards hold the three things that make the replacement real: a
 * memory is written only from a number the round measured, the recall answers with zero keys, and the
 * reply says which door answered.
 */
const shared = readFileSync("lib/ops/memory/SharedMemory.ts", "utf8");
const brain = readFileSync("lib/ops/chat-brain.ts", "utf8");
const round = readFileSync("lib/ops/daily-round.ts", "utf8");
const orchestrator = readFileSync("lib/agents/AgentOrchestrator.ts", "utf8");
const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");

describe("the words a memory is read by", () => {
  it("folds his Arabic and drops the particles that match everything", () => {
    const tokens = memoryTokens("إيه سعر الصوف النهاردة في المعادي؟");
    expect(tokens).toContain("سعر");
    expect(tokens).toContain("الصوف");
    expect(tokens).toContain("المعادي");
    expect(tokens).not.toContain("في");
    expect(tokens).not.toContain("النهاردة");
  });

  it("an empty or stopword-only question asks nothing, so nothing is claimed", () => {
    expect(memoryTokens("هو في؟")).toEqual([]);
    expect(memoryTokens("")).toEqual([]);
  });
});

describe("what the round may remember", () => {
  // Digits come from the store's own helpers: a hand-typed Arabic-Indic number in an assertion has
  // lost characters before, and the test would then be measuring its own typo.
  const day = arDigits("2026-10-15");

  it("says only what was measured, in his digits", () => {
    const lines = roundLines({ luxuryScore: 78, activeGoals: 4, atRiskGoals: [1, 2] }, day);
    expect(lines.some((line) => line.includes(arNum(78)))).toBe(true);
    expect(lines.some((line) => line.includes("الشغالة"))).toBe(true);
    for (const line of lines) expect(line).not.toMatch(/[0-9]/);
  });

  it("a step that did not measure is remembered as not measuring", () => {
    const lines = roundLines({ luxuryScore: null, luxuryNote: "لم تُقاس أي إشارة (غير متاح: صور)" }, day);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("ما اتقاسش");
  });

  it("a round that measured nothing writes nothing", () => {
    expect(roundLines({}, day)).toEqual([]);
    expect(roundLines({ luxuryScore: null, activeGoals: null, anomaly: null, canary: null }, day)).toEqual([]);
  });

  it("a step whose result arrived as an unknown shape is not turned into a number", () => {
    // The round stores these as `unknown`; a missing reading must never be spoken as a zero.
    expect(roundLines({ canary: {}, anomaly: "لا شيء" }, day)).toEqual([]);
  });
});

describe("the writer never invents what it cannot compute", () => {
  it("a vector is attached only when one was generated", () => {
    expect(shared).toMatch(/\.\.\.\(embedding \? \{ embedding \} : \{\}\)/);
    expect(shared).toMatch(/catch \(e: any\) \{\s*\n\s*vectorFailure = /);
  });

  it("every count it reports is read back from the record", () => {
    const body = shared.slice(shared.indexOf("async storeText("), shared.indexOf("async recallText("));
    expect(body).toContain("count: 'exact'");
    expect(body).toMatch(/المحفوظ \$\{stored\}/);
    expect(body).toContain("كتابة مرفوضة");
  });

  it("a duplicate day does not rewrite the history it already holds", () => {
    const body = shared.slice(shared.indexOf("async storeText("), shared.indexOf("async recallText("));
    expect(body).toContain("duplicate: true");
  });
});

describe("the recall answers with zero model keys", () => {
  it("the keyword floor asks no provider", () => {
    const body = shared.slice(shared.indexOf("async recallText("), shared.indexOf("async searchSimilar("));
    expect(body).not.toContain("generateEmbedding");
    expect(body).toContain("foldArabic");
  });

  it("semantic first, then the floor, and a refusal is named", () => {
    expect(brain).toContain("recallText(");
    expect(brain).toMatch(/how: "vector"/);
    expect(brain).toMatch(/how: "keyword"/);
    expect(brain).toContain("الذاكرة ما اتقريتش");
    // The old shape returned "" from a bare catch — a silence that read as "nothing to remember".
    expect(brain).not.toMatch(/catch \{\s*\n\s*return "";\s*\n\s*\}/);
  });

  it("the reply carries what answered, and the panel shows it to the owner", () => {
    expect(orchestrator).toContain("metadata as any).memory = { count: memory.count, how: memory.how }");
    // Measured live: the door sent the count and the screen showed nothing, because the fact rode on
    // the response and the panel refreshes its rows from the record. So the row carries it too.
    expect(orchestrator).toContain("...(memory.count ? { memory: { count: memory.count, how: memory.how } } : {})");
    expect(panel).toContain("data-chat-memory");
    expect(panel).toContain("رجع لذاكرة الدار");
    expect(panel).toContain("سطر بالكلمة من غير مفتاح نموذج");
    expect(panel).toContain("(message.context as { memory?: unknown } | undefined)?.memory");
  });
});

describe("the producer runs with the round", () => {
  it("the round remembers what it measured, and says so when the record refuses", () => {
    expect(round).toContain("rememberRound(companyId, results)");
    expect(round).toContain("results.memoryWritten");
    expect(round).toMatch(/ذاكرة الدار: \$\{remembered\.failures\.join/);
  });

  it("the writer itself names the day it wrote for", () => {
    const remember = readFileSync("lib/ops/memory/remember-round.ts", "utf8");
    expect(remember).toContain("الجولة ما قالتش حاجة مقاسة");
    expect(remember).toMatch(/سطور جديدة \$\{outcome\.wrote\}/);
  });
});
