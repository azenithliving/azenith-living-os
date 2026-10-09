// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BRAND_NAME_AR, WORDMARK_AR } from "@/lib/seo";

/**
 * Two decisions the owner made with his own word on 2026-10-09, held so no later edit quietly
 * puts the machine back on his screen:
 *  • the mark on his doors reads «أزينث», not «AZENITH OS»;
 *  • the section preview reads the register the store actually has.
 */

describe("the mark on the owner's screens", () => {
  it("is his spelling, and short", () => {
    expect(WORDMARK_AR).toBe("أزينث");
    expect(WORDMARK_AR).not.toMatch(/[A-Za-z]/);
    expect(BRAND_NAME_AR).toContain("أزينث");
  });

  it("the admin header carries no Latin mark and no machine abbreviation", () => {
    const layout = readFileSync("app/admin/layout-client.tsx", "utf8");
    expect(layout).toContain("{WORDMARK_AR}");
    expect(layout).not.toMatch(/AZENITH/);
    expect(layout).not.toMatch(/>\s*OS\s*</);
  });

  it("the gate says the same word the house says", () => {
    const gate = readFileSync("app/gate/login/page.tsx", "utf8");
    expect(gate).toContain("{WORDMARK_AR}");
    expect(gate).not.toMatch(/AZENITH/);
  });
});

describe("the section preview reads a register that exists", () => {
  const page = readFileSync("app/preview/section/[id]/page.tsx", "utf8");

  /** The columns measured on the live database 2026-10-09: 15 rows in `room_sections`. */
  const REAL_COLUMNS = [
    "id", "name", "slug", "description", "image_url", "is_active", "company_id",
    "display_order", "created_at", "name_ar", "icon", "metadata",
  ];

  it("asks the store's own sections table", () => {
    expect(page).toContain('from("room_sections")');
    // The dead relation may be named in the page's own explanation, but never queried.
    expect(page).not.toMatch(/from\("site_sections"\)/);
  });

  it("names no column the register does not carry", () => {
    const selected = page.match(/\.select\("([^"]+)"\)/)?.[1] ?? "";
    expect(selected.length).toBeGreaterThan(0);
    for (const column of selected.split(",").map((c) => c.trim())) {
      expect(REAL_COLUMNS, column).toContain(column);
    }
  });

  it("is still the light-surface screen that paints the shared cards", () => {
    expect(page).toContain('from "@/components/ui/card"');
    expect(page).toContain("bg-gray-100");
  });

  it("counts in his digits and never prints a bare address inline", () => {
    expect(page).toContain("arabicNumerals(String(row.display_order))");
    expect(page).toMatch(/<ImageRow url=\{row\.image_url\} \/>/);
    expect(page).toContain("صورته:");
  });

  it("says plainly when a section has no picture instead of showing an empty box", () => {
    expect(page).toContain("مفيش صورة مسجّلة للقسم ده");
  });
});
