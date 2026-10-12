import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { bracketListItems, isBulletLine, splitEmphasis, splitInline, stripBullet } from "@/lib/talk/emphasis";

/** Read off the owner's own sales screen 2026-10-03, word for word. */
const LIVE =
  "**حالة الأداة:** مهيأة وتعمل بنجاح (Configured). **النتائج:** لا توجد بيانات حاليًا (**rows 0**).";

describe("the owner's screen draws emphasis instead of printing its markers", () => {
  it("finds the two things the employee chose to stress", () => {
    const chunks = splitEmphasis(LIVE);
    const bold = chunks.filter((c) => c.kind === "bold").map((c) => c.value);
    expect(bold).toEqual(["حالة الأداة:", "النتائج:", "rows 0"]);
    expect(chunks.some((c) => c.value.includes("**"))).toBe(false);
  });

  it("keeps the sentence around the markers exactly as it was", () => {
    const text = splitEmphasis(LIVE)
      .filter((c) => c.kind === "text")
      .map((c) => c.value)
      .join("");
    expect(text).toContain("مهيأة وتعمل بنجاح (Configured).");
    expect(text).toContain("لا توجد بيانات حاليًا (");
    expect(text).toContain(").");
  });

  it("leaves a plain line alone", () => {
    const plain = "ورقة واحدة مقفولة بصوتين من العائلة.";
    expect(splitEmphasis(plain)).toEqual([{ kind: "text", value: plain }]);
  });

  it("does not eat a multiplication sign or an unpaired marker", () => {
    const maths = "٣ * ٤ = ١٢ والمساحة ٥ * ٤";
    expect(splitEmphasis(maths)).toEqual([{ kind: "text", value: maths }]);
    expect(splitEmphasis("كتب * واحد بس")).toEqual([{ kind: "text", value: "كتب * واحد بس" }]);
  });

  it("reads the thin markers as emphasis and the double ones as bold", () => {
    expect(splitEmphasis("ده *مؤقت* مش دايم")).toEqual([
      { kind: "text", value: "ده " },
      { kind: "em", value: "مؤقت" },
      { kind: "text", value: " مش دايم" },
    ]);
    expect(splitEmphasis("__عاجل__")).toEqual([{ kind: "bold", value: "عاجل" }]);
  });

  it("says nothing for nothing", () => {
    expect(splitEmphasis("")).toEqual([]);
  });

  it("draws a tool name as code, not as backticks", () => {
    // Read off the same screen: «…من أداة `lead_list` (إحدى أدواتنا الـ 25 المعتمدة)…».
    const chunks = splitEmphasis("البيانات المستخرجة من أداة `lead_list` (إحدى أدواتنا).");
    expect(chunks).toContainEqual({ kind: "code", value: "lead_list" });
    expect(chunks.some((c) => c.value.includes("`"))).toBe(false);
  });
});

describe("the chat surface actually uses it", () => {
  const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");

  it("imports the splitter and marks what it drew", () => {
    expect(panel).toContain('from \'@/lib/talk/emphasis\'');
    // The panel calls `splitInline`, which is `splitEmphasis` plus the equation pass — the markers are
    // still read first, and the address split still happens inside the plain-text chunks.
    expect(panel).toContain("splitInline(text)");
    expect(panel).toContain('data-emphasis="bold"');
    expect(panel).toContain('data-emphasis="em"');
    expect(panel).toContain('data-emphasis="code"');
  });

  it("reads the markers before it cuts the line on a bare address", () => {
    // The defect this guard exists for: the chat used to split prose on every URL first, so half a
    // markdown link reached the splitter («[اسم](») and his screen printed its brackets. Measured on
    // his leader's chat 2026-10-12, and no test of the splitter alone could see it.
    const inline = panel.slice(panel.indexOf("const renderInline"));
    expect(inline.indexOf("splitInline(text)")).toBeLessThan(inline.indexOf("split(INLINE_LINK)"));
  });

  it("draws a link with the same inline pass inside a table cell", () => {
    // The employee's load report IS a table, and the cell renderer used to drop the text straight in:
    // «| **زمن الاستجابة** | **145ms** |» reached him with its asterisks still on it.
    expect(panel).toContain("{renderInline(c.trim())}");
    expect(panel).toContain('data-emphasis="link"');
  });
});

describe("a link is drawn, not printed", () => {
  const LABELLED = "[راجع المنتجات غير الظاهرة](https://azenith-living.vercel.app/admin/products?status=hidden)";

  it("splits a labelled address into its Arabic name and its address", () => {
    const chunks = splitEmphasis(`من هنا ${LABELLED}`);
    const link = chunks.find((c) => c.kind === "link");
    expect(link?.value).toBe("راجع المنتجات غير الظاهرة");
    expect(link?.href).toBe("https://azenith-living.vercel.app/admin/products?status=hidden");
    expect(chunks[0]).toEqual({ kind: "text", value: "من هنا " });
  });

  it("keeps no bracket mark in either half", () => {
    const joined = splitEmphasis(LABELLED)
      .map((c) => c.value)
      .join("");
    expect(joined).not.toContain("[");
    expect(joined).not.toContain("]");
  });

  it("does not make a control out of an address the model never gave", () => {
    // Read off his cockpit: «[(رابط غير موثق)]()» — a link with nothing behind it. A press that goes
    // nowhere is a dead control, so it is said as words instead.
    const chunks = splitEmphasis("[(رابط غير موثق)]()");
    expect(chunks).toEqual([{ kind: "text", value: "رابط غير موثق" }]);
  });

  it("does not let one bracketed word swallow the brackets beside it", () => {
    // Read off his leader's chat 2026-10-12: three suggested actions written in brackets, the last
    // one with empty parentheses after it. A label allowed to contain `]` matched all three as one
    // link and printed their brackets anyway.
    const chunks = splitEmphasis("اختار: [تحسين المحتوى] [تحسين السرعة] [تقرير ]()");
    expect(chunks.map((c) => c.value).join("")).toBe("اختار: [تحسين المحتوى] [تحسين السرعة] تقرير");
    expect(chunks.some((c) => c.kind === "link")).toBe(false);
  });

  it("leaves brackets that are not a link exactly where they are", () => {
    expect(splitEmphasis("مهيأة وتعمل بنجاح (Configured).")).toEqual([
      { kind: "text", value: "مهيأة وتعمل بنجاح (Configured)." },
    ]);
  });
});

describe("a line that is a list item", () => {
  it("recognises the star the employee actually writes with", () => {
    expect(isBulletLine("* حالة الأداة: مهيأة")).toBe(true);
    expect(isBulletLine("- عميل مستني رد")).toBe(true);
    expect(isBulletLine("+ ورقة مقفولة")).toBe(true);
    expect(isBulletLine("• صوتان")).toBe(true);
    expect(stripBullet("* حالة الأداة: مهيأة")).toBe("حالة الأداة: مهيأة");
  });

  it("does not mistake bold for a bullet, and needs something after the mark", () => {
    expect(isBulletLine("**حالة الأداة:** مهيأة")).toBe(false);
    expect(isBulletLine("٣ * ٤ = ١٢")).toBe(false);
    expect(isBulletLine("* ")).toBe(false);
  });
});

describe("the chat surface uses the bullet rule", () => {
  const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");
  it("draws a star line as a dot, not as punctuation", () => {
    expect(panel).toContain("isBulletLine(line)");
    expect(panel).toContain("stripBullet(line)");
  });
});

/**
 * Counted on his own stored rows 2026-10-12: 223 equation runs across 103 lines («٢× = ٥٤٠٠٠٠ ج.م»,
 * «٥١/١٠٠», «p95 = ٢٣٧ مللي ثانية») and 13 lines that are a list written as brackets
 * («[افتح التقرير] [راجع السجل] [طبّق التحسينات]»). Neither is a word with a synonym: the first is a
 * number order the right-to-left line reverses, the second is a list printed as its own markup.
 */
describe("an equation keeps the order it was written in", () => {
  it("takes the bestseller line the shop's own report writes", () => {
    const chunks = splitInline("الأكثر مبيعًا: صالون (كنبة ٣ مقاعد + ٢ فوتيه + بوف) (٢× = ٥٤٠٠٠٠ ج.م)");
    const math = chunks.filter((c) => c.kind === "math").map((c) => c.value);
    expect(math).toEqual(["٢× = ٥٤٠٠٠٠"]);
    // The Arabic around it is untouched, and the words between two numbers never join the run.
    expect(chunks.map((c) => c.value).join("")).toBe("الأكثر مبيعًا: صالون (كنبة ٣ مقاعد + ٢ فوتيه + بوف) (٢× = ٥٤٠٠٠٠ ج.م)");
  });

  it("takes the metric with its own letters, and the ratio with its slash", () => {
    const chunks = splitInline("درجة الفخامة مقاسة: ٥١/١٠٠ — p95 = ٢٣٧ مللي ثانية");
    expect(chunks.filter((c) => c.kind === "math").map((c) => c.value)).toEqual(["٥١/١٠٠", "p95 = ٢٣٧"]);
  });

  it("does not mistake a date or a phone for a sum", () => {
    // A date is already read left to right and a phone has no operator: wrapping them would move
    // nothing and claim a rule that was never measured.
    expect(splitInline("نافذة من ٢٠٢٦-٠٦-٢٨ إلى ٢٠٢٦-٠٩-٢٦").filter((c) => c.kind === "math")).toEqual([]);
    expect(splitInline("موبايل ٠١٠٠٢٣٤٥٦٧٨ متاح").filter((c) => c.kind === "math")).toEqual([]);
  });

  it("leaves a plain Arabic sentence exactly as it was", () => {
    const line = "المحتوى راجع والوكلاء شغالين.";
    expect(splitInline(line)).toEqual([{ kind: "text", value: line }]);
  });

  it("keeps emphasis and links that splitInline did not touch", () => {
    const chunks = splitInline("**حالة الجدول:** ناجح — ٣× = ١٢");
    expect(chunks[0]).toEqual({ kind: "bold", value: "حالة الجدول:" });
    expect(chunks.some((c) => c.kind === "math" && c.value === "٣× = ١٢")).toBe(true);
  });
});

describe("a list written in brackets is drawn as a list", () => {
  it("reads the three suggestions the leader actually sends", () => {
    expect(bracketListItems("[افتح التقرير] [راجع السجل] [طبّق التحسينات]")).toEqual([
      "افتح التقرير",
      "راجع السجل",
      "طبّق التحسينات",
    ]);
  });

  it("needs two of them, and a line that is nothing else", () => {
    expect(bracketListItems("[تقرير]")).toBeNull();
    expect(bracketListItems("راجع [تقرير] ثم قارن [سجل] قبل النشر وبعده")).toBeNull();
    expect(bracketListItems("")).toBeNull();
  });

  it("does not eat a markdown link or a table row", () => {
    expect(bracketListItems("[راجع المنتجات](https://azenith-living.vercel.app/admin/products)")).toBeNull();
    expect(bracketListItems("| القسم | الحالة |")).toBeNull();
  });
});

describe("the chat surface draws both", () => {
  const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");

  it("puts the equation in its own direction and the list through the bullet rule", () => {
    expect(panel).toContain('data-inline="math"');
    expect(panel).toContain("bracketListItems(line)");
    // `dir="ltr"` was measured NOT to be enough: the isolated run still laid its Arabic-Indic digits
    // out right-to-left. Of the seven ways tried on this browser, only `isolate-override` put the
    // first character on the left (scratch/which-css-orders-math.mjs).
    expect(panel).toContain('unicodeBidi: "isolate-override"');
  });

  it("draws the equation on the cockpit card too, where the row is printed as one line", () => {
    // The census found the bestseller sum five times on the cockpit screen — not in the chat, but in
    // the cards' teaser line, which used to print the stored row raw.
    const canvas = readFileSync("components/admin/v2/CommandCanvas.tsx", "utf8");
    expect(canvas).toContain("splitInline(teaser)");
    expect(canvas).toContain('data-inline="math"');
    expect(canvas).toContain('unicodeBidi: "isolate-override"');
  });
});
