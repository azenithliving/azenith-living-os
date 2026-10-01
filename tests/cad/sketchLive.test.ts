// @vitest-environment node
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { readPaperSketch } from "@/lib/cad/paper-sketch-parser";

/**
 * The live measurement of the paper reader: a sketch-like image is drawn here, then
 * read by both witnesses. It costs one model call and one offline pass, so it runs
 * only when asked for:
 *
 *   RUN_LIVE_SKETCH=1 npx vitest run tests/cad/sketchLive.test.ts
 */
const svg = `<svg width="900" height="620" xmlns="http://www.w3.org/2000/svg">
  <rect width="900" height="620" fill="#f7f4ec"/>
  <rect x="120" y="120" width="640" height="360" fill="none" stroke="#222" stroke-width="6"/>
  <text x="440" y="100" font-family="Arial" font-size="46" text-anchor="middle" fill="#111">4.50</text>
  <text x="300" y="530" font-family="Arial" font-size="46" text-anchor="middle" fill="#111">3.20</text>
</svg>`;

const live = process.env.RUN_LIVE_SKETCH === "1" ? describe : describe.skip;

live("the paper reader, measured on a real image", () => {
  it("reads the sketch and reports what each witness saw", async () => {
    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    const reading = await readPaperSketch({ base64: png.toString("base64"), mime: "image/png" });

    console.log(
      JSON.stringify(
        {
          ok: reading.ok,
          failure: reading.failure,
          dimensions: reading.dimensions,
          confirmed: reading.confirmedCount,
          area: reading.areaSqm,
          ocr: { ran: reading.ocr.ran, ms: reading.ocr.ms, confidence: reading.ocr.confidence, text: reading.ocr.text.trim().slice(0, 60) },
        },
        null,
        1
      )
    );

    // The contract: a reading either carries numbers, or says in words why it does
    // not. A silent empty success is the failure mode this whole module exists to
    // avoid — the quota is spent most minutes on the free tier, and the owner still
    // has to know what the machine actually saw.
    expect(typeof reading.ok).toBe("boolean");
    if (!reading.ok) {
      expect(reading.failure, "a refused reading has to say why").toBeTruthy();
    }
    for (const dimension of reading.dimensions) {
      expect(dimension.meters).toBeGreaterThan(0);
      expect(typeof dimension.confirmed).toBe("boolean");
    }
    if (reading.ok) {
      expect(reading.confirmedCount).toBeGreaterThan(0);
      expect(reading.areaSqm).toBeGreaterThan(0);
    }
  }, 180_000);
});
