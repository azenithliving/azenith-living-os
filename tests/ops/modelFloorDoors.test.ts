// @vitest-environment node
/**
 * The doors that call a model must fall to their floor, not to an English status code.
 *
 * Measured with `node scripts/capability-floor-census.mjs` on 2026-10-02: 40 files ask a model,
 * and of the surfaces the owner or a customer actually opens, 15 answered a failed call with
 * machine prose, 5 answered with nothing, and 2 fell to a declared floor. These checks keep the
 * wired ones wired and make the remaining pile a number that can only shrink here, in the open.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it, vi, beforeEach } from "vitest";

import { answeredByLabel } from "@/lib/ops/key-desk";
import { CAPABILITIES, NO_KEY_MESSAGE, modelFloorLine } from "@/lib/ops/capability-tiers";
import { scanModelCallers, scanModelDoors } from "../../scripts/capability-floor-census.mjs";

const world = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () =>
    ({ from: () => ({ select: () => ({ eq: async () => ({ data: world.rows, error: null }) }) }) }) as never,
}));

/** The doors and screens a human opens, measured by the same net the census casts. */
const doors = scanModelDoors().sort((a, b) => (a.file < b.file ? -1 : 1));

/**
 * Still to wire, by name. Every entry is a surface whose owner reads an English error or
 * nothing at all the night a key dies. Adding a name here is a decision; a new model door that
 * is not listed fails the build.
 */
const PENDING_FLOOR = [
  "app/api/admin/agents/orchestrate/route.ts",
  "app/api/admin/architect/command/route.ts",
  "app/api/admin/knowledge/audit/route.ts",
  "app/api/admin/ops/route.ts",
  "app/api/analyze-image/route.ts",
  "app/api/consultant/catalog-crawler/route.ts",
  "app/api/consultant/learnings/route.ts",
  "app/api/consultant/pending-questions/route.ts",
  "app/api/consultant/route.ts",
  "app/api/orchestrator/route.ts",
];

describe("the model doors fall to a floor, not to machine prose", () => {
  it("counts the surfaces a human opens", () => {
    // The scan itself is asserted, or a broken pattern would pass by finding nothing.
    expect(doors.length).toBeGreaterThanOrEqual(15);
    expect(scanModelCallers().length).toBeGreaterThan(40);
  });

  it("leaves no unwired door unnamed", () => {
    const unwired = doors.filter((row) => !row.wired).map((row) => row.file).sort();
    expect(unwired, `unlisted model doors: ${unwired.join(", ")}`).toEqual([...PENDING_FLOOR].sort());
  });

  it("shrinks the pile it started from", () => {
    // Measured 2026-10-02: 15 doors a human opens, 5 wired the same night. The number may only
    // go down, and it goes down by editing this file — which is the point of naming each one.
    expect(doors.filter((row) => row.wired).length).toBe(5);
    expect(PENDING_FLOOR.length).toBe(10);
  });

  it("asks the chain, not one named provider, on the sales desk's doors", () => {
    for (const file of [
      "app/api/admin/leads/analyze/route.ts",
      "app/api/admin/leads/suggestions/route.ts",
      "app/api/admin/leads/follow-up/route.ts",
    ]) {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} still asks one company by name`).not.toMatch(/askGroq\(|askOpenRouter\(/);
      expect(src, `${file} answers the owner in English`).not.toMatch(/Internal server error/i);
      expect(src).toContain("askWithFloor");
      expect(src).toContain("answered_by");
    }
  });

  it("keeps the picture door inside the store's own ceiling", () => {
    const src = readFileSync("app/api/ai/analyze-vision/route.ts", "utf8");
    expect(src).toContain("modelFloorLine");
    expect(src).not.toMatch(/error\.message \|\|/);
    // The rate limiter is only worth its name if the path is actually listed in it.
    expect(readFileSync("lib/rate-limit.ts", "utf8")).toContain('"/api/ai/analyze-vision"');
  });
});

describe("who answered is said in Arabic or not at all", () => {
  it("names a known company by the desk's own Arabic name", () => {
    expect(answeredByLabel("groq")).toBe("نموذج من مفاتيحك — جروكس");
  });

  it("refuses to print a provider id he cannot read", () => {
    const unknown = answeredByLabel("some-internal-name");
    expect(unknown).toBe("نموذج من مفاتيحك");
    expect(unknown).not.toContain("some-internal-name");
    expect(answeredByLabel(null)).toBe("نموذج من مفاتيحك");
  });

  it("every capability's floor is Arabic prose a man can act on", () => {
    for (const capability of CAPABILITIES) {
      const line = modelFloorLine(capability.id, "no_key");
      expect(line, capability.id).toContain(NO_KEY_MESSAGE);
      expect(line, capability.id).toMatch(/\p{Script=Arabic}/u);
      expect(/[A-Za-z]{3,}/.test(line.replace(/https?:\/\/\S+/g, "")), `${capability.id} leaks machine prose`).toBe(false);
    }
  });
});

describe("the picture door answers like the store, not like the provider", () => {
  beforeEach(() => {
    world.rows = [];
  });

  const post = async (body: unknown) => {
    const { POST } = await import("@/app/api/ai/analyze-vision/route");
    // The door only reads the request body, so a plain request is enough to stand at its handle.
    const request = new Request("http://store.test/api/ai/analyze-vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as unknown as Parameters<typeof POST>[0];
    const response = await POST(request);
    return { status: response.status, body: await response.json() };
  };

  it("refuses a link for the server to fetch, and says why in Arabic", async () => {
    const { status, body } = await post({ prompt: "صف الصورة", imageUrl: "https://example.com/a.jpg" });
    expect(status).toBe(400);
    expect(String(body.error)).toContain("مش رابط يجيبه السيرفر");
  });

  it("refuses a body that is not a picture at all", async () => {
    const { status, body } = await post({ prompt: "   ", imageUrl: "" });
    expect(status).toBe(400);
    expect(String(body.error)).toMatch(/\p{Script=Arabic}/u);
  });

  it("refuses a picture over the store's own ceiling", async () => {
    const huge = "A".repeat(6 * 1024 * 1024);
    const { status, body } = await post({ prompt: "صف الصورة", imageUrl: `data:image/png;base64,${huge}` });
    expect(status).toBe(400);
    expect(String(body.error)).toContain("أكبر من المسموح");
  });

  it("falls to the image floor with no key, and never prints a provider's reason", async () => {
    const tiny = Buffer.from("89504e470d0a1a0a", "hex").toString("base64");
    const { status, body } = await post({ prompt: "صف الصورة", imageUrl: `data:image/png;base64,${tiny}` });
    expect(status).toBe(503);
    expect(String(body.error)).toContain(NO_KEY_MESSAGE);
    expect(String(body.error)).toContain("بنك الصور المحلي");
    expect(body.answered_by).toBe("ولا قارئ — والوصف ما اخترعوش");
    expect(/[A-Za-z]{5,}/.test(String(body.error).replace(/https?:\/\/\S+/g, ""))).toBe(false);
  });
});
