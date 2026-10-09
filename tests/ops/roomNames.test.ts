// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { roomNameAr, VALID_ROOM_SLUG_LIST } from "@/lib/rooms-catalog";

/**
 * One room, one Arabic name.
 *
 * Measured 2026-10-09: the catalog answered «غرف المعيشة والصالات» while the room's own page and
 * the section content said «غرف المعيشة», and eight more rooms were in the same split — «الصالون»
 * against «اللاونج», «غرف المراهقين» against «غرف الشباب», «حمامات الضيوف» against «حمام الضيوف».
 * The customer reads a different name for the same room depending on which page he is on.
 *
 * What stays deliberately separate: the search titles in `lib/seo.ts`. Those are marketing lines
 * («غرف نوم رئيسية فاخرة في مصر»), not the name of the room, and flattening them to a label would
 * cost the store its indexable copy.
 */

describe("the owner of a room's Arabic name", () => {
  it("answers for every room the store has", () => {
    for (const slug of VALID_ROOM_SLUG_LIST) {
      expect(roomNameAr(slug), slug).toBeTruthy();
      expect(roomNameAr(slug)).not.toMatch(/[A-Za-z]/);
    }
  });

  it("keeps the reconciled names, picked once and for all", () => {
    expect(roomNameAr("living-room")).toBe("غرف المعيشة والصالات");
    expect(roomNameAr("lounge")).toBe("الصالون");
    expect(roomNameAr("corner-sofa")).toBe("الكنب الركن");
    expect(roomNameAr("teen-room")).toBe("غرف المراهقين");
    expect(roomNameAr("home-office")).toBe("المكاتب المنزلية");
    expect(roomNameAr("study-room")).toBe("غرف الدراسة");
    expect(roomNameAr("guest-bathroom")).toBe("حمامات الضيوف");
    expect(roomNameAr("entrance-lobby")).toBe("المدخل والريسبشن");
    expect(roomNameAr("interior-design")).toBe("التصميم الداخلي الشامل");
    expect(roomNameAr("full_house")).toBe("المنزل بالكامل");
  });

  it("says nothing about a space this store does not have", () => {
    expect(roomNameAr("landscape")).toBe("");
    expect(roomNameAr(null)).toBe("");
  });
});

describe("the surfaces that name a room", () => {
  const roomPage = readFileSync("app/rooms/[slug]/page.tsx", "utf8");
  const siteContent = readFileSync("lib/site-content.ts", "utf8");
  const requestForm = readFileSync("components/request-page-client.tsx", "utf8");

  it("the room page carries no private copy of a name", () => {
    for (const slug of VALID_ROOM_SLUG_LIST) {
      const own = new RegExp(`id:\\s*"${slug}",\\s*\\n\\s*title:\\s*"`);
      expect(own.test(roomPage), slug).toBe(false);
    }
    expect(roomPage).toContain('title: roomNameAr("living-room")');
  });

  it("the section content carries no private copy either", () => {
    for (const slug of VALID_ROOM_SLUG_LIST) {
      const own = new RegExp(`slug:\\s*"${slug}",\\s*\\n\\s*title:\\s*"`);
      expect(own.test(siteContent), slug).toBe(false);
    }
    expect(siteContent).toContain('title: roomNameAr("master-bedroom")');
  });

  /**
   * The negative half: the products that share a word with a room («lounge», «corner-sofa») are
   * named by themselves, and the catalog must not have swallowed them.
   */
  it("leaves a product's own name to the product list", () => {
    expect(siteContent).toContain('slug: "lounge-chair-pair"');
    expect(siteContent).toMatch(/slug: "sofa-master",\s*\n\s*title: "/);
  });

  it("the request form asks the owner for the spaces that are rooms", () => {
    expect(requestForm).toContain('labelAr: roomNameAr("living-room")');
    expect(requestForm).toContain('labelAr: roomNameAr("full_house")');
    expect(requestForm).toContain('labelAr: "لاندسكيب / حديقة"');
  });
});
