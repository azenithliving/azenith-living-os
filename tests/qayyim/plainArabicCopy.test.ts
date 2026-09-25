// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderGscResult } from "@/lib/qayyim/gsc";
import { renderRivalsDigest, type RivalDigestEntry } from "@/lib/qayyim/rivals";
import { verdictForExperiment } from "@/lib/qayyim/experiment-verdict";
import { buildDailyStory } from "@/lib/qayyim/daily-story";
import { explainGap, type GapFacts } from "@/lib/qayyim/gap-contract";
import { renderForecast, forecastFromSeries } from "@/lib/qayyim/forecast";
import { renderAnomalyDigest } from "@/lib/qayyim/anomaly";
import { renderSelfReport, buildSelfModel, AUTONOMOUS_ORGANS, type SelfModel } from "@/lib/qayyim/self-model";

/**
 * The owner reads Arabic only, and this is not a taste question: a Latin token,
 * a bracket or an arrow inside an Arabic sentence flips the bidi rendering, so
 * the line arrives physically scrambled on his phone. Whatever the text says, he
 * cannot read it.
 *
 * So every string this swarm shows him is checked line by line: a line is either
 * Arabic, or it is a name/URL he has to type — never both.
 */

const facts: GapFacts = {
  tools: [
    { name: "qayyim_world", desc: "مبيعات الدار والأكثر بيعاً والكتالوج" },
    { name: "gsc_queries", desc: "كلمات البحث الحقيقية من خدمة بحث جوجل" },
  ],
};

function mixedLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /\p{Script=Arabic}/u.test(l) && /[A-Za-z]{2,}/.test(l));
}

const sampleRival: RivalDigestEntry = {
  name: "دار منافسة",
  url: "https://rival.example",
  crawledAt: "2026-09-21T07:00:00.000Z",
  status: "completed",
  error: null,
  signals: { pagesExamined: 8, productLinks: 12, visiblePrices: 4, whatsapp: true, priceCurrencies: ["جنيه"], words: 5000 },
  changes: ["عدد المنتجات زاد من 9 إلى 12"],
};

describe("owner-facing copy is Arabic per line", () => {
  it("the search console refusal", () => {
    const text = renderGscResult({ ok: false, missing: ["GSC_SITE_URL", "GOOGLE_APPLICATION_CREDENTIALS_JSON"] });
    expect(mixedLines(text)).toEqual([]);
    expect(text).toContain("GSC_SITE_URL");
  });

  it("the search console refusal when a variable is present but unusable", () => {
    const text = renderGscResult({
      ok: false,
      missing: ["GOOGLE_APPLICATION_CREDENTIALS_JSON"],
      note: "المتغير موجود بس محتواه مش مقروء.",
    });
    expect(mixedLines(text)).toEqual([]);
    expect(text).toContain("مش مقروء");
  });

  it("the search console results table", () => {
    const text = renderGscResult({
      ok: true,
      range: { start: "2026-08-26", end: "2026-09-24" },
      rows: [{ query: "كنبة ملكي", clicks: 3, impressions: 50, ctr: 0.06, position: 2 }],
    });
    expect(mixedLines(text)).toEqual([]);
  });

  it("the rival watch empty state", () => {
    expect(mixedLines(renderRivalsDigest([]))).toEqual([]);
  });

  it("a rival measurement digest", () => {
    expect(mixedLines(renderRivalsDigest([sampleRival]))).toEqual([]);
  });

  it("an A/B verdict, decisive and inconclusive", () => {
    const win = verdictForExperiment({
      controlImpressions: 1000, controlConversions: 100, variantImpressions: 1000, variantConversions: 130, minimumDetectableEffect: 30,
    });
    const tie = verdictForExperiment({
      controlImpressions: 1000, controlConversions: 100, variantImpressions: 1000, variantConversions: 104, minimumDetectableEffect: 30,
    });
    expect(mixedLines(win.text)).toEqual([]);
    expect(mixedLines(tie.text)).toEqual([]);
  });

  it("the morning story, with and without a proposal", () => {
    const base = {
      dateKey: "2026-09-26",
      luxuryScore: 51,
      activeGoals: 3,
      atRiskCount: 1,
      anomalyDigest: "مفيش شذوذ في حركة الزوار",
      errors: [],
      siteUrl: "https://azenith-living.vercel.app",
    };
    expect(mixedLines(buildDailyStory(base).text)).toEqual([]);
    expect(mixedLines(buildDailyStory({ ...base, proposalId: "abc-123" }).text)).toEqual([]);
  });

  it("a gap note, named and unnamed", () => {
    expect(mixedLines(explainGap("مش قادر", "كلمات البحث الحقيقية", facts))).toEqual([]);
    expect(mixedLines(explainGap("مش قادر", "عايز رسم بياني للتدفقات", facts))).toEqual([]);
  });

  it("a forecast and a refusal to forecast", () => {
    const seasonal = Array.from({ length: 56 }, (_, t) => 5000 + t * 40 + [0, 200, 400, 600, 900, 1500, 3000][t % 7]);
    expect(mixedLines(renderForecast(forecastFromSeries(seasonal, { horizon: 7, endDate: new Date("2026-09-25T12:00:00Z") })))).toEqual([]);
    const sparse = Array.from({ length: 90 }, (_, i) => (i === 40 ? 350_000 : 0));
    expect(mixedLines(renderForecast(forecastFromSeries(sparse, { horizon: 30, endDate: new Date("2026-09-25T12:00:00Z") })))).toEqual([]);
  });

  it("the traffic watchdog digest", () => {
    expect(mixedLines(renderAnomalyDigest([]))).toEqual([]);
    expect(
      mixedLines(renderAnomalyDigest([{ date: "2026-09-21", count: 51, z: 5.2, baseline: 4 }]))
    ).toEqual([]);
  });

  /**
   * The self-report is the one answer the owner reads for its own sake, and it
   * shipped with tool ids and a platform name sitting inside Arabic sentences —
   * the exact shape the rule exists to stop. Identifiers are still listed, just
   * on lines of their own.
   */
  it("the self report, with counters and without", () => {
    const withCounters: SelfModel = {
      generatedAt: "2026-09-26T00:00:00Z",
      title: "مدير تشغيل المحتوى",
      brand: "قيّم الدار",
      agents: [{ key: "qayyim-core", name: "القائد", roles: 6 }],
      tools: [
        { name: "qayyim_whoami", desc: "تقرير ذاتي" },
        { name: "seo_analyze", desc: "تحليل ظهور" },
      ],
      limits: ["كرون يومي واحد كحد أقصى"],
      organs: AUTONOMOUS_ORGANS,
      counters: { drafts: 3, goals: 1, learnings: 5, eventsToday: 12 },
      dataGaps: [{ label: "أهداف نشطة", reason: "relation qayyim_goals does not exist" }],
    };
    expect(mixedLines(renderSelfReport(withCounters))).toEqual([]);
    expect(mixedLines(renderSelfReport({ ...withCounters, counters: undefined }))).toEqual([]);
    // the identifiers did not disappear, they just got their own line
    const report = renderSelfReport(withCounters);
    expect(report).toContain("qayyim_whoami");
    expect(report.split("\n").find((l) => l.includes("qayyim_whoami"))).not.toMatch(/\p{Script=Arabic}/u);
  });

  /** The shipped limits text, not a fixture's: it named the hosting platform
   * inside an Arabic sentence, and only the real registry carries that. */
  it("the live registry renders without a mixed line", async () => {
    const real = await buildSelfModel(null);
    expect(real.tools.length).toBeGreaterThan(10);
    expect(mixedLines(renderSelfReport(real))).toEqual([]);
  });
});
