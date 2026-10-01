// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

/**
 * The two-witness rule, measured without a network and without a microphone: the
 * model's answer is a hoisted fake, and the pixel witness is supplied exactly the way
 * the browser hands it over. What is under test is the agreement rule itself — the
 * thing that decides whether the owner sees a finished reading or a refusal.
 */
const world = vi.hoisted((): { model: { success: boolean; content: string; error?: string } } => ({
  model: { success: true, content: "" },
}));

vi.mock("@/lib/ai-orchestrator", () => ({
  askGoogleVision: async () => world.model,
}));

const { readPaperSketch } = await import("@/lib/cad/paper-sketch-parser");

const PIXELS = { ran: true, text: "4.50\n3.20", confidence: 96, ms: 480, error: null };

function modelJson(body: unknown) {
  world.model = { success: true, content: "```json\n" + JSON.stringify(body) + "\n```" };
}

describe("a reading needs both witnesses to agree", () => {
  it("accepts the numbers the pixels also saw, and only then computes an area", async () => {
    modelJson({
      room: "غرفة نوم",
      dimensions: [
        { label: "الضلع الطويل", meters: 4.5 },
        { label: "الضلع القصير", meters: 3.2 },
      ],
      openings: [{ kind: "door", widthMeters: 0.9 }],
    });

    const reading = await readPaperSketch({ base64: "AA", offline: PIXELS });

    expect(reading.ok).toBe(true);
    expect(reading.confirmedCount).toBe(2);
    expect(reading.areaSqm).toBeCloseTo(14.4, 1);
    expect(reading.room).toBe("غرفة نوم");
    // The supplied witness is used as-is: the server must not read the same pixels again.
    expect(reading.ocr.ms).toBe(480);
    expect(reading.ocr.confidence).toBe(96);
  });

  it("refuses a number the pixels never showed", async () => {
    modelJson({
      room: "صالة",
      dimensions: [{ label: "الضلع", meters: 7.75 }],
    });

    const reading = await readPaperSketch({ base64: "AA", offline: PIXELS });

    expect(reading.ok).toBe(false);
    expect(reading.confirmedCount).toBe(0);
    expect(reading.areaSqm, "an unconfirmed number must not become an area").toBeNull();
    expect(reading.failure).toContain("ولا رقم");
  });

  it("answers in one witness's voice when the model refuses, and says so", async () => {
    world.model = { success: false, content: "" };
    world.model.error = "429 Quota exceeded for quota metric 'API requests'";

    const reading = await readPaperSketch({ base64: "AA", offline: PIXELS });

    expect(reading.ok).toBe(false);
    expect(reading.failure).toContain("سقف الدقايق");
    expect(reading.dimensions.map((d) => d.meters)).toEqual([4.5, 3.2]);
    expect(reading.dimensions.every((d) => !d.confirmed)).toBe(true);
  });

  it("does not call a blank sheet when the model answers in prose", async () => {
    world.model = { success: true, content: "للأسف لم أستطع إخراج JSON من الصورة" };

    const reading = await readPaperSketch({ base64: "AA", offline: PIXELS });

    expect(reading.ok).toBe(false);
    expect(reading.failure).toContain("صيغة مش مفهومة");
    expect(reading.failure).not.toContain("ما فيهاش رقم");
  });
});
