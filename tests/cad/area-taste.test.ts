import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The ordering desk, measured against a store it can be told to answer from.
 *
 * The tiers are only worth their words if the pictures actually move: this checks that an area's
 * measured colour really re-orders the bank's list, that his own colour outranks the neighbourhood,
 * and that a record which did not answer is reported as unreadable instead of as an empty area.
 */
const world = vi.hoisted(() => {
  const state = {
    papers: [] as any[],
    refuse: false,
    reads: 0,
  };
  const chain = (read: () => any) => {
    const self: any = {
      not: () => self,
      neq: () => self,
      order: () => self,
      limit: () => self,
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
      return {
        select() {
          state.reads++;
          return chain(() =>
            state.refuse
              ? { data: null, error: { message: "السجل ما ردّش" } }
              : { data: table === "room_sketches" ? state.papers : [], error: null },
          );
        },
      };
    },
  });
  return { state, client };
});

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => world.client() as never }));

const { orderForPaper } = await import("@/lib/cad/area-taste");

/** The bank's own order: quality first, so a grey room sits ahead of a wood one. */
const BANK = [
  { id: 1, color: "#8C7D73" },
  { id: 2, color: "#4B3A2F" },
  { id: 3, color: "#8D8070" },
];

const order = (rows: Array<{ id: number }>) => rows.map((r) => r.id).join("-");

beforeEach(() => {
  world.state.papers = [];
  world.state.refuse = false;
  world.state.reads = 0;
});

describe("the strongest real taste wins", () => {
  it("keeps his own picks first, and does not even read the area", async () => {
    const { images, taste } = await orderForPaper(BANK, { id: 10, city: "التجمع", picks: [{ hex: "#8D8070" }] });
    expect(taste.source).toBe("own");
    // His colour is the beige one, so beige leads: a different order from the area's wood colour
    // below, which is what makes the two tiers distinguishable.
    expect(order(images)).toBe("3-1-2");
    expect(world.state.reads).toBe(0);
  });

  it("moves his area's measured colour up when he chose nothing", async () => {
    world.state.papers = [
      { id: 11, customer_city: "التجمع", colour_picks: [{ hex: "#4B3A2F" }] },
      { id: 12, customer_city: "التجمع الخامس", colour_picks: [{ hex: "#4B3A2F" }] },
    ];
    const { images, taste } = await orderForPaper(BANK, { id: 10, city: "التجمع", picks: [] });
    expect(taste.source).toBe("area");
    expect(taste.papers).toBe(2);
    expect(order(images)).toBe("2-1-3");
    expect(taste.line).toContain("ورقتين");
  });

  it("ranks on quality and says so when his area holds no measured paper", async () => {
    world.state.papers = [{ id: 11, customer_city: "الشيخ زايد", colour_picks: [{ hex: "#4B3A2F" }] }];
    const { images, taste } = await orderForPaper(BANK, { id: 10, city: "التجمع", picks: null });
    expect(taste.source).toBe("quality");
    expect(order(images)).toBe("1-2-3");
    expect(taste.line).toContain("منطقة التجمع");
  });

  it("admits a record that did not answer instead of calling the area empty", async () => {
    world.state.refuse = true;
    const { images, taste } = await orderForPaper(BANK, { id: 10, city: "الإسكندرية", picks: [] });
    expect(taste.source).toBe("unreadable");
    expect(taste.line).toContain("ما ردّش");
    expect(order(images)).toBe("1-2-3");
  });

  it("leaves a picture with no measured colour at the end, not treated as a match", async () => {
    world.state.papers = [{ id: 11, customer_city: "التجمع", colour_picks: [{ hex: "#4B3A2F" }] }];
    const { images } = await orderForPaper([...BANK, { id: 4, color: null }], {
      id: 10,
      city: "التجمع",
      picks: [],
    });
    expect(images[images.length - 1]!.id).toBe(4);
    expect(images[images.length - 1]!.near).toBe(false);
  });

  it("counts only the papers of the area he named", async () => {
    world.state.papers = [
      { id: 11, customer_city: "التجمع", colour_picks: [{ hex: "#4B3A2F" }] },
      { id: 12, customer_city: "الرحاب", colour_picks: [{ hex: "#4B3A2F" }] },
      { id: 13, customer_city: "مدينة نصر", colour_picks: [{ hex: "#4B3A2F" }] },
    ];
    const a = await orderForPaper(BANK, { id: 10, city: "التجمع", picks: [] });
    const b = await orderForPaper(BANK, { id: 10, city: "الشيخ زايد", picks: [] });
    expect(a.taste.papers).toBe(1);
    expect(b.taste.papers).toBe(0);
    expect(a.taste.line).not.toBe(b.taste.line);
  });
});
