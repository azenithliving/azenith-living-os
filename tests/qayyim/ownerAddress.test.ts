// @vitest-environment node
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, it, expect } from "vitest";
import { OWNER_ADDRESS_RULE, withOwnerRule, withOwnerRuleOnMessages } from "@/lib/qayyim/owner-address";

/**
 * The owner is a man — المهندس علاء عزيز. Two separate defects earned this file:
 * feminine Arabic copy shipped inside the admin UI, and the swarm replying to him
 * as «انتِ» because nothing in any prompt said otherwise. Both are cheap to
 * re-introduce, so the guard is a test rather than a memory.
 */

const ROOTS = ["app", "components", "lib"].map((d) => join(process.cwd(), d));

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const ALL_SOURCES = ROOTS.flatMap(sources);
const show = (f: string) => relative(process.cwd(), f).replace(/\\/g, "/");

/** Unambiguous 2nd-person-female markers. «قولي» / «بتاعك» are deliberately NOT
 * here: in Egyptian those are masculine imperative + «-li», not feminine.
 * Matched at a word start only — «مفعّلين» (enabled) and «المعاملة» (transaction)
 * contain a marker as a substring and are not the bug, while «تفتحيه» is. */
const FEMININE_MARKERS = [
  "انتِ",
  "انتي",
  "لكِ",
  "إنكِ",
  "تفتحي",
  "افتحي",
  "ادخلي",
  "اختاري",
  "شغّلي",
  "فعّلي",
  "احفظي",
  "راجعي",
  "حاولي",
  "جرّبي",
  "شايفة",
  "عاملة",
  "تدّعي",
  "تتحكّمي",
  "تكسبي",
  "بتدفعي",
  "موجودة لك",
];

/**
 * Matched at a word start — or right after a conjunction/prefix letter, because
 * «بتتفتحيه» is the same mistake wearing a «ب». «المعاملة» (transaction) and
 * «مفعّلين» (enabled) stay legitimate: their extra letter is «م», which never
 * prefixes a verb.
 *
 * This list is a net, not a grammar. It cannot catch a form nobody has typed
 * here yet, so new Arabic copy addressed to the owner is still reviewed by eye.
 */
const asWord = (m: string) => new RegExp(`(?:^|(?<![\\p{L}])|(?<=[بتولف]))${m}`, "u");

describe("owner copy is masculine", () => {
  it.each(FEMININE_MARKERS)("no source addresses the owner with %s", (marker) => {
    const re = asWord(marker);
    const hits = ALL_SOURCES.filter((f) => re.test(readFileSync(f, "utf8"))).map(show);
    expect(hits).toEqual([]);
  });
});

describe("withOwnerRule", () => {
  it("appends the addressing rule to a persona prompt", () => {
    const out = withOwnerRule("أنت قيّم الدار - القائد.");
    expect(out).toContain("أنت قيّم الدار - القائد.");
    expect(out).toContain(OWNER_ADDRESS_RULE);
  });

  it("adds it once, no matter how many layers wrap the prompt", () => {
    const twice = withOwnerRule(withOwnerRule("دورك كذا"));
    expect(twice.split(OWNER_ADDRESS_RULE)).toHaveLength(2);
  });

  it("names the owner and forbids the feminine", () => {
    expect(OWNER_ADDRESS_RULE).toContain("علاء");
    expect(OWNER_ADDRESS_RULE).toContain("مذكر");
  });

  it("touches only the system turn of a message list", () => {
    const msgs = [
      { role: "system", content: "أنت Ops." },
      { role: "user", content: "افحص الموقع" },
    ];
    const out = withOwnerRuleOnMessages(msgs);
    expect(out[0].content).toContain(OWNER_ADDRESS_RULE);
    expect(out[1].content).toBe("افحص الموقع");
  });

  /** The rule only works if it reaches the model. Both prose-generating seams
   * must route their system turn through it. */
  it.each([
    "lib/agents/AgentOrchestrator.ts",
    "lib/qayyim/QayyimAgentBase.ts",
  ])("%s applies the rule before calling the model", (file) => {
    const src = readFileSync(join(process.cwd(), file), "utf8");
    expect(src).toContain("withOwnerRuleOnMessages");
  });
});
