import { describe, it, expect } from "vitest";
import { isValidRoomSlug, resolveRoomSlug } from "@/lib/rooms-catalog";

describe("rooms-catalog", () => {
  it("accepts canonical slugs", () => {
    expect(isValidRoomSlug("living-room")).toBe(true);
    expect(isValidRoomSlug("kitchen")).toBe(true);
  });

  it("accepts aliases", () => {
    expect(isValidRoomSlug("bedroom")).toBe(true);
    expect(resolveRoomSlug("bedroom")).toBe("master-bedroom");
  });

  it("rejects unknown slugs", () => {
    expect(isValidRoomSlug("invalid-slug-xyz")).toBe(false);
  });
});
