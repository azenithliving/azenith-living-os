import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { isBulletLine, splitEmphasis, stripBullet } from "@/lib/talk/emphasis";

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
    expect(panel).toContain("splitEmphasis(text)");
    expect(panel).toContain('data-emphasis="bold"');
    expect(panel).toContain('data-emphasis="em"');
    expect(panel).toContain('data-emphasis="code"');
  });

  it("reads the markers before it cuts the line on a bare address", () => {
    // The defect this guard exists for: the chat used to split prose on every URL first, so half a
    // markdown link reached the splitter («[اسم](») and his screen printed its brackets. Measured on
    // his leader's chat 2026-10-12, and no test of the splitter alone could see it.
    const inline = panel.slice(panel.indexOf("const renderInline"));
    expect(inline.indexOf("splitEmphasis(text)")).toBeLessThan(inline.indexOf("split(INLINE_LINK)"));
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
