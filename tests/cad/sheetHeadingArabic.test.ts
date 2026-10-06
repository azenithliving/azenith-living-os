// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

/**
 * The one word a customer reads at the top of his sheet.
 *
 * Measured 2026-10-06 while proving the visit counter: a browser opened a sheet whose `room` row
 * held the bank's own key, and the page printed «living-room» in Latin above his paper. Every row
 * the store holds today is Arabic (26 of 26 measured), so nothing is broken on a real customer —
 * but the sheet's room is written from two places, and the customer's own room chips carry the
 * bank key. The heading must therefore be said in his Arabic wherever it came from.
 */
const TOKEN = "abcdefghij_klmnop123456";

const world = vi.hoisted(() => ({ room: null as string | null }));

function fakeClient() {
  const chain = (read: () => any) => {
    const self: any = {
      select: () => self,
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

  return {
    from(table: string) {
      if (table === "room_sketches") {
        return chain(() => ({
          data: {
            id: 7,
            token: TOKEN,
            room: world.room,
            dimensions: [],
            openings: [],
            area_sqm: null,
            confirmed_count: 0,
            ok: true,
            failure: null,
            confirmed_at: null,
            frozen_hash: null,
            customer_dimensions: null,
            plan: null,
            colour_picks: [],
            customer_key: null,
            customer_city: null,
          },
          error: null,
        }));
      }
      return chain(() => ({ data: [], error: null }));
    },
    rpc: async () => ({ data: 1, error: null }),
  } as never;
}

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => fakeClient() }));

const { GET } = await import("@/app/api/passport/[token]/route");

const params = { params: Promise.resolve({ token: TOKEN }) };
const readSheet = async () => {
  const res = await GET(new Request(`http://localhost/api/passport/${TOKEN}`) as never, params);
  return { status: res.status, body: await res.json() };
};

describe("the heading of his sheet", () => {
  /**
   * Asserted against the word the chip he tapped carries, not a string frozen here: the customer
   * must read one name for his room on both controls, and pinning one module's wording would let
   * the other drift while the test stayed green.
   */
  it("says the bank's room key in his Arabic, not in the key", async () => {
    const { ROOM_CHOICES } = await import("@/lib/cad/room-labels");
    world.room = "living-room";
    const { body } = await readSheet();
    expect(body.sheet.room).toBe(ROOM_CHOICES.find((c) => c.type === "living-room")?.label);
    expect(String(body.sheet.room).match(/[A-Za-z]/g) ?? []).toEqual([]);
  });

  it("leaves a room the paper already named exactly as it is", async () => {
    world.room = "مجلس رجال";
    const { body } = await readSheet();
    expect(body.sheet.room).toBe("مجلس رجال");
  });

  it("keeps the page's own fallback when the paper named no room", async () => {
    world.room = null;
    const { body } = await readSheet();
    expect(body.sheet.room).toBeNull();
  });

  it("does not carry an unreadable Latin word onto his screen", async () => {
    world.room = "zone-7b";
    const { body } = await readSheet();
    expect(body.sheet.room).toBeNull();
  });
});
