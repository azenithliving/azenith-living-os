// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

import { bankTypeForRoom } from "@/lib/cad/sheet-images";
import { BASE_ROOMS, STYLE_LABELS } from "@/lib/constants/rooms";

/**
 * One room, one picture owner.
 *
 * Measured 2026-10-11: the storefront asked an external photo service once per room on every visit,
 * with a random page offset in the query, so the same living room showed one picture to one visitor
 * and another on reload — while the store's own bank held 7,805 active pictures of those rooms and all
 * 38 of its (room, style) cells loaded when probed. These guards hold the three things that make the
 * new source honest: it is asked, it is preferred, and it never claims a room it does not have.
 */

const client = readFileSync("components/home-page-client-fixed.tsx", "utf8");
const door = "app/api/room-covers/route.ts";
const migration = readFileSync("supabase/migrations/20261011_d_room_covers_by_style.sql", "utf8");

/** The rooms the storefront shows, in the order it shows them. */
const HOME_ROOMS = [...BASE_ROOMS.map((room) => room.slug), "interior-design"];

describe("which rooms the bank really stands behind", () => {
  it("answers the rooms it holds, in the bank's own words", () => {
    expect(bankTypeForRoom("living-room")).toBe("living-room");
    expect(bankTypeForRoom("master-bedroom")).toBe("master-bedroom");
    expect(bankTypeForRoom("corner-sofa")).toBe("corner-sofa");
    expect(bankTypeForRoom("teen-room")).toBe("teen-room");
  });

  it("knows the storefront's whole-house card is the bank's general set", () => {
    expect(bankTypeForRoom("interior-design")).toBe("comprehensive-interior");
  });

  it("refuses to dress a room it does not hold in a house picture", () => {
    // These five are named by the storefront and absent from the bank's vocabulary: the page must
    // fall back for them, not borrow a picture of something else.
    for (const room of ["guest-bedroom", "study-room", "bathroom", "guest-bathroom", "entrance-lobby"]) {
      expect(bankTypeForRoom(room), room).toBeNull();
    }
  });

  it("keeps the difference between a named room and an empty one", () => {
    // `home-office` is a bank type the harvester never filled (measured: zero rows), so a name in the
    // vocabulary is not a picture. The door asks for it and the bank simply does not answer.
    expect(bankTypeForRoom("home-office")).toBe("home-office");
    const covered = HOME_ROOMS.filter((room) => bankTypeForRoom(room));
    expect(covered).toEqual([
      "living-room",
      "dining-room",
      "kitchen",
      "master-bedroom",
      "children-room",
      "teen-room",
      "dressing-room",
      "home-office",
      "corner-sofa",
      "lounge",
      "interior-design",
    ]);
  });

  it("names the styles the storefront switches between in the same words the bank stores", () => {
    // The bank's four styles were measured as modern / classic / industrial / scandinavian; the switcher
    // must use those keys or every cover lookup silently misses.
    expect(Object.keys(STYLE_LABELS).sort()).toEqual(["classic", "industrial", "modern", "scandinavian"]);
  });
});

describe("the storefront asks its own bank first", () => {
  it("has a door that reads the bank", () => {
    expect(existsSync(door), door).toBe(true);
    const source = readFileSync(door, "utf8");
    expect(source).toContain('pickRoomCovers(rooms)');
    expect(source).toContain("BASE_ROOMS.map((room) => room.slug)");
  });

  it("is the page's first source, and the external query is only the fallback", () => {
    expect(client).toContain('fetch("/api/room-covers")');
    expect(client).toContain("bankForStyle[room.slug]");
    // The dead CMS step (section images keyed by a slug nothing matched) is gone from this path.
    expect(client).not.toContain("fetch('/api/room-sections'");
    // The random page must come after the bank check, never instead of it.
    expect(client.indexOf("if (bankForStyle[room.slug])")).toBeLessThan(client.indexOf("Math.random()"));
  });

  it("does not cache a bank that failed as an empty one", () => {
    expect(client).toMatch(/catch\(\(\) => \{\s*\n\s*\/\/[^\n]*\n\s*coversPromise = null;/);
  });

  it("keeps the bank's covers on screen while the rest load", () => {
    expect(client).toContain("setRoomImages((current) => ({ ...current, ...bankForStyle }))");
    // The old line wiped every picture before refetching, which is what made cards blink to placeholders.
    expect(client).not.toMatch(/const fetchRoomImages = async \(\) => \{\s*\n\s*setRoomImages\(\{\}\);/);
  });
});

describe("the cover pick is decided by data, and the same way every time", () => {
  it("orders by the score that exists, then the bank's own slot, then the id", () => {
    expect(migration).toContain("(c.metadata ->> 'ai_score')::numeric desc nulls last");
    expect(migration).toContain("c.display_order asc");
    expect(migration).toContain("c.id asc");
    // `quality_score` is 0.00 in all 7,805 rows, so it must not be what a cover is chosen by.
    expect(migration).not.toContain("quality_score");
  });

  it("is one picture per room and style, and only for rooms the bank holds", () => {
    expect(migration).toContain("distinct on (c.room_type, c.style)");
    expect(migration).toContain("c.is_active");
    expect(migration).toContain("c.room_type = any (p_types)");
    expect(migration).toContain("(p_style is null or c.style = p_style)");
  });

  it("is reachable by the store's own code and by no stranger", () => {
    expect(migration).toContain("grant execute on function public.pick_room_covers(text[], text) to service_role");
    expect(migration).toContain("revoke all on function public.pick_room_covers(text[], text) from public, anon, authenticated");
  });

  it("adds a function without deleting anything", () => {
    // The first version of this function cannot be rewritten in place (Postgres refuses a return-type
    // change), and dropping a database object is the owner's word, not the agent's — so the new
    // signature was added beside it.
    expect(migration).not.toMatch(/\bdrop\b/i);
    expect(migration).not.toMatch(/delete\s+from/i);
    expect(migration).toContain("create or replace function public.pick_room_covers(p_types text[], p_style text)");
  });
});
