import { readFileSync } from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * His colours, where they are kept, and what they are allowed to do.
 *
 * The council's ruling for the drawing applies here too: one structured field on the paper's own
 * row, no second table. What is added by this atom is the guard that a customer can only choose a
 * colour the shop can back with pictures of his room — a palette he picks that the bank cannot
 * show would be a promise, not a preference.
 */
const TOKEN = "abcdefghij_klmnop123456";

const world = vi.hoisted(() => {
  const state = {
    row: null as any,
    writes: [] as any[],
    selects: [] as string[],
    refuse: false,
    bank: [] as any[],
  };

  const apply = (patch: any) => {
    state.writes.push(patch);
    if (state.refuse) return { data: null, error: { message: "refused" } };
    state.row = { ...state.row, ...patch };
    return { data: state.row, error: null };
  };

  const chain = (read: () => any = () => ({ data: state.row, error: null })) => {
    const self: any = {
      eq: () => self,
      is: () => self,
      neq: () => self,
      not: () => self,
      in: () => self,
      gte: () => self,
      lte: () => self,
      like: () => self,
      order: () => self,
      limit: () => self,
      select: () => self,
      maybeSingle: async () => read(),
      single: async () => read(),
      then: (resolve: any, reject: any) => {
        try {
          return Promise.resolve(resolve(read()));
        } catch (error) {
          return Promise.reject(reject(error));
        }
      },
    };
    return self;
  };

  const client = () => ({
    from(table: string) {
      if (table === "room_sketches") {
        return {
          select(columns: string) {
            state.selects.push(String(columns));
            return chain();
          },
          update(patch: any) {
            return chain(() => apply(patch));
          },
        };
      }
      return { select: () => chain(() => ({ data: state.bank, error: null })) };
    },
  });

  return { state, client };
});

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => world.client() as never }));

const { GET } = await import("@/app/api/passport/[token]/route");
const { POST: sendColours } = await import("@/app/api/passport/[token]/colours/route");
const { matrixFor, samePicks } = await import("@/lib/cad/colours");

const params = { params: Promise.resolve({ token: TOKEN }) };
const asRequest = (body: unknown) =>
  new Request(`http://localhost/api/passport/${TOKEN}/colours`, { method: "POST", body: JSON.stringify(body) }) as unknown as Parameters<typeof sendColours>[0];

/** The bank as it really answers: quality-ordered rows with a stored colour each. */
const BANK = [
  { id: 1, url: "https://x/1.jpg", thumbnail_url: "https://x/1t.jpg", style: "modern", room_type: "living-room", metadata: { avg_color: "#A7937D" } },
  { id: 2, url: "https://x/2.jpg", thumbnail_url: "https://x/2t.jpg", style: "classic", room_type: "living-room", metadata: { avg_color: "#583D26" } },
  { id: 3, url: "https://x/3.jpg", thumbnail_url: "https://x/3t.jpg", style: "minimal", room_type: "living-room", metadata: { avg_color: "#555148" } },
  { id: 4, url: "https://x/4.jpg", thumbnail_url: "https://x/4t.jpg", style: null, room_type: "living-room", metadata: { avg_color: "#3E5A78" } },
];

const paper = (over: Record<string, unknown> = {}) => ({
  id: 11,
  token: TOKEN,
  room: "صالة معيشة",
  dimensions: [
    { label: "الطول", meters: 4.5, confirmed: true },
    { label: "العرض", meters: 3.2, confirmed: true },
  ],
  openings: [],
  area_sqm: 14.4,
  confirmed_count: 2,
  ok: true,
  failure: null,
  confirmed_at: "2026-10-03T10:00:00.000Z",
  frozen_hash: "seal",
  customer_dimensions: [4.5, 3.2],
  plan: null,
  colour_picks: null,
  customer_key: null,
  customer_city: null,
  ...over,
});

beforeEach(() => {
  world.state.row = paper();
  world.state.writes = [];
  world.state.selects = [];
  world.state.refuse = false;
  world.state.bank = BANK;
});

describe("the matrix a room can back", () => {
  it("lists the families his pictures carry, with a real colour for each", () => {
    const matrix = matrixFor(BANK.map((row) => ({ color: row.metadata.avg_color })));
    expect(matrix.map((m) => m.family)).toEqual(["grey", "warmBeige", "darkWood", "blue"]);
    expect(matrix.map((m) => m.count)).toEqual([1, 1, 1, 1]);
    expect(matrix.every((m) => BANK.some((row) => row.metadata.avg_color === m.hex))).toBe(true);
  });

  it("answers with nothing when the bank has nothing", () => {
    expect(matrixFor([])).toEqual([]);
  });
});

describe("the sheet hands over the matrix and his picks", () => {
  it("reads the stored picks and offers the matrix beside them", async () => {
    const res = await GET(new Request("http://localhost/api/passport/x") as never, params);
    const body = await res.json();
    expect(world.state.selects.join(",")).toContain("colour_picks");
    expect(body.sheet.colour_matrix.length).toBeGreaterThan(0);
    expect(body.sheet.colour_matrix[0]).toMatchObject({ family: expect.any(String), label: expect.any(String), hex: expect.stringMatching(/^#[\da-f]{6}$/i) });
    expect(body.sheet.colour_picks).toEqual([]);
  });

  it("re-orders his pictures by what he chose, and marks the close ones", async () => {
    world.state.row = paper({ colour_picks: [{ family: "blue", hex: "#3E5A78" }] });
    const res = await GET(new Request("http://localhost/api/passport/x") as never, params);
    const body = await res.json();
    // Measured distances to his blue, over the bank's own pictures: the blue one (0), the grey
    // one (54), the dark wood (91), the warm beige (120). The line the bank draws is 40, so only
    // the blue picture is called close — the rest are simply ordered by nearness.
    expect(body.images.map((i: any) => i.id)).toEqual([4, 3, 2, 1]);
    expect(body.images[0].near).toBe(true);
    expect(body.images[1].near).toBe(false);
    expect(body.images[2].near).toBe(false);
    expect(body.images[3].near).toBe(false);
    expect(body.sheet.colour_picks).toEqual([{ family: "blue", hex: "#3E5A78" }]);
  });

  it("never lets a colour code reach the page as a word inside Arabic text", async () => {
    const res = await GET(new Request("http://localhost/api/passport/x") as never, params);
    const text = await res.text();
    // The hexes are data for a swatch; the labels the customer reads are Arabic only.
    const body = JSON.parse(text);
    for (const entry of body.sheet.colour_matrix) expect(entry.label).not.toMatch(/[A-Za-z]/);
  });
});

describe("the colour door", () => {
  it("keeps up to three colours he picked, and reads them back from the table", async () => {
    const res = await sendColours(asRequest({ picks: [{ family: "warmBeige", hex: "#A7937D" }, { family: "darkWood", hex: "#583D26" }] }), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.picks).toHaveLength(2);
    expect(body.matrix.length).toBeGreaterThan(0);
    expect(world.state.writes[0].colour_picks).toHaveLength(2);
  });

  it("refuses a fourth colour instead of trimming his list in silence", async () => {
    const four = [1, 2, 3, 4].map((n) => ({ family: "warmBeige", hex: "#A7937D" }));
    const res = await sendColours(asRequest({ picks: four }), params);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("تلاتة");
    expect(world.state.writes).toHaveLength(0);
  });

  it("refuses a colour the room's own pictures do not carry", async () => {
    const res = await sendColours(asRequest({ picks: [{ family: "green", hex: "#2E7D32" }] }), params);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("صور مكانك");
    expect(world.state.writes).toHaveLength(0);
  });

  it("refuses a label that does not match the colour it claims", async () => {
    const res = await sendColours(asRequest({ picks: [{ family: "blue", hex: "#A7937D" }] }), params);
    expect(res.status).toBe(400);
    expect(world.state.writes).toHaveLength(0);
  });

  it("takes the choice off again when he changes his mind", async () => {
    world.state.row = paper({ colour_picks: [{ family: "blue", hex: "#3E5A78" }] });
    const res = await sendColours(asRequest({ picks: [] }), params);
    expect(res.status).toBe(200);
    expect((await res.json()).picks).toEqual([]);
    expect(world.state.writes[0].colour_picks).toEqual([]);
  });

  it("answers only for its own sheet, and says so when the record refuses", async () => {
    const badAddress = { params: Promise.resolve({ token: "short" }) };
    expect((await sendColours(asRequest({ picks: [] }), badAddress)).status).toBe(400);
    world.state.row = null;
    expect((await sendColours(asRequest({ picks: [{ family: "blue", hex: "#3E5A78" }] }), params)).status).toBe(404);
    world.state.row = paper();
    world.state.refuse = true;
    const res = await sendColours(asRequest({ picks: [{ family: "blue", hex: "#3E5A78" }] }), params);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("الألوان");
  });

  it("refuses a body it cannot read", async () => {
    const broken = new Request(`http://localhost/api/passport/${TOKEN}/colours`, { method: "POST", body: "{not json" }) as unknown as Parameters<typeof sendColours>[0];
    expect((await sendColours(broken, params)).status).toBe(400);
  });
});

describe("the same picks, compared", () => {
  it("reads a stored list and a fresh one as the same choice", () => {
    expect(samePicks([{ family: "grey", hex: "#555148" }], [{ family: "grey", hex: "#555148" }])).toBe(true);
    expect(samePicks([], [])).toBe(true);
    expect(samePicks([{ family: "grey", hex: "#555148" }], [{ family: "grey", hex: "#555149" }])).toBe(false);
  });
});

describe("the matrix where a thumb reaches it", () => {
  const page = readFileSync("app/passport/[token]/page.tsx", "utf8");
  const component = readFileSync("components/cad/ColourMatrix.tsx", "utf8");

  it("sits with the pictures it re-orders, and keeps the database out of the phone", () => {
    expect(page).toContain("data-colour-block");
    expect(page).toContain("<ColourMatrix");
    expect(component).not.toMatch(/supabase|fetch\(|process\.env/);
  });

  it("posts his choice and reads the answer back from the store", () => {
    expect(page).toContain("`/api/passport/${token}/colours`");
    expect(page).toContain("load(token);");
  });

  it("marks the pictures that are close to what he chose", () => {
    expect(page).toContain("data-picture-near={img.url}");
    expect(page).toContain("قريبة من اختيارك");
  });

  it("says how many of the shown pictures carry a colour, in his digits", () => {
    expect(component).toContain("{arNum(entry.count)}");
    expect(component).toContain("data-colour-swatch={entry.hex}");
    expect(component).toContain("aria-pressed={on}");
  });

  it("refuses to offer a matrix the pictures cannot back, instead of an empty grid", () => {
    expect(component).toContain("data-colour-empty");
  });

  it("does not swallow a fourth tap — the grid says it is full and how to make room", () => {
    expect(component).toContain("data-colour-full={full ? \"1\" : \"0\"}");
    expect(component).toContain("disabled={busy || (full && !on)}");
    expect(component).toContain("اخدت تلاتة — دوس على لون عشان تشيله وتختار غيره.");
  });
});

describe("where the colours live", () => {
  it("adds one structured field to the paper's row, and no new table", () => {
    const sql = readFileSync("supabase/migrations/20261003_c_colour_picks.sql", "utf8");
    expect(sql).toContain("add column colour_picks jsonb");
    expect(sql).toContain("if not exists");
    expect(sql).not.toMatch(/create table/i);
  });

  it("shows his colours on the owner's pre-call file, not only on his own sheet", () => {
    const door = readFileSync("app/api/admin/customers/dossier/route.ts", "utf8");
    const panel = readFileSync("components/admin/ClientPreCallDossier.tsx", "utf8");
    expect(door).toContain("colour_picks");
    expect(panel).toContain("data-dossier-colours");
    expect(panel).toContain("ألوانه اللي اختارها");
  });
});
