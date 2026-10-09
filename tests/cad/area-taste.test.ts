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
    visitors: [] as any[],
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
              : {
                  data: table === "room_sketches" ? state.papers : table === "users" ? state.visitors : [],
                  error: null,
                },
          );
        },
      };
    },
  });
  return { state, client };
});

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => world.client() as never }));

const { orderWithTaste, tasteForPaper } = await import("@/lib/cad/area-taste");

/** The bank's own order: quality first, so a grey room sits ahead of a wood one. */
const BANK = [
  { id: 1, color: "#8C7D73" },
  { id: 2, color: "#4B3A2F" },
  { id: 3, color: "#8D8070" },
];

const order = (rows: Array<{ id: number }>) => rows.map((r) => r.id).join("-");

/** The door's own two steps, in the order the doors run them: measure the area, then order. */
async function run<T extends { color: string | null; style?: string | null }>(images: T[], paper: PaperFacts) {
  return orderWithTaste(images, await tasteForPaper(paper));
}

beforeEach(() => {
  world.state.papers = [];
  world.state.visitors = [];
  world.state.refuse = false;
  world.state.reads = 0;
});

describe("the strongest real taste wins", () => {
  it("keeps his own picks first, and does not even read the area", async () => {
    const { images, taste } = await run(BANK, { id: 10, city: "التجمع", picks: [{ hex: "#8D8070" }] });
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
    const { images, taste } = await run(BANK, { id: 10, city: "التجمع", picks: [] });
    expect(taste.source).toBe("area");
    expect(taste.papers).toBe(2);
    expect(order(images)).toBe("2-1-3");
    expect(taste.line).toContain("ورقتين");
  });

  it("ranks on quality and says so when his area holds no measured paper", async () => {
    world.state.papers = [{ id: 11, customer_city: "الشيخ زايد", colour_picks: [{ hex: "#4B3A2F" }] }];
    const { images, taste } = await run(BANK, { id: 10, city: "التجمع", picks: null });
    expect(taste.source).toBe("quality");
    expect(order(images)).toBe("1-2-3");
    expect(taste.line).toContain("منطقة التجمع");
  });

  it("admits a record that did not answer instead of calling the area empty", async () => {
    world.state.refuse = true;
    const { images, taste } = await run(BANK, { id: 10, city: "الإسكندرية", picks: [] });
    expect(taste.source).toBe("unreadable");
    expect(taste.line).toContain("ما ردّش");
    expect(order(images)).toBe("1-2-3");
  });

  it("leaves a picture with no measured colour at the end, not treated as a match", async () => {
    world.state.papers = [{ id: 11, customer_city: "التجمع", colour_picks: [{ hex: "#4B3A2F" }] }];
    const { images } = await run([...BANK, { id: 4, color: null }], {
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
    const a = await run(BANK, { id: 10, city: "التجمع", picks: [] });
    const b = await run(BANK, { id: 10, city: "الشيخ زايد", picks: [] });
    expect(a.taste.papers).toBe(1);
    expect(b.taste.papers).toBe(0);
    expect(a.taste.line).not.toBe(b.taste.line);
  });
});

/** The bank as it really is: every picture filed under one of its four style keys. */
const STYLED = [
  { id: 1, color: "#8C7D73", style: "classic" },
  { id: 2, color: "#4B3A2F", style: "modern" },
  { id: 3, color: "#8D8070", style: "classic" },
];
const styledOrder = (rows: Array<{ id: number }>) => rows.map((r) => r.id).join("-");

describe("the area's taste is counted from both doors that hold it", () => {
  it("moves his area's requested style up even when no paper carries a colour", async () => {
    world.state.visitors = [
      // Both shapes exist in the table: the key this store writes, and the Arabic a form stored.
      { area: "التجمع", style: "modern" },
      { area: "الشيخ زايد", style: "كلاسيك" },
    ];
    const { images, taste } = await run(STYLED, { id: 10, city: "التجمع", picks: [] });
    expect(taste.source).toBe("area");
    expect(taste.visitors).toBe(1);
    expect(taste.styles).toEqual(["مودرن"]);
    expect(styledOrder(images)).toBe("2-1-3");
    expect(taste.line).toContain("زائر واحد");
    expect(taste.line).toContain("مودرن");

    // The same pictures, the other area: its visitor asked for classic, so the list flips.
    const other = await run(STYLED, { id: 11, city: "الشيخ زايد", picks: [] });
    expect(styledOrder(other.images)).toBe("1-3-2");
  });

  it("ignores a visitor row whose style is a screen slug, not a taste", async () => {
    world.state.visitors = [{ area: "التجمع", style: "elite-brief" }];
    const { taste } = await run(STYLED, { id: 10, city: "التجمع", picks: [] });
    expect(taste.source).toBe("quality");
    expect(taste.visitors).toBe(0);
    expect(taste.line).toContain("لسه مفيش ورق مسجّل لمنطقة التجمع");
  });

  it("names both doors when both measured something", async () => {
    world.state.papers = [{ id: 21, customer_city: "التجمع", colour_picks: [{ hex: "#4B3A2F" }] }];
    world.state.visitors = [
      { area: "التجمع", style: "كلاسيك" },
      { area: "التجمع", style: "كلاسيك" },
    ];
    const { images, taste } = await run(STYLED, { id: 10, city: "التجمع", picks: [] });
    expect(taste.source).toBe("area");
    expect(taste.papers).toBe(1);
    expect(taste.visitors).toBe(2);
    expect(taste.line).toContain("ألوان ورقة عميل واحد");
    expect(taste.line).toContain("طراز زائرَين");
    // Style leads, colour orders inside it: the two classic pictures first, nearest colour first.
    expect(styledOrder(images)).toBe("1-3-2");
  });

  it("does not claim a style the bank cannot show for his room", async () => {
    // BANK carries no style at all, so a requested «modern» moved nothing.
    world.state.visitors = [{ area: "التجمع", style: "modern" }];
    const { images, taste } = await run(BANK, { id: 10, city: "التجمع", picks: [] });
    expect(taste.source).toBe("quality");
    expect(order(images)).toBe("1-2-3");
    expect(taste.line).toContain("مالقاش صورة");
    expect(taste.line).not.toContain("محسوب من");
  });

  it("keeps the colours it did order by, and names the style it could not", async () => {
    world.state.papers = [{ id: 21, customer_city: "التجمع", colour_picks: [{ hex: "#4B3A2F" }] }];
    world.state.visitors = [{ area: "التجمع", style: "scandinavian" }];
    const { images, taste } = await run(STYLED, { id: 10, city: "التجمع", picks: [] });
    expect(taste.source).toBe("area");
    expect(taste.line).toContain("محسوب من ألوان ورقة عميل واحد");
    expect(taste.line).not.toContain("طراز زائر");
    expect(taste.line).toContain("بس مفيش منه صورة");
    // Colour ordered the list: the wood-toned picture leads, exactly as without the style.
    expect(styledOrder(images)).toBe("2-1-3");
  });
});
