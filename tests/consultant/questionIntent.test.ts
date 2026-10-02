import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import {
  asksCurrentLocation,
  asksEscalation,
  asksFoodNearby,
  asksPrice,
} from "@/lib/consultant/question-intent";

/**
 * Six real questions asked on the published store 2026-10-02. Three of them never reached a
 * model: the measurement printed the canned answer each one got instead.
 */
const LIVE_QUESTIONS = [
  "قولي إيه خطوات الشغل معاكم من أول ما أكلمكم لحد ما الأثاث يوصل؟",
  "إيه الفرق بين الركنة المودرن والكلاسيك، وأيه أنسب لشقة ١٨٠ متر؟",
  "إزاي أختار خامات النيش والمطبخ؟ عايز أعرف أفرّق بين الخشب الجيد والوحش.",
  "عايز أعرف عندكم ركن مودرن للصة؟",
  "بتشتغلوا في التجمع ولا القاهرة الجديدة بس؟ ومين اللي بينفّذ الشغل؟",
  "لو معايا ميزانية محدودة لشقة ١٢٠ متر، تنصحني أبدأ بإيه؟",
];

const CANNED: Array<[string, (message: string) => boolean]> = [
  ["price", asksPrice],
  ["escalation", asksEscalation],
  ["food", asksFoodNearby],
  ["location", asksCurrentLocation],
];

describe("the six live questions all reach the advisor now", () => {
  for (const question of LIVE_QUESTIONS) {
    it(`answers instead of canned-replying: ${question.slice(0, 42)}…`, () => {
      const taken = CANNED.filter(([, fires]) => fires(question)).map(([name]) => name);
      expect(taken, question).toEqual([]);
    });
  }

  it("measured the same six as stolen three of them before the fix", () => {
    // The three that were taken, and the word that took each one. Keeping the old nets' victims
    // here is what stops the same substring from being re-added later.
    expect(/أكل/.test("من أول ما أكلمكم")).toBe(true);
    expect(/متر/.test("أنسب لشقة ١٨٠ متر")).toBe(true);
    expect(/وحش/.test("بين الخشب الجيد والوحش")).toBe(true);
  });
});

describe("the money net still catches a money question", () => {
  for (const ask of [
    "الركنة دي بكام؟",
    "سعر المتر كام؟",
    "تكلفة المشروع كام جنيه؟",
    "ممكن عرض سعر للصالون؟",
    "إيه أسعار النيش عندكم؟",
    "What does a corner sofa cost?",
  ]) {
    it(`nets ${ask}`, () => expect(asksPrice(ask)).toBe(true));
  }

  for (const notAsk of [
    "كام يوم التوريد؟",
    "عندكم كاميرا مراقبة في المعرض؟",
    "شقة ١٨٠ متر، محتاج ركنة ونيش",
    "لو معايا ميزانية محدودة، أبدأ بإيه؟",
  ]) {
    it(`leaves ${notAsk} to the advisor`, () => expect(asksPrice(notAsk)).toBe(false));
  }
});

describe("the person net still catches a complaint aimed at us", () => {
  for (const ask of [
    "عايز أكلم المدير",
    "كلامك وحش",
    "الرد سيء",
    "الخدمة عندكم زفت",
    "مش فاهم حاجة",
    "I want to speak to a human",
  ]) {
    it(`nets ${ask}`, () => expect(asksEscalation(ask)).toBe(true));
  }

  for (const notAsk of [
    "إزاي أفرّق بين الخشب الجيد والوحش؟",
    "مين اللي بينفّذ الشغل عندكم؟",
    "هل أنت إنسان؟",
    "الشغل بيستغرق كام أسبوع؟",
  ]) {
    it(`leaves ${notAsk} to the advisor`, () => expect(asksEscalation(notAsk)).toBe(false));
  }
});

describe("food and location keep their own narrow doors", () => {
  it("reads a meal as a meal", () => {
    expect(asksFoodNearby("عايز آكل، فين أقرب مطعم؟")).toBe(true);
    expect(asksFoodNearby("any cafe near the showroom?")).toBe(true);
  });

  it("does not read a verb that contains a meal", () => {
    expect(asksFoodNearby("من أول ما أكلمكم لحد ما الأثاث يوصل")).toBe(false);
    expect(asksFoodNearby("غدا هاجي المعرض أشوف الركنات")).toBe(false);
  });

  it("reads a customer asking where he is", () => {
    expect(asksCurrentLocation("أنا فين دلوقتي؟")).toBe(true);
    expect(asksCurrentLocation("موقعي ظاهر عندك؟")).toBe(true);
    expect(asksCurrentLocation("where am i now?")).toBe(true);
  });

  it("does not read a delivery question as a location request", () => {
    expect(asksCurrentLocation("لحد ما الأثاث يوصل بيتي في التجمع")).toBe(false);
    expect(asksCurrentLocation("بتوصلوا المنصورة؟")).toBe(false);
  });
});

describe("the route asks the new module, not its own regexes", () => {
  const route = readFileSync("app/api/consultant/route.ts", "utf8");

  it("imports all four matchers", () => {
    expect(route).toContain('from "@/lib/consultant/question-intent"');
    for (const name of ["asksPrice", "asksEscalation", "asksFoodNearby", "asksCurrentLocation"]) {
      expect(route, name).toContain(name);
    }
  });

  it("no longer carries the two nets that stole questions", () => {
    expect(route).not.toContain("AR_EN_PRICE_RE");
    expect(route).not.toContain("AR_EN_ESCALATION_RE");
  });

  it("does not keep a second copy of the old matchers in the location module", () => {
    const services = readFileSync("lib/location-services.ts", "utf8");
    expect(services).not.toContain("isFoodNearbyRequest");
    expect(services).not.toContain("isCurrentLocationRequest");
  });
});
