import { describe, expect, it } from "vitest";
import { extractUiAction, polishReply } from "@/lib/consultant/reply-polish";
import { AWAY_REFERRAL } from "@/lib/consultant/customer-voice";
import { IDENTITY_DENIAL } from "@/lib/consultant/identity-voice";

/**
 * Two answers read off the published store on 2026-10-02, byte for byte, pushed through the
 * real pipeline rather than a copy of it. Both reached a customer looking like a general
 * buying guide: markdown symbols printed as text, other people's shops named, and — in the
 * second — the districts of Cairo explained as an outsider would explain them. The sentence
 * in each that denied the store had already been removed by the identity guard before this
 * text was captured, which is why the store's own line sits at the end of both.
 */
const LIVE_GUIDE = "أهلاً بك! لكن، إذا كنت تبحث عن \"ركنة مودرن\" لصالتك، يمكنني مساعدتك جداً في الأمور التالية: 1. **أحدث الصيحات (Trends):** أقول لك ما هي الألوان والأشكال الموضة في 2024 (مثل الركنات \"البانوراما\" أو الأشكال الانسيابية \"Curved Sofas\"). 2. **أنواع الأقمشة:** الفرق بين الكتان، القطيفة (المخمل)، والجلد المقلوب، وأيهم أفضل للاستخدام اليومي. 3. **تنسيق الألوان:** أساعدك في اختيار لون الركنة الذي يليق مع لون دهانات الحوائط والسجاد عندك. 4. **نصائح للمساحات:** كيف تختار مقاس الركنة المناسب لمساحة صالتك لكي لا تسبب زحاماً. 5. **أماكن الشراء:** إذا أخبرتني في أي مدينة أو دولة أنت، يمكنني أن أقترح عليك أسماء معارض مشهورة أو مواقع إلكترونية موثوقة تبيع أثاث مودرن. **هل تحب أن أقترح عليك أفكاراً معينة أو ألواناً تليق مع ديكور بيتك؟**\nأنا مساعد أزينث ليفينج، وفريق المتجر هو اللي بينفّذ المشروع.";

const LIVE_DISTRICTS = "أهلاً بك! لكن لو سؤالك ده موجه لشركة معينة ووصلت لي بالخطأ، أو لو حابب تعرف النظام العام في المنطقة دي، خليني أوضح لك نقطتين مهمين: 1. **بخصوص المناطق:** \"التجمع\" (الخامس، الأول، الثالث) هو جزء من مدينة **القاهرة الجديدة**. وعادةً أي شركة بتشتغل في التجمع بتغطي القاهرة الجديدة بالكامل، ومؤخراً معظمهم بيغطي كمان العاصمة الإدارية، مدينتي، والرحاب، والمستقبل سيتي لأنهم كلهم في نفس النطاق الجغرافي. 2. **مين اللي بينفذ الشغل؟** في الشركات الاحترافية، التنفيذ بيكون كالتالي: * **إشراف هندسي:** مهندس موقع متخصص هو اللي بيستلم كل خطوة. * **فنيين وعمال:** طقم من الصنايعية (كهرباء، سباكة، نقاشة، إلخ) بيكونوا إما عمالة ثابتة في الشركة أو مقاولين \"باطن\" الشركة بتتعامل معاهم باستمرار ومسؤولة عن جودة شغلهم. **لو كنت بتدور على نصيحة بخصوص تشطيب شقتك أو فيلتك في التجمع، أقدر أساعدك بـ:**\n* إزاي تختار شركة تشطيب مضمونة. * متوسط أسعار المتر حالياً (نصف تشطيب أو لوكس). * أهم الخطوات اللي لازم تتابعها وقت التنفيذ. **هل حابب أساعدك في أي معلومة تخص التشطيبات أو الأسعار؟**\nأنا مساعد أزينث ليفينج، وفريق المتجر هو اللي بينفّذ المشروع.";

describe("what the customer reads after the pipeline", () => {
  for (const [name, raw] of [["the corner-sofa guide", LIVE_GUIDE], ["the districts answer", LIVE_DISTRICTS]] as Array<[string, string]>) {
    it(`prints no markdown symbols in ${name}`, () => {
      const out = polishReply(raw, "ar");
      expect(out).not.toContain("**");
      expect(out).not.toContain("###");
      expect(out).not.toMatch(/^\s*\*/m);
      expect(out).not.toContain("`");
    });

    it(`keeps no denial and no other shop in ${name}`, () => {
      const out = polishReply(raw, "ar");
      expect(IDENTITY_DENIAL.test(out)).toBe(false);
      expect(AWAY_REFERRAL.test(out)).toBe(false);
    });

    it(`still says something useful in ${name}`, () => {
      const out = polishReply(raw, "ar");
      expect(out.replace(/\s/g, "").length).toBeGreaterThan(60);
    });
  }

  it("measured these two as defective before the pipeline changed", () => {
    // The evidence stays: both raw answers carried symbols and a pointer to somebody else.
    expect(LIVE_GUIDE).toContain("**");
    expect((LIVE_GUIDE.match(/\*\*/g) ?? []).length).toBeGreaterThan(4);
    expect(LIVE_DISTRICTS).toContain("\n* ");
    expect(AWAY_REFERRAL.test(LIVE_GUIDE)).toBe(true);
    expect(AWAY_REFERRAL.test(LIVE_DISTRICTS)).toBe(true);
  });
});

describe("the hidden UI action", () => {
  it("comes out at the end and never inside the sentence a customer reads", () => {
    const out = polishReply("الركنة الكلاسيك تحتاج خشب زان وتفاصيل يدوية.\n[UI_ACTION: theme_classic]", "ar");
    expect(out.endsWith("[UI_ACTION: theme_classic]")).toBe(true);
    expect(extractUiAction(out).uiAction).toBe("theme_classic");
    expect(extractUiAction(out).cleanReply).not.toContain("UI_ACTION");
  });
});
