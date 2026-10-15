// @vitest-environment node
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

import {
  KIND_LABELS,
  MEMORY_KINDS,
  SOURCES,
  factsFromPaper,
  memoryLine,
  ownerMemoryFacts,
  type MemoryRow,
} from "@/lib/customers/memory-words";

/**
 * The customer memory, pinned to the record.
 *
 * Measured 2026-10-15: the store had never kept a single taste fact about a person — the old preference
 * table was written by code naming six columns it does not have, every write was refused, and the
 * refusal was swallowed. These guards keep the replacement honest: one kind list shared with the
 * database constraint, facts only from what he himself gave, and the two surfaces that must speak.
 */
const MIGRATION = "supabase/migrations/20261015_b_customer_memory.sql";
const server = readFileSync("lib/customers/memory.ts", "utf8");
const words = readFileSync("lib/customers/memory-words.ts", "utf8");

const row = (kind: MemoryRow["kind"], value: string, first = "2026-10-01T10:00:00Z"): MemoryRow => ({
  kind,
  value,
  source: SOURCES.sheetColours,
  evidence: null,
  first_seen_at: first,
  last_seen_at: first,
});

describe("the kinds the store keeps", () => {
  it("the migration exists", () => {
    expect(existsSync(MIGRATION), "the memory table has to be a migration, not a one-off command").toBe(true);
  });

  it("is exactly the list the database allows", () => {
    const allowed = [...readFileSync(MIGRATION, "utf8").matchAll(/kind in \(([^)]*)\)/g)].map((m) => m[1]);
    expect(allowed.length, "the check constraint exists").toBeGreaterThan(0);
    const fromSql = allowed[0].split(",").map((s) => s.trim().replace(/'/g, "")).sort();
    expect(fromSql, fromSql.join(",")).toEqual([...MEMORY_KINDS].sort());
  });

  it("every kind has an Arabic label of its own, with no machine word in it", () => {
    for (const kind of MEMORY_KINDS) {
      const label = KIND_LABELS[kind];
      expect(label?.length, kind).toBeGreaterThan(0);
      expect(label).not.toMatch(/[A-Za-z]/);
    }
    for (const source of Object.values(SOURCES)) expect(source).not.toMatch(/[A-Za-z]{3,}/);
  });
});

describe("what the store says about him", () => {
  it("names his taste in his own words, and reads the machine keys through the shop's maps", () => {
    const line = memoryLine([row("style", "modern"), row("colour", "grey"), row("colour", "warmBeige"), row("area", "التجمع")]);
    expect(line).toBe("طرازه مودرن · ألوانه رمادي وبيج دافئ · منطقته التجمع");
  });

  it("says nothing when nothing is stored — the caller prints the gap instead", () => {
    expect(memoryLine([])).toBeNull();
    expect(ownerMemoryFacts([])).toEqual([]);
  });

  it("does not repeat one fact twice, and does not invent a kind nobody recorded", () => {
    const facts = ownerMemoryFacts([row("colour", "grey"), row("colour", "grey"), row("budget", "ميزانية مفتوحة")]);
    expect(facts).toHaveLength(2);
    expect(facts[0]).toEqual({ label: "ألوانه", value: "رمادي", source: SOURCES.sheetColours });
    expect(facts[1]).toEqual({ label: "ميزانيته", value: "ميزانية مفتوحة", source: SOURCES.sheetColours });
  });

  it("reads a paper's own facts, and produces none from a paper that says nothing", () => {
    expect(factsFromPaper({ room: "living-room", customer_city: "الشيخ زايد", colour_picks: [{ family: "wood" }] })).toEqual([
      { kind: "room", value: "living-room", source: SOURCES.sheetRoom, evidence: "ورقته" },
      { kind: "area", value: "الشيخ زايد", source: SOURCES.sheetArea, evidence: "كتبها على ورقته" },
      { kind: "colour", value: "wood", source: SOURCES.sheetColours, evidence: "اختاره على ورقته" },
    ]);
    expect(factsFromPaper({ room: null, customer_city: null, colour_picks: [] })).toEqual([]);
  });
});

describe("the memory cannot be reached without the store", () => {
  it("the half that opens the record is server-only, and the words are not", () => {
    expect(server).toContain('import "server-only"');
    // The words file explains the split, so only an actual import counts.
    expect(words).not.toContain('import "server-only"');
    expect(words).not.toContain("supabase");
  });

  it("the writer names the key it refuses instead of storing a stranger", () => {
    expect(server).toContain("parseSketchLink(customerKey)");
    expect(server).toContain("الرقم المكتوب مش موبايل مصري");
    expect(server).toMatch(/stored \$\{stored\}/);
  });

  it("the old broken store is not written to any more", () => {
    // Its name appears in the reason this file exists; it must not appear in a query.
    expect(server).not.toContain('from("user_preferences")');
    expect(words).not.toContain('from("user_preferences")');
  });
});

describe("the doors that produce it and the surfaces that read it", () => {
  it("his colour picks and his contact line both write under his key", () => {
    for (const door of ["app/api/passport/[token]/colours/route.ts", "app/api/passport/[token]/contact/route.ts"]) {
      const source = readFileSync(door, "utf8");
      expect(source, door).toContain("rememberFacts(");
      expect(source, door).toContain("factsFromPaper(");
    }
  });

  it("the elite form writes what he typed there, under the same key", () => {
    expect(readFileSync("app/api/elite-leads/route.ts", "utf8")).toContain("rememberForPhone(");
  });

  it("his own sheet shows what the shop knew BEFORE this paper", () => {
    const passport = readFileSync("app/api/passport/[token]/route.ts", "utf8");
    expect(passport).toContain("recallFacts(");
    expect(passport).toContain("memoryLine(before)");
    expect(readFileSync("app/passport/[token]/page.tsx", "utf8")).toContain("data-customer-memory");
  });

  it("the owner's pre-call file carries a memory section of its own", () => {
    const dossier = readFileSync("app/api/admin/customers/dossier/route.ts", "utf8");
    expect(dossier).toContain("ownerMemoryFacts(");
    expect(dossier).toContain("memory: memoryFacts");
    expect(readFileSync("lib/cad/dossier.ts", "utf8")).toMatch(/id: "who" \| "paper" \| "taste" \| "memory"/);
  });
});
