// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The elite brief's own door: what it hands to the row.
 *   npx vitest run tests/eliteDoorPayload.test.ts
 *
 * Measured live 2026-10-09 on the published store: the brief asked his area, the chips took his
 * tap, and the row came back with his taste and an empty place. This door rebuilds the payload
 * field by field, so a field it never copies is a question the store asked for nothing.
 */
const world = vi.hoisted(() => ({ persisted: [] as any[] }));

vi.mock("@/lib/leads", async () => {
  const actual = await vi.importActual<typeof import("@/lib/leads")>("@/lib/leads");
  return {
    ...actual,
    persistLeadSubmission: async (payload: unknown) => {
      world.persisted.push(payload);
      return { ok: true, requestId: "r1", userId: "u1", companyId: "c1" };
    },
  };
});
vi.mock("@/lib/tenant", () => ({ normalizeHost: (host: string | null) => host }));
vi.mock("@/lib/pdf-generator", () => ({ analyzeStyleDNA: vi.fn() }));
vi.mock("@/lib/automation", () => ({ processAutomation: async () => undefined }));

const { POST } = await import("@/app/api/elite-leads/route");

const brief = (over: Record<string, unknown> = {}) => ({
  sessionId: "elite-session-1",
  fullName: "يوسف",
  phone: "01077788991",
  email: "",
  roomType: "Living Room",
  budget: "100k-200k",
  serviceType: "1-3 months",
  qualification: { isDiamond: false, score: 40, tier: "Gold", priority: "medium" },
  ...over,
});

const post = async (body: Record<string, unknown>) =>
  POST(new Request("http://store.test/api/elite-leads", { method: "POST", body: JSON.stringify(body) }) as never);

beforeEach(() => {
  world.persisted.length = 0;
});

describe("the elite door carries the brief's answers to the row", () => {
  it("forwards the area he tapped beside the taste he tapped", async () => {
    const response = await post(brief({ area: "التجمع", style: "مودرن" }));
    expect(response.status).toBe(200);
    expect(world.persisted[0]).toMatchObject({ area: "التجمع", style: "مودرن" });
  });

  it("takes a brief that names no taste — a blank is allowed now, not answered for him", async () => {
    const response = await post(brief({ area: "الشيخ زايد" }));
    expect(response.status).toBe(200);
    expect(world.persisted[0].style).toBeUndefined();
    expect(world.persisted[0].area).toBe("الشيخ زايد");
  });

  it("prefers the style read from the pictures he actually viewed", async () => {
    const response = await post(
      brief({ style: "", styleDNA: { dominantStyles: ["مودرن"], colorPalette: [], materials: [], moodKeywords: [], complexity: "balanced" } }),
    );
    expect(response.status).toBe(200);
    expect(world.persisted[0].style).toBe("مودرن");
  });
});

describe("each elite screen files itself, not its sister", () => {
  it("names the brief when the caller says nothing — the shared door's default is a wrong answer here", async () => {
    await post(brief({ area: "التجمع" }));
    expect(world.persisted[0].lastPage).toBe("/elite-brief");
  });

  it("keeps the address the intelligence flow states", async () => {
    await post(brief({ lastPage: "/elite-intelligence", area: "الشيخ زايد" }));
    expect(world.persisted[0].lastPage).toBe("/elite-intelligence");
  });

  it("hands the writer both the taste and the address, so the address can veto the taste", async () => {
    await post(brief({ lastPage: "/elite-intelligence", style: "elite-intelligence" }));
    expect(world.persisted[0]).toMatchObject({ style: "elite-intelligence", lastPage: "/elite-intelligence" });
    // The veto itself lives in the shared writer, and it does fire on what this door handed it.
    const { storedTaste } = await import("@/lib/taste-words");
    expect(storedTaste(world.persisted[0].style, world.persisted[0].lastPage)).toBeNull();
  });

  it("is stated by the page itself, not assumed by the door", async () => {
    const { readFileSync } = await import("node:fs");
    const intelligence = readFileSync("app/elite-intelligence/page.tsx", "utf8");
    expect(intelligence).toContain('lastPage: "/elite-intelligence"');
    const door = readFileSync("app/api/elite-leads/route.ts", "utf8");
    expect(door).toContain("lastPage: parsed.data.lastPage");
  });
});
