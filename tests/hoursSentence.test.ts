// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parseHoursSentence, describeSchedule } from "@/lib/hours-sentence";

/**
 * The owner's sentence in, a schedule out — measured against the two sentences his store's
 * knowledge actually holds today (one newest, one older), not invented examples.
 */
describe("the recorded hours sentence becomes the schedule", () => {
  it("reads the row the advisor quotes today", () => {
    expect(parseHoursSentence("مواعيد العمل: كل أيام الأسبوع من ٩ صباحًا حتى ٨ مساءً، ما عدا الجمعة.")).toEqual({
      openHour: 9,
      closeHour: 20,
      holidayDay: 5,
    });
  });

  it("reads the older row too, and says what it says", () => {
    const schedule = parseHoursSentence(
      "الشركة فى مدينة السلام - القاهرة ،ومواعيد العمل يوميا من ١٠ صباحا حتى ٦ مساء عدا يوم الجمعة",
    );
    expect(schedule).toEqual({ openHour: 10, closeHour: 18, holidayDay: 5 });
    expect(describeSchedule(schedule!)).toContain("ما عدا");
  });

  it("takes Latin digits as happily as Arabic ones", () => {
    expect(parseHoursSentence("من 9 صباحاً حتى 8 مساءً")).toEqual({ openHour: 9, closeHour: 20, holidayDay: null });
  });

  it("refuses rather than invents an opening time", () => {
    expect(parseHoursSentence("")).toBeNull();
    expect(parseHoursSentence(null)).toBeNull();
    expect(parseHoursSentence("الشغل على مدار اليوم")).toBeNull();
    // One number, or numbers without their half of the day, is not a schedule.
    expect(parseHoursSentence("بنفتح ٩")).toBeNull();
    expect(parseHoursSentence("من ٩ حتى ٦")).toBeNull();
    // A closing hour before the opening one is a sentence this store has not written.
    expect(parseHoursSentence("من ٩ مساءً حتى ٦ صباحًا")).toBeNull();
  });

  it("only names a closed day when the sentence excludes one", () => {
    expect(parseHoursSentence("من ٩ صباحًا حتى ٨ مساءً كل يوم الجمعة")?.holidayDay).toBeNull();
    expect(parseHoursSentence("من ٩ صباحًا حتى ٨ مساءً ما عدا السبت")?.holidayDay).toBe(6);
  });
});
