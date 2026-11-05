// @vitest-environment node
import { describe, expect, it } from "vitest";

import { askAnthropic, askGoogleVision, askOpenAiCompatible } from "@/lib/ai-orchestrator";
import { readPaperSketch } from "@/lib/cad/paper-sketch-parser";

/**
 * ONE-OFF: name every witness separately, so the store stops reporting only the first refusal.
 * Run with: npx vitest run tests/ops/visionWitnessLive.test.ts
 */
const SVG = `<svg width="900" height="620" xmlns="http://www.w3.org/2000/svg">
  <rect width="900" height="620" fill="#f7f4ec"/>
  <rect x="120" y="120" width="640" height="360" fill="none" stroke="#222" stroke-width="6"/>
  <text x="440" y="100" font-family="Arial" font-size="46" text-anchor="middle" fill="#111">4.50</text>
  <text x="300" y="530" font-family="Arial" font-size="46" text-anchor="middle" fill="#111">3.20</text>
</svg>`;

const alone = async (name: string, run: () => Promise<any>) => {
  try {
    const r = await run();
    console.log(`${name} ok=${r?.success} err=${String(r?.error ?? "").slice(0, 110)} out=${String(r?.content ?? "").replace(/\s+/g, " ").slice(0, 60)}`);
  } catch (err: any) {
    console.log(`${name} threw: ${String(err?.message ?? err).slice(0, 140)}`);
  }
};

describe("each witness named separately", () => {
  it("asks google, then anthropic, then openai, then the offline engine", async () => {
    const { default: sharp } = await import("sharp");
    const png = (await sharp(Buffer.from(SVG)).png().toBuffer()).toString("base64");
    const prompt = 'Read the two numbers on this room sketch. Reply exactly: {"dimensions":[a,b]}';

    await alone("GOOGLE", () => askGoogleVision(prompt, png, "image/png", { maxTokens: 200 }));
    await alone("ANTHROPIC", () =>
      askAnthropic({
        model: "claude-sonnet-4-5",
        max_tokens: 200,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: png } },
          { type: "text", text: prompt },
        ] }],
      })
    );
    await alone("OPENAI", () =>
      askOpenAiCompatible("openai", "https://api.openai.com/v1/chat/completions", "gpt-4o-mini", [
        { role: "user", content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/png;base64,${png}` } },
        ] },
      ], { maxTokens: 200 })
    );
    await alone("OFFLINE", async () => {
      const off = await readPaperSketch({ base64: png, mime: "image/png", runOffline: true });
      return { success: off.ok, error: off.ocr.error, content: JSON.stringify(off.dimensions) };
    });
    expect(true).toBe(true);
  }, 240_000);
});
