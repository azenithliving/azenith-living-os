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

/**
 * The capability itself was never a panel: the old page held chat state and a send handler but
 * rendered no composer and no message list, so there was nothing to fix into working. It is built
 * in the new house, and these guards hold what it must never become again.
 */
const drivePath = "components/admin/sales/AdvisorTestDrive.tsx";

describe("the advisor test-drive exists on the owner's desk", () => {
  const drive = readFileSync(drivePath, "utf8");
  const salesPage = readFileSync("app/admin/v2/sales/page.tsx", "utf8");

  it("is mounted under the sales manager", () => {
    expect(salesPage).toContain("<AdvisorTestDrive />");
  });

  it("shows the door's own reply, and never a promise in its place", () => {
    expect(drive).toContain("body?.reply");
    expect(drive).toContain("الباب ما وصلش أصلًا");
    expect(drive).toContain("الباب ردّ من غير كلام");
    expect(drive).not.toContain("تم استلام رسالتك");
  });

  it("keeps his test tellable apart from a visitor's chat, and says what it writes", () => {
    expect(drive).toContain("تجربة-المالك-");
    expect(drive).toContain("بيتسجّل كمحادثة في دفتر العملاء");
  });

  it("speaks only his language and his digits", () => {
    // No machine identifier reaches the screen; the session id is carried, never shown.
    expect(drive).not.toMatch(/\{sessionRef\.current\}/);
    expect(drive).not.toMatch(/>\s*\{[A-Za-z]+\.id\}/);
  });
});
