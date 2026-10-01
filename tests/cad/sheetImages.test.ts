// @vitest-environment node
import { describe, expect, it } from "vitest";

import { roomTypeFor } from "@/lib/cad/sheet-images";

/**
 * The room on a hand-drawn sheet is Arabic prose; the picture bank is keyed in
 * English slugs. This mapping is the only thing between the two, and a wrong answer
 * here puts a bedroom's pictures on a dining-room sheet — so the words the owner and
 * his customers actually use are pinned, including the misspelled and the accented.
 */
describe("the room on the sheet points at the pictures that hold it", () => {
  it("reads the words a customer would write", () => {
    expect(roomTypeFor("غرفة نوم ماستر")).toBe("master-bedroom");
    expect(roomTypeFor("صالة")) .toBe("living-room");
    expect(roomTypeFor("مجلس رجال")).toBe("living-room");
    expect(roomTypeFor("سفرة")).toBe("dining-room");
    expect(roomTypeFor("أوضة أطفال")).toBe("children-room");
    expect(roomTypeFor("غرفة بنتي")).toBe("children-room");
    expect(roomTypeFor("ركنة")).toBe("corner-sofa");
  });

  it("survives the diacritics a hand-drawn label arrives with", () => {
    expect(roomTypeFor("غُرْفَة نَوْم")).toBe("master-bedroom");
  });

  /** The letters that have two spellings, not just the marks: a hamza and a ta. */
  it("folds the letters handwriting varies, not only the vowel marks", () => {
    expect(roomTypeFor("غرفة معيشة")).toBe("living-room");
    expect(roomTypeFor("غرفة معيشه")).toBe("living-room");
    expect(roomTypeFor("أطفال")).toBe("children-room");
    expect(roomTypeFor("اطفال")).toBe("children-room");
  });

  it("accepts the bank's own slug when that is what came back", () => {
    expect(roomTypeFor("living-room")).toBe("living-room");
  });

  it("says nothing rather than guessing a room it has no pictures for", () => {
    expect(roomTypeFor("مكتب")).toBeNull();
    expect(roomTypeFor("")).toBeNull();
    expect(roomTypeFor(null)).toBeNull();
  });
});
