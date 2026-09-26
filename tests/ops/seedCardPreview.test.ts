// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { previewLine } from "@/app/admin/v2/agents/page";

/**
 * The one line under the manager's name on the seed card.
 *
 * It used to flatten whatever the agent said — including markdown tables — which
 * is how a phone screen ended up showing «فحصت 0 غرفة و1 منتج. | المشكلة | الرابط
 * | ماذا أفعل؟ | | —»: a months-old message, in table pipes, presented as news.
 */

describe("previewLine", () => {
  it("drops table rows instead of flattening them", () => {
    const out = previewLine(
      "فحصت 15 غرفة ومنتج واحد.\n\n| المشكلة | الرابط | ماذا أفعل؟ |\n| --- | --- | --- |\n| منتج بلا صورة | /x | أضف صورة |",
    );
    expect(out).toBe("فحصت 15 غرفة ومنتج واحد.");
  });

  it("returns nothing when the reply was only a table", () => {
    expect(previewLine("| أ | ب |\n| --- | --- |\n| 1 | 2 |")).toBe("");
  });

  it("strips markdown decoration and caps the length", () => {
    const out = previewLine(`**${"كلمة ".repeat(60)}**`);
    expect(out).not.toContain("*");
    expect(out.length).toBeLessThanOrEqual(130);
    expect(out.endsWith("…")).toBe(true);
  });

  it("keeps a short plain sentence intact", () => {
    expect(previewLine("مفيش شذوذ في حركة الزوار")).toBe("مفيش شذوذ في حركة الزوار");
  });
});
