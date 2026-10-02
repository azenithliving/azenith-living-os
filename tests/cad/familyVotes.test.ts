import { readFileSync } from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The family's vote desk.
 *
 * The room is only real if a tap lands in the store's record and a second tap changes it
 * instead of doubling it, so the door is exercised against a fake that behaves like the table:
 * one row per (sheet, picture, voter), and a write that can refuse.
 */
const world = {
  sketch: { id: 7, customer_key: null } as { id: number; customer_key: string | null } | null,
  votes: [] as any[],
  refuseWrite: false,
};

function fakeClient() {
  return {
    from(table: string) {
      if (table === "room_sketches") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: world.sketch, error: null }) }) }),
        };
      }
      return {
        select: () => ({
          eq: () => ({ order: () => ({ limit: async () => ({ data: world.votes, error: null }) }) }),
        }),
        upsert: async (row: any) => {
          if (world.refuseWrite) return { error: { message: "refused" } };
          const at = world.votes.findIndex(
            (v) => v.sketch_id === row.sketch_id && v.image_key === row.image_key && v.voter === row.voter
          );
          if (at >= 0) world.votes[at] = { ...world.votes[at], ...row };
          else world.votes.push(row);
          return { error: null };
        },
      };
    },
  } as never;
}

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => fakeClient() }));

const { GET, POST } = await import("@/app/api/passport/[token]/votes/route");
const { imageKeyOf, cleanVoter, tallyVotes, topPicks } = await import("@/lib/cad/vote-keys");

const TOKEN = "abcdefghij_klmnop123456";

const asRequest = (body: unknown) =>
  new Request(`http://localhost/api/passport/${TOKEN}/votes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];

const params = { params: Promise.resolve({ token: TOKEN }) };

beforeEach(() => {
  world.sketch = { id: 7, customer_key: null };
  world.votes = [];
  world.refuseWrite = false;
});

describe("a picture's key survives the bank", () => {
  it("uses the bank id when the bank still holds the picture", () => {
    expect(imageKeyOf({ id: 1234, url: "https://x/a.jpg" })).toBe("i1234");
  });

  it("falls back to the address, stably and differently per picture", () => {
    const one = imageKeyOf({ id: null, url: "https://x/a.jpg" });
    expect(one).toMatch(/^u/);
    expect(imageKeyOf({ id: null, url: "https://x/a.jpg" })).toBe(one);
    expect(imageKeyOf({ id: null, url: "https://x/b.jpg" })).not.toBe(one);
  });
});

describe("a voter's label is one safe line", () => {
  it("keeps a normal name", () => {
    expect(cleanVoter("مراتي")).toBe("مراتي");
    expect(cleanVoter("  أحمد  ")).toBe("أحمد");
  });

  it("strips markup and control characters, and caps the length", () => {
    expect(cleanVoter('سارة"><script>')).not.toMatch(/[<>"]/);
    expect(cleanVoter("ا\n\nب")).toBe("ا ب");
    expect(cleanVoter("ط".repeat(80))).toHaveLength(24);
  });

  it("never loses a tap over an empty name", () => {
    expect(cleanVoter("   ")).toBe("ضيف");
  });
});

describe("the tally counts a decision, not a click stream", () => {
  const rows = [
    { image_key: "i1", image_url: "u1", voter: "أنا", liked: true, updated_at: "1" },
    { image_key: "i1", image_url: "u1", voter: "مراتي", liked: true, updated_at: "2" },
    { image_key: "i2", image_url: "u2", voter: "أنا", liked: false, updated_at: "3" },
    { image_key: "i3", image_url: "u3", voter: "أحمد", liked: true, updated_at: "4" },
  ];

  it("counts only likes", () => {
    const tallies = tallyVotes(rows);
    expect(tallies.find((t) => t.image_key === "i1")?.likes).toBe(2);
    expect(tallies.find((t) => t.image_key === "i2")?.likes).toBe(0);
  });

  it("orders by what the family agreed on", () => {
    expect(tallyVotes(rows).map((t) => t.image_key)).toEqual(["i1", "i3", "i2"]);
  });

  it("leads the owner's desk with liked pieces only", () => {
    expect(topPicks(tallyVotes(rows)).map((t) => t.image_key)).toEqual(["i1", "i3"]);
  });
});

describe("the vote door answers only for its own sheet", () => {
  it("reads an empty room without inventing anything", async () => {
    const res = await GET({} as never, params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.tallies).toEqual([]);
    expect(body.people).toEqual([]);
  });

  it("stores a tap and reads it back", async () => {
    const res = await POST(asRequest({ image_key: "i10", image_url: "https://x/10.jpg", voter: "مراتي", liked: true }), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.tallies).toEqual([{ image_key: "i10", url: "https://x/10.jpg", likes: 1, voters: ["مراتي"] }]);
    expect(body.people).toEqual(["مراتي"]);
  });

  it("changes a mind instead of adding a second vote", async () => {
    await POST(asRequest({ image_key: "i10", voter: "مراتي", liked: true }), params);
    const res = await POST(asRequest({ image_key: "i10", voter: "مراتي", liked: false }), params);
    const body = await res.json();
    expect(world.votes).toHaveLength(1);
    expect(body.tallies[0].likes).toBe(0);
  });

  it("refuses a tap with no picture, an unreadable body, and a bad address", async () => {
    expect((await POST(asRequest({ voter: "أنا" }), params)).status).toBe(400);
    const broken = new Request(`http://localhost/api/passport/${TOKEN}/votes`, {
      method: "POST",
      body: "{not json",
    }) as unknown as Parameters<typeof POST>[0];
    expect((await POST(broken, params)).status).toBe(400);
    const bad = { params: Promise.resolve({ token: "short" }) };
    expect((await POST(asRequest({ image_key: "i1", voter: "أنا" }), bad)).status).toBe(400);
  });

  it("says so when the record refuses the write, in words the customer reads", async () => {
    world.refuseWrite = true;
    const res = await POST(asRequest({ image_key: "i10", voter: "أنا", liked: true }), params);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe("المتجر ما سجلش الصوت");
  });

  it("does not speak for a sheet that is not there", async () => {
    world.sketch = null;
    const res = await GET({} as never, params);
    expect(res.status).toBe(404);
  });
});

describe("the room is wired where the customer stands", () => {
  const page = readFileSync("app/passport/[token]/page.tsx", "utf8");

  it("puts a handle on every vote control the family taps", () => {
    expect(page).toContain("data-family-room");
    expect(page).toContain("data-family-name");
    expect(page).toContain("data-family-vote={key}");
    expect(page).toContain("data-family-count={key}");
    expect(page).toContain("aria-pressed={mine}");
  });

  it("keeps the sheet's own address as the only login", () => {
    expect(page).toContain("`/api/passport/${token}/votes`");
    expect(page).not.toMatch(/type="password"|signIn|useAuth|login\(/);
  });

  it("asks again on a rhythm a family of five on one connection can hold", () => {
    expect(page).toContain("setInterval(load, 20000)");
    expect(page).toContain("document.hidden");
  });

  it("does not let a poll paint a count back to what it was while a tap is in the air", () => {
    // Measured on the published site 2026-10-03: the first reader caught the picture with no
    // number at all, because a poll answered before the write landed.
    expect(page).toContain("if (votingRef.current) return;");
    expect(page).toContain("votingRef.current = key;");
    expect(page).toContain("votingRef.current = null;");
  });

  it("stores the table with one row per sheet, picture and voter, behind row level security", () => {
    const sql = readFileSync("supabase/migrations/20261002_d_family_votes.sql", "utf8");
    expect(sql).toContain("unique (sketch_id, image_key, voter)");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("references public.room_sketches");
  });

  it("limits the door a stranger can open with a long address", () => {
    expect(readFileSync("lib/rate-limit.ts", "utf8")).toContain('"/api/passport"');
  });

  it("keeps the database out of the bundle the customer's phone runs", () => {
    // Measured the moment the two lived in one import: the private sheet page answered 500 with
    // `supabase-admin` sitting in the client component stack.
    expect(page).toContain("from '@/lib/cad/vote-keys'");
    expect(page).not.toContain("cad/family-votes");
    expect(readFileSync("lib/cad/vote-keys.ts", "utf8")).not.toMatch(/^import[^\n]*supabase/m);
  });
});

describe("the votes reach the owner's desk", () => {
  const door = readFileSync("app/api/admin/customers/dossier/route.ts", "utf8");
  const panel = readFileSync("components/admin/ClientPreCallDossier.tsx", "utf8");

  it("reads every paper the customer owns and hands the votes to the file", () => {
    expect(door).toContain("readVotesForSketches(papers.map(");
    expect(door).toContain("votes,");
  });

  it("paints the chosen pictures with who chose them, under a handle an instrument can find", () => {
    expect(panel).toContain("data-dossier-picks");
    expect(panel).toContain("data-dossier-picked-picture={pick.url}");
    expect(panel).toContain("القطعة اللي وقفت عليها العائلة");
  });
});
