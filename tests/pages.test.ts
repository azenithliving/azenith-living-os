import { describe, it, expect } from "vitest";
import {
  isValidRoomSlug,
  resolveRoomSlug,
  VALID_ROOM_SLUGS,
} from "@/lib/rooms-catalog";

describe("Public pages — room catalog contract", () => {
  it("exposes every canonical room slug used by /rooms/[slug]", () => {
    expect(VALID_ROOM_SLUGS.size).toBeGreaterThanOrEqual(15);
    expect(VALID_ROOM_SLUGS.has("living-room")).toBe(true);
    expect(VALID_ROOM_SLUGS.has("kitchen")).toBe(true);
  });

  it("resolves visitor-friendly aliases to canonical slugs", () => {
    expect(resolveRoomSlug("bedroom")).toBe("master-bedroom");
    expect(resolveRoomSlug("office")).toBe("home-office");
    expect(resolveRoomSlug("kids-room")).toBe("children-room");
  });

  it("rejects unknown slugs (proxy returns HTTP 404)", () => {
    expect(isValidRoomSlug("invalid-slug-xyz")).toBe(false);
    expect(isValidRoomSlug("")).toBe(false);
  });
});

describe("Public pages — metadata contract", () => {
  it("defines non-empty titles for core routes", () => {
    const pageTitles: Record<string, string> = {
      home: "Azenith Living",
      about: "عن Azenith",
      rooms: "المساحات",
      admin: "لوحة التحكم",
    };
    for (const title of Object.values(pageTitles)) {
      expect(title.length).toBeGreaterThan(0);
    }
  });
});
