// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildDailyStory, renderTelegramHtml, STORY_LIMIT, type StoryInput } from "@/lib/qayyim/daily-story";

/**
 * The morning message — the one thing the owner reads without opening the
 * dashboard. Pure (numbers in, Arabic out) so the wording, the link, and the
 * length budget are testable without a Telegram token or a database.
 */

const base: StoryInput = {
  dateKey: "2026-09-26",
  luxuryScore: 51,
  activeGoals: 3,
  atRiskCount: 1,
  anomalyDigest: "• يوم 2026-09-21: 51 حدث — أعلى من الطبيعي بـ 5.2 درجة (اليوم العادي حوالي 4).",
  errors: [],
  siteUrl: "https://azenith-living.vercel.app",
};

describe("buildDailyStory", () => {
  it("leads with the measured score, not a mood", () => {
    const s = buildDailyStory(base);
    expect(s.title).toContain("2026-09-26");
    expect(s.text).toContain("الفخامة");
    expect(s.text).toContain("51");
  });

  it("carries the at-risk goals and the watchdog line", () => {
    const s = buildDailyStory(base);
    expect(s.text).toContain("1");
    expect(s.text).toContain("2026-09-21");
  });

  it("links straight to the decision card when a proposal exists", () => {
    const s = buildDailyStory({ ...base, proposalId: "abc-123" });
    expect(s.href).toBe("https://azenith-living.vercel.app/admin/v2/agents/qayyim?proposal=abc-123");
    expect(s.text).toContain("abc-123");
  });

  it("falls back to the plain dashboard link with nothing pending", () => {
    expect(buildDailyStory(base).href).toBe("https://azenith-living.vercel.app/admin/v2/agents/qayyim");
  });

  it("says something useful when everything was quiet", () => {
    const s = buildDailyStory({
      ...base,
      luxuryScore: null,
      luxuryNote: "لم تُقاس أي إشارة",
      atRiskCount: 0,
      anomalyDigest: "مفيش شذوذ في حركة الزوار",
    });
    expect(s.text).toContain("لم تُقاس");
    expect(s.text).toContain("مفيش شذوذ");
    expect(s.text).not.toContain("51");
  });

  it("reports failed reads instead of hiding them", () => {
    const s = buildDailyStory({ ...base, errors: ["Luxury score: timeout", "الأهداف: bad"] });
    expect(s.text).toContain("2");
    expect(s.text).toContain("timeout");
  });

  it("mentions the rivals read only on the morning it ran", () => {
    expect(buildDailyStory(base).text).not.toContain("منافس");
    expect(buildDailyStory({ ...base, rivals: { crawled: 2, failed: 0, skipped: 0 } }).text).toContain("منافس");
  });

  it("counts failed reads and quotes only the first one", () => {
    const many = buildDailyStory({
      ...base,
      errors: Array.from({ length: 40 }, (_, i) => `خطأ ${i}`),
    });
    expect(many.text).toContain("40");
    expect(many.text).toContain("خطأ 0");
    expect(many.text).not.toContain("خطأ 39");
  });

  it("trims the details but keeps the link when the story is too long", () => {
    // The digest is the part that can be arbitrarily long: the watchdog lists one
    // line per flagged day and the rival read lists one per competitor. The link
    // is the part he acts on, so it survives the cut.
    const long = buildDailyStory({
      ...base,
      proposalId: "abc-123",
      anomalyDigest: Array.from({ length: 200 }, (_, i) => `• يوم 2026-08-0${i % 9}: ${i} حدث — أعلى من الطبيعي`).join("\n"),
    });
    expect(long.text.length).toBeLessThanOrEqual(STORY_LIMIT);
    expect(long.text).toContain("بقية التفاصيل في اللوحة");
    expect(long.text).toContain("abc-123");
    expect(long.text).not.toContain("• يوم 2026-08-00: 199");
  });
});

describe("renderTelegramHtml", () => {
  it("escapes markup that arrived from table contents", () => {
    // Digests and driver errors are assembled from database text. One angle
    // bracket in there must not turn the morning report into a parse error.
    const s = buildDailyStory({ ...base, anomalyDigest: "• سعر <undefined> ظهر في الدفتر" });
    const html = renderTelegramHtml(s);
    expect(html).toContain("&lt;undefined&gt;");
    expect(html).not.toContain("<undefined>");
  });

  it("hides the link behind words and leads with the date", () => {
    const html = renderTelegramHtml(buildDailyStory({ ...base, proposalId: "abc-123" }));
    expect(html).toContain('<a href="https://azenith-living.vercel.app/admin/v2/agents/qayyim?proposal=abc-123">');
    expect(html).toContain("<b>قيّم الدار — صباح 2026-09-26</b>");
    expect(html).not.toContain("?proposal=abc-123 افتح");
  });
});
