import { readFileSync } from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The drawing has to live somewhere, and the council settled where: one structured field on the
 * paper's own row — the sheet and its geometry are one thing, and a second table would let the
 * two drift apart while the customer is still looking at the first.
 *
 * These tests run the doors themselves against a table that behaves like the record: one row per
 * token, a write that can refuse, and every patch logged so an accidental touch to a sealed
 * number is visible.
 */
const TOKEN = "abcdefghij_klmnop123456";

const world = vi.hoisted(() => {
  const state = {
    row: null as any,
    writes: [] as any[],
    selects: [] as string[],
    refuse: false,
    reading: null as any,
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
    storage: { from: () => ({ upload: async () => ({ data: null, error: null }) }) },
    from(table: string) {
      // The picture bank answers with nothing: this atom is about the paper's row, and an empty
      // set is what the sheet already handles when the bank has no picture for a room.
      if (table !== "room_sketches") return { select: () => chain(() => ({ data: [], error: null })) };
      return {
        select(columns: string) {
          state.selects.push(String(columns));
          return chain();
        },
        update(patch: any) {
          const read = () => apply(patch);
          return Object.assign(chain(read), { read });
        },
        insert(values: any) {
          state.writes.push(values);
          if (!state.refuse) state.row = { token: TOKEN, ...values };
          return chain();
        },
      };
    },
  });

  return { state, client };
});

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => world.client() as never }));
vi.mock("@/lib/admin-api-guard", () => ({ requireAdminApi: async () => ({ user: { id: "admin-1" }, unauthorized: null }) }));
vi.mock("@/lib/admin-company", () => ({ resolveAdminCompanyId: async () => "11111111-1111-4111-8111-111111111111" }));
vi.mock("@/lib/ops/memory/SyncLayer", () => ({ syncLayer: { initialize: async () => {}, publish: async () => {} } }));
// The reader is the model's job, not this store's. Its answer is canned so the writing paths —
// the atom under test — run exactly as they do in production.
vi.mock("@/lib/ai-orchestrator", () => ({
  askVisionAny: async () => world.state.reading,
}));

const { POST: confirmSheet, GET: readSheet } = await import("@/app/api/passport/[token]/route");
const { POST: storePaper } = await import("@/app/api/admin/ops/sketch/route");
const { POST: storePlan } = await import("@/app/api/passport/[token]/plan/route");
const { freezeHash, stillSealed } = await import("@/lib/cad/passport");

const params = { params: Promise.resolve({ token: TOKEN }) };

const paper = (over: Record<string, unknown> = {}) => ({
  id: 11,
  token: TOKEN,
  room: "صالة معيشة",
  dimensions: [
    { label: "الضلع السفلي", meters: 4.5, confirmed: false },
    { label: "الضلع الأيمن", meters: 3.2, confirmed: false },
    { label: "الضلع العلوي", meters: 4.5, confirmed: false },
    { label: "الضلع الأيسر", meters: 3.2, confirmed: false },
  ],
  openings: [{ kind: "door", widthMeters: 0.9 }],
  area_sqm: null,
  confirmed_count: 0,
  ok: false,
  failure: null,
  confirmed_at: null,
  frozen_hash: null,
  customer_dimensions: null,
  customer_key: null,
  customer_city: null,
  plan: null,
  ...over,
});

const asRequest = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, { method: "POST", body: JSON.stringify(body) }) as unknown as Parameters<typeof confirmSheet>[0];

const lastWrite = () => world.state.writes[world.state.writes.length - 1];

beforeEach(() => {
  world.state.row = paper();
  world.state.writes = [];
  world.state.selects = [];
  world.state.refuse = false;
  world.state.reading = {
    success: true,
    content:
      '{"room":"صالة","dimensions":[{"label":"سفل","meters":4.5},{"label":"يمين","meters":3.2},{"label":"علوي","meters":4.5},{"label":"شمال","meters":3.2}],"openings":[]}',
    error: null,
    reader: "test",
  };
});

describe("the paper's row carries its own drawing", () => {
  it("adds one structured field to the record the papers already live in", () => {
    const sql = readFileSync("supabase/migrations/20261003_b_room_plan.sql", "utf8");
    expect(sql).toContain("add column plan jsonb");
    expect(sql).toContain("if not exists");
    // The ruling was one-to-one: no second table the two sheets could disagree with.
    expect(sql).not.toMatch(/create table/i);
  });

  it("reads the drawing back wherever the sheet is read", async () => {
    const res = await readSheet({} as never, params);
    const body = await res.json();
    expect(world.state.selects.join(",")).toContain("plan");
    expect(body.sheet.plan).toBeTruthy();
    expect(body.sheet.plan.walls).toHaveLength(4);
  });

  it("never lets the drawing carry the customer's key onto a public address", async () => {
    world.state.row = paper({ customer_key: "01005554444", plan: { shape: "rectangle", walls: [] } });
    const res = await readSheet({} as never, params);
    expect(await res.text()).not.toContain("01005554444");
  });
});

describe("the owner's upload files the drawing with the reading", () => {
  it("stores a plan on the same row the paper lands on", async () => {
    world.state.row = null;
    const res = await storePaper(
      asRequest("/api/admin/ops/sketch", { image_base64: Buffer.from("paper").toString("base64"), mime: "image/png" }),
      {} as never
    );
    expect(res.status).toBe(200);
    const written = world.state.writes[0];
    expect(written.plan).toBeTruthy();
    expect(written.plan.walls.map((w: any) => w.meters)).toEqual([4.5, 3.2, 4.5, 3.2]);
    // No witness has agreed these yet, so the sheet must show them as proposed.
    expect(written.plan.walls.every((w: any) => w.confirmed === false)).toBe(true);
  });
});

describe("the customer's confirmation draws the room he signed", () => {
  it("stores the plan and the area the polygon holds, beside the seal", async () => {
    const res = await confirmSheet(asRequest(`/api/passport/${TOKEN}`, { dimensions: [4.5, 3.2] }), params);
    expect(res.status).toBe(200);
    const written = lastWrite();
    expect(written.plan.walls).toHaveLength(4);
    expect(written.plan.complete).toBe(true);
    expect(Number(written.area_sqm)).toBeCloseTo(14.4, 2);
    // The seal is over the numbers he agreed; the drawing sits beside it, never inside it.
    expect(written.frozen_hash).toBe(freezeHash(written.dimensions.filter((d: any) => d.confirmed)));
  });

  it("keeps the drawing indicative when his numbers do not agree with the paper", async () => {
    const res = await confirmSheet(asRequest(`/api/passport/${TOKEN}`, { dimensions: [9] }), params);
    const body = await res.json();
    expect(body.matched).toBe(false);
    expect(world.state.writes).toHaveLength(0);
  });

  it("asks about opposite walls instead of drawing a room nobody owns", async () => {
    world.state.row = paper({
      dimensions: [
        { label: "سفل", meters: 4.5, confirmed: false },
        { label: "يمين", meters: 3.2, confirmed: false },
        { label: "علوي", meters: 6, confirmed: false },
        { label: "شمال", meters: 3.2, confirmed: false },
      ],
    });
    await confirmSheet(asRequest(`/api/passport/${TOKEN}`, { dimensions: [4.5, 3.2, 6] }), params);
    const written = lastWrite();
    expect(written.plan.complete).toBe(false);
    expect(written.plan.conflicts.join(" ")).toContain("٦");
    expect(written.area_sqm).toBeNull();
  });
});

describe("the drawing door: a shape chosen, a door dragged", () => {
  it("draws the moment he names a shape the numbers do not decide", async () => {
    world.state.row = paper({
      dimensions: [
        { label: "سفل", meters: 4, confirmed: true },
        { label: "يمين", meters: 2, confirmed: true },
        { label: "علوي", meters: 1.5, confirmed: true },
        { label: "داخل", meters: 1, confirmed: true },
        { label: "علوي تاني", meters: 2.5, confirmed: true },
        { label: "شمال", meters: 3, confirmed: true },
      ],
    });
    const res = await storePlan(asRequest(`/api/passport/${TOKEN}/plan`, { shape: "l-shape" }), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.plan.walls).toHaveLength(6);
    expect(Number(body.plan.areaSqm)).toBeCloseTo(10.5, 2);
  });

  it("keeps a dragged opening on its wall without touching a sealed number", async () => {
    const agreed = [
      { label: "سفل", meters: 4.5, confirmed: true, confirmedBy: ["customer"] },
      { label: "يمين", meters: 3.2, confirmed: true, confirmedBy: ["customer"] },
      { label: "علوي", meters: 4.5, confirmed: true, confirmedBy: ["customer"] },
      { label: "شمال", meters: 3.2, confirmed: true, confirmedBy: ["customer"] },
    ];
    world.state.row = paper({
      dimensions: agreed,
      confirmed_at: "2026-10-03T10:00:00.000Z",
      frozen_hash: freezeHash(agreed),
      customer_dimensions: [4.5, 3.2],
      ok: true,
    });
    const res = await storePlan(
      asRequest(`/api/passport/${TOKEN}/plan`, {
        openings: [{ kind: "door", widthMeters: 0.9, wallIndex: 0, offsetMeters: 2.8 }],
      }),
      params
    );
    expect(res.status).toBe(200);
    const written = lastWrite();
    expect(Object.keys(written).sort()).toEqual(["area_sqm", "plan"]);
    expect(written.plan.openings[0].offsetMeters).toBeCloseTo(2.8, 2);
    expect(written.plan.openings[0].wallIndex).toBe(0);
    // Still his signature: the same numbers hash to the same seal, after the drawing moved.
    expect(stillSealed(world.state.row.frozen_hash, world.state.row.dimensions)).toBe(true);
  });

  it("refuses a shape it cannot walk instead of storing an empty box", async () => {
    world.state.row = paper({
      dimensions: [
        { label: "سفل", meters: 4, confirmed: true },
        { label: "يمين", meters: 2, confirmed: true },
        { label: "علوي", meters: 1.5, confirmed: true },
      ],
    });
    const res = await storePlan(asRequest(`/api/passport/${TOKEN}/plan`, { shape: "rectangle" }), params);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain("٣");
    expect(world.state.writes).toHaveLength(0);
  });

  it("will not offer a shape the store has no drawing for, in words with no machine key", async () => {
    const res = await storePlan(asRequest(`/api/passport/${TOKEN}/plan`, { shape: "u-shape" }), params);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain("مستطيل");
    expect(body.error).not.toMatch(/rectangle|l-shape|u-shape/);
  });

  it("answers only for its own sheet, and says so when the record refuses", async () => {
    const badAddress = { params: Promise.resolve({ token: "short" }) };
    expect((await storePlan(asRequest(`/api/passport/${TOKEN}/plan`, { shape: "rectangle" }), badAddress)).status).toBe(400);
    world.state.row = null;
    expect((await storePlan(asRequest(`/api/passport/${TOKEN}/plan`, { shape: "rectangle" }), params)).status).toBe(404);
    world.state.row = paper();
    world.state.refuse = true;
    const res = await storePlan(asRequest(`/api/passport/${TOKEN}/plan`, { openings: [{ kind: "door", widthMeters: 0.9 }] }), params);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("الرسم");
  });

  it("accepts a body that changes nothing rather than inventing a room", async () => {
    const res = await storePlan(asRequest(`/api/passport/${TOKEN}/plan`, {}), params);
    expect(res.status).toBe(400);
  });
});
