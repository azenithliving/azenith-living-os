// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * A control a screen reader cannot name is a control that does not exist for that customer.
 *
 * Measured 2026-10-11 — the first accessibility audit ever run on the published site: the same
 * critical rule (`button-name`) was failing on all six screens audited, nine places in total, and the
 * customer's own notebook had a file input with no label. These guards pin the named controls so the
 * next refactor cannot quietly drop the name again; the live audit script re-measures the rest.
 */

const bubble = readFileSync("components/AvatarButton.tsx", "utf8");
const footer = readFileSync("components/Footer.tsx", "utf8");
const sheet = readFileSync("components/cad/OwnSheetCard.tsx", "utf8");
const layout = readFileSync("app/admin/layout-client.tsx", "utf8");
const goals = readFileSync("components/admin/ops/QayyimGoalsPanel.tsx", "utf8");
const studio = readFileSync("components/admin/ops/StudioPanel.tsx", "utf8");
const systemScreen = readFileSync("app/admin/database/page.tsx", "utf8");
const opsPage = readFileSync("app/admin/v2/ops/page.tsx", "utf8");
const stylePicker = readFileSync("components/AIStylePicker.tsx", "utf8");

describe("the advisor bubble", () => {
  it("is a landmark with an Arabic name of its own", () => {
    expect(bubble).toContain("<aside");
    expect(bubble).toMatch(/aria-label=\{isRTL \? "مستشار الدار"/);
  });

  it("names its button and says whether the assistant is open", () => {
    expect(bubble).toMatch(/aria-label=\{isRTL \? "افتح مستشار الدار"/);
    expect(bubble).toContain("aria-expanded={isOpen}");
  });
});

describe("the customer's own sheet card", () => {
  it("names both controls, not just their placeholders", () => {
    expect(sheet).toMatch(/aria-label=\{isRTL \? "ارفع صورة ورقة مقاساتك"[\s\S]{0,120}data-own-sheet-file=""/);
    expect(sheet).toMatch(/placeholder=\{isRTL \? "رقم موبايلك"[\s\S]{0,80}aria-label=\{isRTL \? "رقم موبايلك"/);
  });
});

describe("the owner's screens", () => {
  it("names the two mobile menu controls", () => {
    expect(layout).toContain('aria-label="افتح قائمة الأقسام"');
    expect(layout).toContain('aria-label="اقفل قائمة الأقسام"');
  });

  it("names the icon-only refresh in the goals panel", () => {
    expect(goals).toContain('aria-label="اجيب الأهداف من جديد"');
  });

  it("gives the studio page a level-one heading", () => {
    expect(opsPage).toContain("<h1");
  });
});

describe("the text that carries information is readable", () => {
  it("does not paint the footer's facts in the dimmest tone", () => {
    expect(footer).not.toContain("text-gray-600");
    expect(footer).not.toContain("text-gray-500");
  });

  it("does not leave the unselected style chip below the readable bar", () => {
    expect(stylePicker).toContain('"text-white/70 hover:text-white"');
    expect(stylePicker).not.toContain("text-white/40 hover:text-white/70");
  });

  it("keeps the owner's own readings above the dim threshold", () => {
    expect(studio).not.toContain("text-[11px] text-white/50");
    expect(systemScreen).not.toContain("text-white/45");
  });
});
