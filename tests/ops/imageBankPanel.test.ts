// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

/**
 * The picture bank, seated in the new house.
 *
 * The old landing held the harvest panel inside a 600-line overview page and printed the log's
 * machine status (`success` / `failed` / `running`, the column's own constraint values) straight onto
 * the owner's screen beside counts that were not his digits. This screen reads the same guarded door —
 * one owner for the count — and says the rest in his language.
 */
const panelPath = "components/admin/images/ImageBankPanel.tsx";
const pagePath = "app/admin/v2/images/page.tsx";

describe("the image bank in the new house", () => {
  it("is mounted at its own address and in the menu", () => {
    expect(existsSync(pagePath), "app/admin/v2/images/page.tsx is missing").toBe(true);
    expect(readFileSync(pagePath, "utf8")).toContain("<ImageBankPanel />");
    expect(readFileSync("lib/admin-nav.ts", "utf8")).toContain('href: "/admin/v2/images"');
  });

  it("reads the door that already owns the count, and never a second reader", () => {
    const panel = readFileSync(panelPath, "utf8");
    expect(panel).toContain('fetch("/api/admin/images/stats"');
    // The bucket is not a count of pictures: `images` does not exist as a bucket at all (measured).
    expect(panel).not.toMatch(/storage|from\("images"\)/);
  });

  it("keeps machine status words off his screen", () => {
    const panel = readFileSync(panelPath, "utf8");
    expect(panel).toContain('success: "نجح"');
    expect(panel).toContain('failed: "وقف"');
    expect(panel).toContain("حالة ما اتعرفتش");
    // No raw status value is rendered.
    expect(panel).not.toMatch(/\{r\.status\}/);
  });

  it("counts in his digits and names rooms with the store's own namer", () => {
    const panel = readFileSync(panelPath, "utf8");
    expect(panel).toContain("arNum(");
    expect(panel).toContain("roomLabel(");
    expect(panel).toContain('from "@/lib/cad/room-names"');
  });

  it("says so when the door refused, instead of showing a zero bank", () => {
    const panel = readFileSync(panelPath, "utf8");
    expect(panel).toContain("من غير ما يوصّل سبب بالعربي");
    expect(panel).toContain("باب إحصاء الصور ما وصلش أصلًا");
  });
});
