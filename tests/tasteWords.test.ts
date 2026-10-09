import { describe, expect, it } from "vitest";

import { roomFromWords, storedTaste, styleFromWords, styleKey, tallyTastes } from "@/lib/taste-words";

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

  it("recognises the shape the store itself writes", () => {
    // The capture stores the bank's key. A reader that only knew Arabic words would call its own
    // handwriting no taste — measured live: the visitor row said `modern` and the sheet named no style.
    expect(styleKey("modern")).toBe("modern");
    expect(styleKey("scandinavian")).toBe("scandinavian");
    expect(styleKey("industrial")).toBe("industrial");
    expect(styleKey("classic")).toBe("classic");
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

describe("what the taste column is allowed to hold", () => {
  it("refuses the page's own name — the live defect, 14 of 27 rows", () => {
    expect(storedTaste("elite-brief", "/elite-brief")).toBeNull();
    expect(storedTaste("elite-intelligence", "/elite-intelligence")).toBeNull();
    // Any path shape is a screen, whatever the caller claims about it.
    expect(storedTaste("/request", "/elite-brief")).toBeNull();
  });

  it("refuses the words this store writes when a field was left blank", () => {
    expect(storedTaste("غير محدد", "/request")).toBeNull();
    expect(storedTaste("أخرى", "/request")).toBeNull();
    expect(storedTaste("", "/request")).toBeNull();
    expect(storedTaste("   ", "/request")).toBeNull();
  });

  it("keeps his own words even when no picture matches them", () => {
    // Measured 2026-10-09: two rows read «هادئ فاخر». The sheet already says out loud when it
    // cannot read a taste — the writer has no business deleting the sentence he typed.
    expect(storedTaste("هادئ فاخر", "/request")).toBe("هادئ فاخر");
    expect(storedTaste("مودرن (Modern)", "/request")).toBe("مودرن (Modern)");
    expect(storedTaste("modern", "/elite-brief")).toBe("modern");
  });

  it("refuses an identifier shape from any screen, not only the one it names", async () => {
    // The elite route files both briefs under one address, so a comparison with the page that
    // asked would let a second form's slug through. The shape catches what the name cannot.
    expect(storedTaste("elite-brief", "/request")).toBeNull();
    expect(storedTaste("elite_intelligence", "/request")).toBeNull();
    // A taste the reader knows survives even in a hyphenated shape; his words survive as written.
    expect(storedTaste("mid-century modern", "/request")).toBe("mid-century modern");
    expect(storedTaste("مودرن", "/request")).toBe("مودرن");
  });
});

describe("the taste tally a chart is allowed to show", () => {
  // The exact values measured in the live register on 2026-10-09 (30 visitor rows). Counted verbatim
  // the chart made eight "styles" out of them and put a screen name first.
  const LIVE = [
    ...Array(14).fill({ style: "elite-brief" }),
    ...Array(4).fill({ style: null }),
    { style: "نيوكلاسيك" }, { style: "نيوكلاسيك" }, { style: "نيوكلاسيك" },
    { style: "كلاسيك" },
    { style: "مودرن" }, { style: "مودرن" }, { style: "مودرن" },
    { style: "مودرن (Modern)" }, { style: "مودرن (Modern)" }, { style: "modern" },
    { style: "هادئ فاخر" }, { style: "هادئ فاخر" },
  ];

  it("merges one taste written three ways and refuses a screen name", () => {
    const { groups, skipped } = tallyTastes(LIVE);
    expect(groups).toEqual([
      { style: "مودرن", count: 6 },
      { style: "كلاسيك", count: 4 },
      { style: "ذوقه بكلماته", count: 2 },
    ]);
    expect(skipped).toBe(18);
  });

  it("says how many rows it left out, so a small chart is not read as an empty store", () => {
    const { groups, skipped } = tallyTastes([{ style: "مودرن" }]);
    expect(groups).toEqual([{ style: "مودرن", count: 1 }]);
    expect(skipped).toBe(0);
    expect(tallyTastes([]).groups).toEqual([]);
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
