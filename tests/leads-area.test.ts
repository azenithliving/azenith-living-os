import { beforeEach, describe, expect, it, vi } from "vitest";

import { styleKey } from "@/lib/taste-words";

/**
 * The lead door's two answers — his area and his taste: written once, in the store's own spelling,
 * and never with an answer the screen invented for him.
 *   npx vitest run tests/leads-area.test.ts
 *
 * Measured 2026-10-08: 21 visitor rows carry a room type and a style and none carries an area,
 * because the brief form asks for the taste and never for the place. The region station can only
 * rank on rows that hold both, so this door — the one that already collects the taste — is where
 * the area is asked. Measured 2026-10-09 on the same table: 14 of 27 rows carry «elite-brief» in
 * the taste column, the elite form answering for a customer who was never asked.
 */
const world = vi.hoisted(() => {
  const state = {
    users: [] as any[],
    requests: [] as any[],
    events: [] as any[],
  };

  const client = () => ({
    from(table: string) {
      const filters: [string, unknown][] = [];
      let insertRow: any = null;
      let patch: any = null;
      const self: any = {
        select: () => self,
        insert: (values: any) => {
          insertRow = values;
          return self;
        },
        update: (values: any) => {
          patch = values;
          return self;
        },
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return self;
        },
        maybeSingle: async () => {
          const rows = table === "users" ? state.users : [];
          return { data: rows.find((r) => filters.every(([c, v]) => String(r[c]) === String(v))) ?? null, error: null };
        },
        single: async () => {
          if (table === "users" && insertRow) {
            const row = { ...insertRow };
            state.users.push(row);
            return { data: row, error: null };
          }
          if (table === "users" && patch) {
            const row = state.users.find((r) => String(r.id) === String(filters.find(([c]) => c === "id")?.[1]));
            if (!row) return { data: null, error: { message: "مفيش سطر" } };
            Object.assign(row, patch);
            return { data: row, error: null };
          }
          if (table === "requests" && insertRow) {
            state.requests.push(insertRow);
            return { data: insertRow, error: null };
          }
          if (table === "events" && insertRow) state.events.push(insertRow);
          return { data: insertRow ?? null, error: null };
        },
        then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
      };
      return self;
    },
  });

  return { state, client };
});

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => world.client() as never }));
vi.mock("@/lib/tenant", () => ({ getTenantByHost: async () => ({ id: "company-1" }) }));
vi.mock("@/lib/automation", () => ({ processAutomation: async () => undefined }));
vi.mock("@/lib/background-processor", () => ({ fireAndForget: (fn: () => unknown) => void fn() }));
vi.mock("@/lib/conversion-engine", () => ({ classifyIntent: () => "interested", buildWhatsAppUrl: () => "" }));

const SESSION = "req-session-1";

const lead = (over: Record<string, unknown> = {}) => ({
  sessionId: SESSION,
  fullName: "سيف",
  phone: "01005556677",
  email: "",
  notes: "",
  roomType: "غرف النوم",
  budget: "فئة النخبة",
  style: "مودرن (Modern)",
  serviceType: "شقة",
  score: 70,
  lastPage: "/request",
  ...over,
});

beforeEach(() => {
  world.state.users = [];
  world.state.requests = [];
  world.state.events = [];
});

describe("the brief door records the place beside the taste", () => {
  it("writes his area in the map's spelling on the row that carries his style", async () => {
    const { persistLeadSubmission } = await import("@/lib/leads");
    const out = await persistLeadSubmission(lead({ area: "زايد" }) as never, "store.example");
    expect(out.ok).toBe(true);
    expect(world.state.users[0]).toMatchObject({ area: "الشيخ زايد", style: "مودرن (Modern)", room_type: "غرف النوم" });
  });

  it("keeps his own words when the map has no match, and stays empty when he said nothing", async () => {
    const { persistLeadSubmission } = await import("@/lib/leads");
    await persistLeadSubmission(lead({ area: "منطقة تانية" }) as never, "store.example");
    expect(world.state.users[0].area).toBe("منطقة تانية");

    world.state.users = [];
    await persistLeadSubmission(lead() as never, "store.example");
    expect(world.state.users[0].area).toBeNull();
  });

  it("does not rewrite an area the row already knows, while the rest of the brief updates", async () => {
    world.state.users.push({ id: "u1", company_id: "company-1", session_id: SESSION, area: "التجمع", style: "كلاسيك" });
    const { persistLeadSubmission } = await import("@/lib/leads");
    await persistLeadSubmission(lead({ area: "زايد", style: "مودرن (Modern)" }) as never, "store.example");
    expect(world.state.users[0].area).toBe("التجمع");
    expect(world.state.users[0].style).toBe("مودرن (Modern)");
  });

  it("accepts a brief with no area at all — nobody is refused for it", async () => {
    const { leadSubmissionSchema } = await import("@/lib/leads");
    const parsed = leadSubmissionSchema.safeParse(lead());
    expect(parsed.success).toBe(true);
  });

  it("is asked on the form itself, not only accepted by the door", async () => {
    const { readFileSync } = await import("node:fs");
    const form = readFileSync("components/request-page-client.tsx", "utf8");
    expect(form).toContain("AREA_CHIPS");
    expect(form).toContain("data-area-chip={area}");
    expect(form).toContain("data-lead-area");
    // The tapped value has to reach the door, or the chips are decoration.
    expect(form).toContain("area: formArea,");
  });
});

describe("the taste column never holds a screen's name", () => {
  it("drops the page name the elite brief used to answer with", async () => {
    const { persistLeadSubmission } = await import("@/lib/leads");
    await persistLeadSubmission(
      lead({ style: "elite-brief", lastPage: "/elite-brief" }) as never,
      "store.example",
    );
    expect(world.state.users[0].style).toBeNull();
  });

  it("drops the store's own word for blank instead of filing it as a taste", async () => {
    const { persistLeadSubmission } = await import("@/lib/leads");
    await persistLeadSubmission(lead({ style: "غير محدد" }) as never, "store.example");
    expect(world.state.users[0].style).toBeNull();
  });

  it("keeps a taste he really chose, and his own words when the bank has no match", async () => {
    const { persistLeadSubmission } = await import("@/lib/leads");
    await persistLeadSubmission(lead({ style: "مودرن" }) as never, "store.example");
    expect(world.state.users[0].style).toBe("مودرن");
    expect(styleKey(world.state.users[0].style)).toBe("modern");

    world.state.users = [];
    await persistLeadSubmission(lead({ style: "هادئ فاخر" }) as never, "store.example");
    expect(world.state.users[0].style).toBe("هادئ فاخر");
  });

  it("takes an empty answer through the schema — a blank is no longer refused with a lie", async () => {
    const { leadSubmissionSchema } = await import("@/lib/leads");
    const parsed = leadSubmissionSchema.safeParse(lead({ style: "" }));
    expect(parsed.success).toBe(true);
  });

  it("asks the elite customer for his taste and his area, in his own chips", async () => {
    const { readFileSync } = await import("node:fs");
    const form = readFileSync("components/elite/EliteIntelligenceForm.tsx", "utf8");
    expect(form).toContain("AREA_CHIPS");
    expect(form).toContain("STYLE_LABELS");
    expect(form).toContain("data-elite-taste-chip={taste.label}");
    expect(form).toContain('data-elite-area-chip={area}');
    // Both elite screens have to carry the answer to the door, not a page name.
    const brief = readFileSync("app/elite-brief/page.tsx", "utf8");
    const intelligence = readFileSync("app/elite-intelligence/page.tsx", "utf8");
    expect(brief).toContain("style: data.style ?? \"\"");
    expect(brief).toContain("area: data.area ?? \"\"");
    expect(intelligence).toContain("style: form.style ?? \"\"");
    expect(intelligence).toContain("area: form.area ?? \"\"");
    expect(brief).not.toContain("\"elite-brief\",");
    expect(intelligence).not.toContain("\"elite-intelligence\",");
  });
});
