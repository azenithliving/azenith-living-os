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

  /**
   * The back control's only content was the character «→». A glyph with no word on it is what the
   * owner's line-shape rule bans, and an instrument counting arrows on his screens can never reach
   * zero while the shop's own chrome draws one.
   */
  it("draws the way back as an icon with a name, not as a bare arrow", () => {
    const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");
    expect(panel).not.toContain(">→</Link>");
    expect(panel).toMatch(/aria-label="رجوع لمركز القيادة"/);
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

/**
 * Round three, measured the same day: the owner's own screens.
 *
 * Forty-four places on twelve audited surfaces, and the census (scratch/census-a11y-residue.mjs) showed
 * three kinds: faint text, icon-only controls, and pages with nothing to navigate by. One was worse than
 * inaccessible — a task title painted white on a white card, 1.04:1, invisible to everyone. The faint
 * guard runs over whole files rather than only the lines the tool happened to render today, because a
 * sentence behind a tab or a loading state is not a sentence that is safe.
 */
const ownerScreens = [
  "components/admin/v2/CommandCanvas.tsx",
  "components/admin/agents/ChatPanel.tsx",
  "components/admin/agents/AgentActionsFeed.tsx",
  "components/admin/agents/AgentHealthPanel.tsx",
  "components/admin/sales/CustomersPanel.tsx",
  "components/admin/ClientPreCallDossier.tsx",
  "app/admin/v2/sketches/page.tsx",
  "components/admin/sketches/SketchOwner.tsx",
  "app/admin/v2/keys/page.tsx",
  "components/elite/login/elite-login-client.tsx",
  // Added 2026-10-12 by the thirty-screen sweep: these four panels were never in the guard, which is
  // exactly why they still carried text between twenty and sixty percent white on gradient cards.
  "components/admin/ops/StudioPanel.tsx",
  "components/admin/agents/SelfModelPanel.tsx",
  "components/admin/agents/ApprovalDecisionBlock.tsx",
  "components/admin/agents/CommandPalette.tsx",
  // The one section header five cockpit screens share. Its two faint lines measured 4.48 against the
  // 4.5 floor — a hair under, and under is under.
  "components/admin/v2/SectionIntake.tsx",
  // The shelf desk the owner types a ready piece into, and the page a visitor reads it on.
  "components/admin/shop/ShopDesk.tsx",
  "app/shop/page.tsx",
  // The settings office in the new house, with the two cards that were already standing in it.
  "app/admin/v2/settings/page.tsx",
  "components/admin/settings/SettingsFactsDesk.tsx",
  "components/admin/settings/AdsSettingsCard.tsx",
  "components/admin/settings/ConsultantFaqCard.tsx",
];

const FAINT = /(?<![\w-])text-white\/(?:20|25|30|35|40|45|50|55|60)\b/g;

describe("the owner's screens read on a phone", () => {
  it.each(ownerScreens)("%s carries no text fainter than seventy percent white", (file) => {
    expect(readFileSync(file, "utf8").match(FAINT) ?? []).toEqual([]);
  });

  it("names the chat's send arrow, the customer's delete, and both refresh glyphs", () => {
    expect(readFileSync("components/admin/agents/ChatPanel.tsx", "utf8")).toContain(
      'aria-label={isTyping ? "الموظف بيكتب دلوقتي" : "إرسال الرسالة"}',
    );
    expect(readFileSync("components/admin/sales/CustomersPanel.tsx", "utf8")).toContain('aria-label="حذف هذا العميل من الدفتر"');
    expect(readFileSync("components/admin/agents/AgentActionsFeed.tsx", "utf8")).toContain('aria-label="تحديث سجل الأحداث"');
    expect(readFileSync("components/admin/agents/AgentHealthPanel.tsx", "utf8")).toContain('aria-label="إعادة فحص صحة النظام"');
  });

  it("names the paper desk's camera button and the command console's employee picker", () => {
    expect(readFileSync("app/admin/v2/sketches/page.tsx", "utf8")).toContain('aria-label="اختار صورة ورقة من الموبايل"');
    expect(readFileSync("components/admin/agents/CommandConsole.tsx", "utf8")).toContain('aria-label="الموظف اللي بياخد الأمر"');
  });

  it("opens the sales office with a heading, and never paints a task title white on white", () => {
    expect(readFileSync("app/admin/v2/sales/page.tsx", "utf8")).toContain('<h1 className="font-black text-sm text-white">مدير المبيعات</h1>');
    expect(readFileSync("components/admin/agents/TaskQueue.tsx", "utf8")).toContain(
      '<p className="font-medium text-gray-900">{ownerVoice(task.title)}</p>',
    );
  });

  it("steps the elite board in order: no third-level step title under the page's one top-level heading", () => {
    const form = readFileSync("components/elite/EliteIntelligenceForm.tsx", "utf8");
    expect(form).not.toMatch(/<h3 className="text-(?:xl|lg) font-semibold text-white">\{L\.(?:scope|budget|timeline|blueprint|style|requests|contact)Title\}<\/h3>/);
    expect(form).toContain('<h2 className="text-xl font-semibold text-white">{L.scopeTitle}</h2>');
  });

  it("keeps the old employees' house from printing an employee's machine key as his name", () => {
    expect(readFileSync("components/admin/agents/CommandConsole.tsx", "utf8")).toContain('<option value="vanguard">مدير المبيعات</option>');
  });

  it("puts the unread count on a red his phone can read", () => {
    // Measured on the published cockpit 2026-10-12: white on rose-500 is 3.75 to 1 at nine pixels —
    // under the floor for text this small. rose-700 is the same red at about 6.3 to 1.
    const chat = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");
    expect(chat).toContain("min-w-[16px] h-4 px-1 rounded-full bg-rose-700 text-white text-[9px] font-bold");
    expect(chat).not.toContain("min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white");
  });
});
