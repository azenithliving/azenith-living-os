// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { chatPlaceLabel } from "@/lib/ops/draft-labels";

/**
 * A site address in his chat is said in his words.
 *
 * The chat turns any path it finds into a link and prints the path itself as the label, so his
 * leader's thread reads «…/products/sofa-malaki-1790214163150…» — counted 2026-10-12 across his
 * stored rows: `/products/…` 172 times, `/rooms` 88, `/furniture` 81, plus the elite pages and the
 * draft-preview door. A web address is allowed on his screens, but as its own element with an Arabic
 * label — not as the words of an Arabic sentence.
 *
 * The labels are the ones the store already uses for those places (the drafts desk names them, the
 * room vocabulary names them); this only asks them from the chat.
 */
const latin = (s: string) => s.match(/[A-Za-z]{2,}/g) ?? [];

describe("a path in his chat is named where it leads", () => {
  it("names a product page, a room page and a section", () => {
    expect(chatPlaceLabel("/products/sofa-malaki-1790214163150")).toBe("صفحة منتج");
    expect(chatPlaceLabel("/rooms")).toBe("صفحة الغرف");
    expect(chatPlaceLabel("/furniture")).toBe("صفحة الأثاث");
    expect(chatPlaceLabel("/rooms/living-room")).toBe("الصالة والمعيشة");
    expect(chatPlaceLabel("/rooms/kitchen")).toBe("المطبخ");
  });

  it("names the pages the storefront actually links to", () => {
    expect(chatPlaceLabel("/request")).toBe("اطلب عرض");
    expect(chatPlaceLabel("/elite-brief")).toBe("ملخص النخبة");
    expect(chatPlaceLabel("/elite-intelligence")).toBe("مسار النخبة");
    expect(chatPlaceLabel("/contact")).toBe("التواصل");
    expect(chatPlaceLabel("/kitchens#sofas")).toBe("قسم الكنب");
  });

  it("names the draft preview door instead of printing it", () => {
    expect(chatPlaceLabel("/api/admin/ops/preview/draft_1791332500628")).toBe("معاينة المسودة");
  });

  it("says a place it does not know as unnamed, and never prints the address as a name", () => {
    const label = chatPlaceLabel("/some/odd/path");
    expect(latin(label), label).toEqual([]);
    expect(label).toBe("مكان من غير اسم");
  });

  it("keeps working on a bare slash and on nothing", () => {
    expect(chatPlaceLabel("/")).toBe("الصفحة الرئيسية");
    expect(chatPlaceLabel("")).toBe("مكان من غير اسم");
    expect(chatPlaceLabel(null)).toBe("مكان من غير اسم");
  });
});

describe("the chat draws the label and keeps the address behind the press", () => {
  const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");

  it("labels a path link in Arabic and leaves a full web address alone", () => {
    expect(panel).toContain("chatPlaceLabel(part)");
    // A full address is allowed as its own element; a path is not an address he reads.
    expect(panel).toMatch(/https?:\/\//);
  });
});

describe("the publishing tool speaks his words", () => {
  const tool = readFileSync("lib/agent-tools/tool-registry.ts", "utf8");
  const runner = readFileSync("lib/admin-cloud-evolution.ts", "utf8");

  it("names the publish action without the platform's Latin letters", () => {
    expect(tool).toContain('displayName: "نشر الموقع"');
    expect(runner).toContain("تم طلب النشر");
    expect(runner).not.toContain("راقب لوحة Vercel");
  });
});
