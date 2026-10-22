// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The advisor test-drive must show the advisor's real answer.
 *
 * Measured 2026-10-23 in code: the panel read `data.response` while the door answers `reply`, so every
 * message the owner typed came back with the same promise — «تم استلام رسالتك وسأقوم بتحليلها» — and
 * nothing he saw was an answer. It also sent an `isAdmin` flag the door never reads, and its heading
 * carried a Latin version tag beside a claim that instant deletion was active.
 */
const pagePath = "app/admin/sales/page.tsx";

describe("the advisor test-drive tells the truth", () => {
  const page = readFileSync(pagePath, "utf8");

  it("reads the field the door actually answers with", () => {
    expect(page).toContain("data.reply");
    expect(page).not.toContain("data.response");
    expect(page).not.toContain("تم استلام رسالتك وسأقوم بتحليلها");
  });

  it("says out loud when the door did not answer", () => {
    expect(page).toContain("الباب ما رجّعش ردّ");
    expect(page).toContain("الباب ما وصلش أصلًا");
  });

  it("does not pretend a body flag makes it the owner", () => {
    expect(page).not.toMatch(/isAdmin:\s*true/);
  });

  it("carries no Latin version tag and no deletion claim in its heading", () => {
    expect(page).not.toContain("ADMIN CONTROL");
    expect(page).not.toContain("تم تفعيل الحذف الفوري");
  });
});
