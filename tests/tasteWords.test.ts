import { describe, expect, it } from "vitest";

import { roomFromWords, styleFromWords, styleKey } from "@/lib/taste-words";

/**
 * The store's own vocabulary, answered in the shapes the picture bank keys on.
 *
 * The bank files its pictures `modern` / `classic` / `scandinavian` / `industrial`, while the
 * customer writes «مودرن» and the qualification page stored «نيوكلاسيك» and even a screen slug
 * («elite-brief»). A ranking may only compare what the same words mean — and must answer null
 * rather than invent a taste.
 */
describe("his style word becomes the bank's key", () => {
  it("reads the four styles the bank really holds", () => {
    expect(styleKey("عايز شغل مودرن")).toBe("modern");
    expect(styleKey("كلاسيك")).toBe("classic");
    expect(styleKey("سكاندينافي")).toBe("scandinavian");
    expect(styleKey("ستايل صناعي")).toBe("industrial");
  });

  it("reads the forms this store's own records really carry", () => {
    expect(styleKey("مودرن (Modern)")).toBe("modern");
    expect(styleKey("نيوكلاسيك")).toBe("classic");
    expect(styleKey("هادئ فاخر")).toBeNull();
  });

  it("refuses a screen slug and an empty line", () => {
    // «elite-brief» is a page name that landed in the style column; it is not a taste.
    expect(styleKey("elite-brief")).toBeNull();
    expect(styleKey("")).toBeNull();
    expect(styleKey(null)).toBeNull();
  });

  it("takes his newest sentence, not the first", () => {
    expect(styleFromWords(["عايز مودرن", "بصراحة الكلاسيك أحلى"])).toBe("classic");
    expect(styleFromWords([])).toBeNull();
  });
});

describe("his room word becomes the bank's room type", () => {
  it("reads the room vocabulary the sheet already uses", () => {
    expect(roomFromWords(["عايز ركنة للصة"])).toBe("corner-sofa");
    expect(roomFromWords(["نوم ماستر", "ومكتب"])).toBe("master-bedroom");
    expect(roomFromWords(["سفرة كبيرة"])).toBe("dining-room");
  });

  it("invents no room when he named none", () => {
    expect(roomFromWords(["بكام التشطيب؟"])).toBeNull();
    expect(roomFromWords(["", ""])).toBeNull();
  });
});
