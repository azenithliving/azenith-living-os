// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { compositeLuxury, renderLuxury } from "@/lib/ops/luxury-v2";
import { ownerVoice } from "@/lib/ops/owner-voice";
import { roomLabel } from "@/lib/cad/room-names";

/**
 * The rows his screens build, read as rows.
 *
 * The bidi census (scratch/census-math-lines.cts, 2026-10-12) ran the shipping boundary over his own
 * stored rows and found the leftover shapes were not words at all: they were ROWS — a measured report
 * line «Luxury Score مقاسة: ٥٩/١٠٠ — p95 = 229ms», a table cell holding `N/A` and `[]`, a roll row
 * written as `غير محدد | 01002345678`, and the cell marks `**` and `[نص](رابط)` the chat prints raw
 * because its table renderer never got the inline pass prose already had.
 *
 * A render patch would fix one screen and leave the next surface writing the same English. Each rule
 * here is enforced where the row is composed — the luxury desk, the voice boundary, the room namer —
 * and the chat is only required to draw what it is given.
 */
const latin = (s: string) => s.match(/[A-Za-z]{2,}/g) ?? [];

describe("the luxury desk writes its line in his language", () => {
  const signals = {
    imageCompleteness: 0.75,
    priceDisclosed: 1,
    altCoverage: 0.4,
    seoScore: 61,
    loadP95Ms: 229,
  };
  const line = renderLuxury(compositeLuxury(signals), signals);

  it("names the measure in Arabic and gives him its digits", () => {
    expect(line).toContain("درجة الفخامة");
    expect(line).not.toContain("Luxury Score");
    expect(latin(line), line).toEqual([]);
  });

  it("says the load time as a sentence, not as a machine metric", () => {
    expect(line).not.toMatch(/p\d\d/);
    expect(line).toContain("مللي ثانية");
    expect(line).toMatch(/٢٢٩/);
  });

  it("names the search signal without its English letters", () => {
    const noLoad = renderLuxury(
      compositeLuxury({ ...signals, loadP95Ms: null }),
      { ...signals, loadP95Ms: null },
    );
    expect(noLoad).not.toContain("SEO");
    expect(latin(noLoad), noLoad).toEqual([]);
  });

  it("does not print a load line it could not measure", () => {
    const unread = renderLuxury(compositeLuxury({ ...signals, loadP95Ms: null }), { ...signals, loadP95Ms: null });
    expect(unread).not.toContain("مللي ثانية");
  });
});

describe("an empty measurement is said, not abbreviated", () => {
  it("reads a table cell that holds no value", () => {
    const row = ownerVoice("| إجمالي الطلبات | ٢٠٠ | - | N/A |");
    expect(row).not.toContain("N/A");
    expect(row).toContain("مش مقاس");
  });

  it("reads an empty list a tool returned", () => {
    const row = ownerVoice("| تفاصيل الأخطاء | [] | - | - |");
    expect(row).not.toContain("[]");
  });

  it("turns a unit stuck to a number into his words", () => {
    const row = ownerVoice("| زمن الاستجابة | **145ms** | 1500ms | ناجح |");
    expect(row).not.toMatch(/\d+ms/);
    expect(row).toContain("مللي ثانية");
    expect(row).toMatch(/١٤٥/);
  });

  it("keeps a code span whole: he pastes it, he does not read it", () => {
    expect(ownerVoice("النتيجة في `rows: N/A`")).toContain("`rows: N/A`");
  });

  it("does not flatten a pipe that lives inside a code span", () => {
    const kept = ownerVoice("جرّب `grep -r a lib | head -n 5`");
    expect(kept).toContain("`grep -r a lib | head -n 5`");
  });
});

describe("the customer's room is named the way the sheet names it", () => {
  it("reads the spellings his own columns actually hold", () => {
    // Counted 2026-10-12 across `users.room_type` and `requests.room_type`: Kitchen ٤, Kids Bedroom ٤,
    // Living Room ٣, Full Unit ٢, Dressing Room ٢, corner-sofa ١ — plus the form's glued-on English tail.
    expect(roomLabel("Living Room (L-shaped sofa / ركنة)")).toBe("ركنة");
    expect(roomLabel("Kitchen")).toBe("المطبخ");
    expect(roomLabel("corner-sofa")).toBe("الركنة");
  });

  it("says nothing about a room it has no name for", () => {
    expect(roomLabel("Polo Ralph Lauren")).toBeNull();
    expect(roomLabel(null)).toBeNull();
  });
});

describe("the sales roll draws its rows instead of printing their marks", () => {
  const panel = readFileSync("components/admin/sales/CustomersPanel.tsx", "utf8");

  it("names the room through the one namer, not the stored spelling", () => {
    expect(panel).toContain("roomLabel(");
    expect(panel).not.toContain("{lead.roomType ||");
  });

  it("does not join two facts with a pipe inside one Arabic line", () => {
    expect(panel).not.toContain("} | ${lead.phone}");
  });

  it("labels its two badges in his words", () => {
    expect(panel).not.toContain("PRE-COG");
    expect(panel).not.toContain(">HUMAN<");
  });

  it("counts his phone digits the way he reads them", () => {
    expect(panel).toMatch(/arDigits\(lead\.phone\)|toArabicDigits\(lead\.phone\)/);
  });

  it("gives a customer's address its own element and its own direction", () => {
    // When there is no phone the e-mail is the only way to reach him — it must stay whole, pressable,
    // and not move inside the Arabic sentence around it.
    expect(panel).toContain("mailto:${lead.email}");
    expect(panel).toContain('unicodeBidi: "isolate-override"');
    expect(panel).not.toContain("البريد: ${lead.email}");
  });
});
