import { describe, expect, it } from "vitest";
import { parseRememberInstruction } from "@/lib/admin-owner-memory";

describe("admin owner memory", () => {
  it("parses Arabic remember instructions", () => {
    const r = parseRememberInstruction("تذكّر إن اللون المفضل: ذهبي");
    expect(r?.key).toBeTruthy();
    expect(r?.value).toContain("ذهبي");
  });

  it("parses English remember", () => {
    const r = parseRememberInstruction("remember that I prefer short replies");
    expect(r?.value).toMatch(/short/i);
  });
});
