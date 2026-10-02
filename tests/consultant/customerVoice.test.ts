import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import {
  AWAY_REFERRAL,
  HERE_LINE,
  enforceNoReferralAway,
  plainCustomerReply,
} from "@/lib/consultant/customer-voice";

/**
 * Every defective sentence here was read off the published store on 2026-10-02, not invented:
 * the advisor answered a shopper's question about a corner sofa with a buying guide to other
 * people's shops, in markdown, in a chat bubble that prints plain text.
 */
const LIVE_GUIDE = `أهلاً بك! إليك بعض الأفكار والنصائح لاختيار ركنة مودرن مميزة: ### 1. الأشكال الرائجة حالياً (Trends):
* **الركنة الـ (L-Shape) البسيطة:** تكون بزاويتين فقط، وتناسب المساحات الصغيرة. * **الركنة "السمارت":** التي تحتوي على أماكن لشحن الموبايل (USB).`;

const LIVE_SHOP_LIST = `5. **أماكن الشراء:** إذا أخبرتني في أي مدينة أو دولة أنت، يمكنني أن أقترح عليك أسماء معارض مشهورة أو مواقع إلكترونية موثوقة تبيع أثاث مودرن.`;

const LIVE_COMPETITORS = `### أين يمكنك البحث؟ (في مصر كمثال):
* **ايكيا (IKEA):** للموديلات المودرن جداً والبسيطة. * **هب فرنيتشر (Hub Furniture) أو إن آند أوت (In & Out):** لديهم تشكيلات مودرن متنوعة. * **معارض دمياط:** إذا كنت تبحث عن خامات خشبية قوية جداً.`;

const LIVE_OTHER_COMPANY = `**لو كان سؤالك موجه لشركة معينة شفت إعلانها، يفضل تتواصل معهم عبر صفحتهم الرسمية أو أرقام تليفوناتهم عشان تعرف تفاصيلهم الخاصة.**`;

describe("the bubble prints plain text, so the markdown comes out", () => {
  it("takes the asterisks and hashes out of the live guide and keeps its Arabic", () => {
    const plain = plainCustomerReply(LIVE_GUIDE);
    expect(plain).not.toContain("**");
    expect(plain).not.toContain("###");
    expect(plain).not.toMatch(/^\s*\*/m);
    // Re-labelled 2026-10-03: this line used to demand the Latin shape names survive. The owner
    // surface rule says an Arabic line carries no Latin, and the measurement showed three of six
    // answers doing exactly that — so the gloss goes and the Arabic sentence around it stays.
    expect(plain).toContain("الركنة الـ");
    expect(plain).toContain("تكون بزاويتين فقط");
    expect(plain).not.toMatch(/L-Shape|U-Shape/);
  });

  it("turns a dashed bullet into a dot a phone can print", () => {
    const plain = plainCustomerReply("الخطوات:\n- قياس المساحة\n- اختيار الخامة");
    expect(plain).toBe("الخطوات:\n• قياس المساحة\n• اختيار الخامة");
  });

  it("keeps a link's words and drops its brackets", () => {
    expect(plainCustomerReply("شوف [الركنة المودرن](https://example.com/x) عندنا")).toBe(
      "شوف الركنة المودرن عندنا"
    );
  });

  it("leaves a clean reply exactly as it was", () => {
    const clean = "الركن المودرن بيحتاج إضاءة مخفية ومساحة حركة ٩٠ سم.\nتحب أبدأ معاك بالمقاسات ولا بالستايل؟";
    expect(plainCustomerReply(clean)).toBe(clean);
  });

  it("is idempotent, so a reply polished twice is not chewed twice", () => {
    const once = plainCustomerReply(LIVE_GUIDE);
    expect(plainCustomerReply(once)).toBe(once);
  });
});

describe("the advisor does not send the customer to another shop", () => {
  for (const [name, sentence] of [
    ["a guide to famous showrooms", LIVE_SHOP_LIST],
    ["a list of competitor names", LIVE_COMPETITORS],
    ["another company's own page", LIVE_OTHER_COMPANY],
  ] as Array<[string, string]>) {
    it(`removes ${name}`, () => {
      const { reply, repaired } = enforceNoReferralAway(sentence, "ar");
      expect(repaired).toBe(true);
      expect(AWAY_REFERRAL.test(reply)).toBe(false);
      expect(reply).toContain(HERE_LINE.ar);
    });
  }

  it("keeps the useful half of a mixed reply and only drops the sentence that gave the sale away", () => {
    const mixed = "الركنة المودرن عندنا بتتعمل بالمقاس اللي يناسب صالتك. " + LIVE_SHOP_LIST;
    const { reply, repaired } = enforceNoReferralAway(mixed, "ar");
    expect(repaired).toBe(true);
    expect(reply).toContain("بتتعمل بالمقاس اللي يناسب صالتك");
    expect(AWAY_REFERRAL.test(reply)).toBe(false);
  });

  it("leaves our own showroom alone", () => {
    const ours = "عندنا معرض في التجمع تقدر تزوره، وممكن نبعتلك مقاسات الركنة على واتساب.";
    const { reply, repaired } = enforceNoReferralAway(ours, "ar");
    expect(repaired).toBe(false);
    expect(reply).toBe(ours);
  });

  it("leaves a delivery promise alone", () => {
    const ours = "بنوصّل لكل مناطق القاهرة والجيزة، والتركيب من فريق الورشة عندنا.";
    expect(enforceNoReferralAway(ours, "ar").repaired).toBe(false);
  });

  it("leaves a compliment that mentions another showroom alone", () => {
    // «مش هتلاقي زيها في أي معرض تاني» sells our own corner sofa; the singular comparison is
    // not a referral, and cutting it would delete the sentence that was closing the sale.
    const ours = "الركنة دي مش هتلاقي زيها في أي معرض تاني.";
    expect(enforceNoReferralAway(ours, "ar").repaired).toBe(false);
  });

  it("still cuts the plural that really does point elsewhere", () => {
    const away = "فيه معارض تانية في مدينة نصر تقدر تشتري منها.";
    expect(enforceNoReferralAway(away, "ar").repaired).toBe(true);
  });

  it("says the fallback in Arabic without a Latin word in it", () => {
    expect(/[A-Za-z]{2,}/.test(HERE_LINE.ar)).toBe(false);
    expect(HERE_LINE.ar).toMatch(/\p{Script=Arabic}/u);
    expect(AWAY_REFERRAL.test(HERE_LINE.ar)).toBe(false);
    expect(AWAY_REFERRAL.test(HERE_LINE.en)).toBe(false);
  });
});

describe("the customer's door carries all of it", () => {
  const polish = readFileSync("lib/consultant/reply-polish.ts", "utf8");
  const route = readFileSync("app/api/consultant/route.ts", "utf8");

  it("polishes every model reply through both guards", () => {
    expect(polish).toContain('from "@/lib/consultant/customer-voice"');
    expect(polish).toContain("plainCustomerReply(polished)");
    expect(polish).toContain("enforceNoReferralAway(voice.reply, language)");
    expect(route).toContain('from "@/lib/consultant/reply-polish"');
    expect(route).toContain("polishReply(rawReply, language)");
  });

  it("tells both personas to speak as the store and to write no markdown", () => {
    expect(route.match(/Speak as (?:the store, in its own name|Azenith itself)/g)?.length).toBe(2);
    expect(route.match(/no markdown, no asterisks/g)?.length).toBe(2);
    expect(route.match(/never (?:tell the visitor where else|point the visitor to another shop)/g)?.length).toBe(2);
  });

  it("prints the reply with its line breaks in the customer's bubble", () => {
    const widget = readFileSync("components/ConsultantWidget.tsx", "utf8");
    expect(widget).toContain("whitespace-pre-line");
    expect(widget).toContain("data-chat-bubble={msg.role}");
  });
});

describe("the fast engine no longer answers with no idea whose shop it is in", () => {
  it("receives the same conversation, system prompt included", () => {
    const providers = readFileSync("lib/specialized-providers.ts", "utf8");
    expect(providers).toMatch(
      /export async function tryFastResponse\(\s*messages: Array<\{ role: string; content: string \}>/
    );

    const route = readFileSync("app/api/consultant/route.ts", "utf8");
    expect(route).toContain("tryFastResponse(groqMessages");
  });

  it("sends a question to the store's full advisor, and knows the Arabic question mark", () => {
    const route = readFileSync("app/api/consultant/route.ts", "utf8");
    expect(route).toContain("!/[?\\u061F]/.test(message)");
  });
});

describe("an Arabic line does not carry a Latin gloss", () => {
  /** Read off the published store 2026-10-03, three of six answers had one of these. */
  const LIVE_GLOSSES =
    'أهلاً بك! إليك أهم ما يميز الركن المودرن: 1. الركنة "المنفوخة" (Cloud Sofa): مريحة جداً. 2. الألوان (Trends): الرمادي. 3. اترك مساحة حركة (٩٠ سم) حول الركنة.';

  it("drops the translation and keeps the Arabic and the measurement", () => {
    const clean = plainCustomerReply(LIVE_GLOSSES);
    expect(clean).not.toMatch(/\p{Script=Latin}/u);
    expect(clean).toContain('الركنة "المنفوخة":');
    expect(clean).toContain("(٩٠ سم)");
    expect(clean).toContain("الرمادي");
    expect(clean).not.toMatch(/\(\s*\)/);
    expect(clean).not.toMatch(/ {2}/);
  });

  it("leaves an English answer's brackets alone", () => {
    const en = "The L-shaped corner (best seller) fits a 4 m wall.";
    expect(plainCustomerReply(en)).toBe(en);
  });

  it("is idempotent", () => {
    const once = plainCustomerReply(LIVE_GLOSSES);
    expect(plainCustomerReply(once)).toBe(once);
  });

  it("tells both personas not to write it in the first place", () => {
    const route = readFileSync("app/api/consultant/route.ts", "utf8");
    expect(route.match(/do not add the English translation in brackets/g)?.length).toBe(2);
  });
});
