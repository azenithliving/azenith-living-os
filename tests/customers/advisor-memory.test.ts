// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { SOURCES, factsFromHisWords, memoryLine, memorySentence } from "@/lib/customers/memory-words";

/**
 * The advisor answering a returning customer from what the shop already keeps.
 *
 * Measured 2026-10-15: 150 conversations, 0 taste facts in the memory, because the door that was
 * supposed to hold a profile wrote to a table whose columns it never had and printed nothing when the
 * record refused. These guards hold the replacement: his memory is read before the answer is built,
 * written from HIS lines only, and spoken in the same three words on every surface.
 */
const door = readFileSync("app/api/consultant/route.ts", "utf8");
const words = readFileSync("lib/customers/memory-words.ts", "utf8");

describe("what his own words carry", () => {
  it("names only what the conversation's readers already found, in his words' own source", () => {
    const facts = factsFromHisWords({ style: "modern", area: "التجمع", roomType: "living-room" });
    expect(facts.map((f) => f.kind).sort()).toEqual(["area", "room", "style"]);
    for (const fact of facts) {
      expect(fact.source).toBe(SOURCES.advisorWords);
      expect(fact.evidence).toContain("قالها في كلامه");
    }
  });

  it("a conversation that named nothing writes nothing", () => {
    expect(factsFromHisWords({ style: null, area: "", roomType: undefined })).toEqual([]);
  });

  it("a number a model summarised is not a fact he gave", () => {
    // The readers hand the door area, style and room from his sentences. Anything else — a budget the
    // advisor inferred — must not be stored as his own word, so the helper has no room for it.
    expect(factsFromHisWords({ style: "modern", area: "التجمع", roomType: "living-room", budget: "500000" } as never)).toHaveLength(3);
  });
});

describe("the sentence the shop says about him", () => {
  it("prefixes once, and stays silent when there is nothing to remember", () => {
    expect(memorySentence(null)).toBeNull();
    expect(memorySentence("طرازه مودرن")).toBe("الدار فاكر: طرازه مودرن");
  });

  it("has exactly one owner of the wording", () => {
    expect(words).toContain('export const MEMORY_PREFIX = "الدار فاكر"');
    // His sheet, his chat and any future surface read the constant — none of them retype it.
    const sheet = readFileSync("app/passport/[token]/page.tsx", "utf8");
    expect(sheet).toContain("MEMORY_PREFIX");
    expect(door).toContain("memorySentence(");
  });

  it("the advisor's memory reaches him in the store's Arabic, not in machine keys", () => {
    const line = memoryLine([
      { ...{ kind: "style", value: "modern", source: SOURCES.advisorWords, evidence: null, first_seen_at: "", last_seen_at: "" } },
    ] as never);
    expect(line).toBe("طرازه مودرن");
  });
});

describe("the advisor's door reads his memory before it answers", () => {
  it("recalls under his key and writes back through the same module", () => {
    expect(door).toContain("recallFacts(");
    expect(door).toContain("rememberForPhone(");
    expect(door).toContain("factsFromHisWords(");
  });

  it("reads HIS lines, never the advisor's", () => {
    // The store's own answer to «بتوصلوا فين؟» recites every district it works in, and its WhatsApp
    // number is in the facts block — a reader allowed to see those would key a stranger's memory to
    // the shop itself.
    expect(door).toMatch(/readContactFrom\(\s*conversationHistory\.filter\(\(m\) => m\.role === "user"\)/);
    expect(door).toContain('readContactFrom(hisWords.join(" "))');
    expect(door).not.toContain("readContactFrom(conversation)");
  });

  it("echoes only what the shop knew BEFORE this conversation", () => {
    expect(door).toContain("existingSession?.created_at");
    expect(door).toContain("Date.parse(row.first_seen_at)");
  });

  it("the memory is a block of its own, not one of the manager's learnings", () => {
    expect(door).toContain("memoryBlock?: string");
    expect(door).toContain("if (memoryBlock)");
    expect(door).not.toContain("allLearnings.push(profileContext)");
  });

  it("the dead preference table is not read or written here any more", () => {
    expect(door).not.toContain("storeUserPreference");
    expect(door).not.toContain("getUserPreferences");
    expect(door).not.toMatch(/from\("user_preferences"\)/);
  });
});

describe("the promise holds without a model", () => {
  it("the floor reply carries his memory, not only an apology", () => {
    // Every model key removed must still cost him an answer, never his history: the sentence is built
    // from the record, in this door, before any provider is asked.
    expect(door).toMatch(/rememberedLine \? `\$\{rememberedLine\}\\n` : ""/);
    expect(door).toContain("${remembered}${buildHumanTemporaryFailureReply(language)}");
  });

  it("the number he types is answered from the memory in the same breath", () => {
    expect(door).toMatch(/rememberedLine \? `\$\{rememberedLine\}\\n\$\{confirmation\}` : confirmation/);
  });

  it("a skipped memory says why instead of saying nothing", () => {
    expect(door).toContain("مفيش رقم في كلامه");
    expect(door).toContain("الذاكرة ما اتقريتش");
  });
});
