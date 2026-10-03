import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

/**
 * Where the drawing actually reaches a person.
 *
 * The geometry and the storage have their own tests; this one is about the two surfaces the owner
 * reads — his customer's sheet and his own pre-call file — and the rule that a sheet which cannot
 * draw must say why instead of showing an empty frame.
 */
const page = readFileSync("app/passport/[token]/page.tsx", "utf8");
const sheet = readFileSync("components/cad/RoomPlan.tsx", "utf8");
const dossier = readFileSync("components/admin/ClientPreCallDossier.tsx", "utf8");
const dossierLib = readFileSync("lib/cad/dossier.ts", "utf8");
const door = readFileSync("app/api/admin/customers/dossier/route.ts", "utf8");

describe("the customer's sheet carries the room", () => {
  it("mounts the drawing between what the store read and what he confirms", () => {
    expect(page).toContain("import RoomPlan from '@/components/cad/RoomPlan'");
    expect(page).toContain("data-plan-block");
    expect(page).toContain("<RoomPlan");
  });

  it("sends a chosen shape and a dragged door to the store instead of keeping them on the phone", () => {
    expect(page).toContain("`/api/passport/${token}/plan`");
    expect(page).toContain("sendPlan({ shape })");
    expect(page).toContain("sendPlan({ openings })");
  });

  it("shows the drawing's answer, not a local guess, after the store replies", () => {
    expect(page).toMatch(/setSheet\(\(prev\) => \(prev \? \{ \.\.\.prev, plan: data\.plan \} : prev\)\)/);
  });
});

describe("the drawing itself", () => {
  it("keeps the database and the server's readers out of the bundle a phone runs", () => {
    // The sheet is a client component: one import of `supabase-admin` in this graph and the whole
    // page answers 500 in the browser (measured 2026-10-01).
    for (const source of [sheet, readFileSync("lib/cad/plan.ts", "utf8"), readFileSync("lib/cad/plan-view.ts", "utf8")]) {
      expect(source).not.toMatch(/supabase|node:fs|process\.env|fetch\(/);
    }
  });

  it("draws an agreed wall solid and a proposed one dashed, and says which is which", () => {
    expect(sheet).toContain("strokeDasharray={wall.confirmed ? undefined");
    expect(sheet).toContain("data-plan-wall-confirmed={wall.confirmed ? '1' : '0'}");
    expect(sheet).toContain("data-plan-legend");
    expect(sheet).toContain("المتقطع: مقترح لسه ما اتأكدش");
  });

  it("writes every measure on the sheet in his digits", () => {
    expect(sheet).toContain("{arNum(wall.meters)}");
    expect(sheet).toContain("arNum(plan.walls.length)");
  });

  it("never shows a machine key as a word a customer reads", () => {
    // The shape name on the sheet comes from the label table, and the label table is Arabic.
    expect(sheet).toContain("{SHAPE_LABELS[plan.shape]}");
    expect(sheet).toContain("{SHAPE_LABELS[shape]}");
    expect(readFileSync("lib/cad/plan.ts", "utf8")).toMatch(/rectangle: "مستطيل"/);
  });

  it("lets a thumb and a keyboard place an opening, and stops the page scrolling under the finger", () => {
    expect(sheet).toContain("onPointerDown={startDrag(i)}");
    expect(sheet).toContain("onPointerUp={endDrag(i)}");
    expect(sheet).toContain("onKeyDown={nudge(i)}");
    expect(sheet).toContain("touch-none");
    expect(sheet).toContain("role={interactive ? 'slider' : undefined}");
    // A grab keeps the point the finger landed on, or the door jumps half its width.
    expect(sheet).toContain("grabRef.current = Math.max(0, under - opening.offsetMeters)");
    expect(sheet).toContain("projectPointerOnWall(wall, metres, null).offsetMeters - grabRef.current");
    // The band a thumb can hit is wider than the door it draws.
    expect(sheet).toContain("data-plan-handle={i}");
  });

  it("says where the walls the paper never wrote came from", () => {
    // Measured: every real paper carries two numbers, and the drawing has four walls. The sheet
    // states the pairing instead of letting the implied walls look measured one by one.
    expect(sheet).toContain("data-plan-implied");
    expect(sheet).toContain("الضلع ومقابلته بنفس القياس");
    expect(sheet).toContain("{arNum(plan.sidesOnPaper ?? 0)}");
  });

  it("asks the one question standing between the paper and a room, and offers only shapes it can walk", () => {
    expect(sheet).toContain("data-plan-missing");
    expect(sheet).toContain("data-plan-shape={shape}");
    expect(sheet).toContain("data-plan-question");
    // A paper with no numbers cannot be drawn whatever shape is picked, so the sheet must not
    // offer a chooser that promises one.
    expect(page).toContain("shapes={sheet.dimensions.length >= 2 ? DRAWABLE_SHAPES : []}");
    expect(readFileSync("lib/cad/plan.ts", "utf8")).toContain("اكتب مقاساتك تحت");
  });
});

describe("the owner's pre-call file shows the same room", () => {
  it("reads the stored drawing for every paper the customer owns", () => {
    expect(door).toContain("plan");
    expect(dossierLib).toContain("plan:");
  });

  it("paints it with the customer's sheet component, not a copy of it", () => {
    expect(dossier).toContain("import RoomPlan from '@/components/cad/RoomPlan'");
    expect(dossier).toContain("data-dossier-plan");
    expect(dossier).not.toContain("<svg");
    // Read-only: the owner does not move his customer's door. Only the sheet he shares is live.
    expect(dossier).not.toContain("interactive");
  });

  it("points the owner at the drawing's open questions instead of repeating them", () => {
    expect(dossier).toContain("data-dossier-plan-question");
    expect(dossier).toContain("الرسم بيسألك");
  });
});
