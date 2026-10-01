// @vitest-environment node
/**
 * Sorting a folder of keys into something the store may trust.
 *
 * The corpus was measured at 3,287 lines with no provider written beside almost any key,
 * mixed with report lines (`404=`) and links. These are the rules that decide which company
 * a key belongs to — and the rule that a shape nobody wears is kept unclassified instead of
 * guessed, because a wrong label sends a customer's question to somebody else's service.
 */
import { describe, expect, it } from "vitest";

import { classifyKey, intakeCorpus, keysFromLine } from "@/lib/ops/key-intake";

const body = (n: number) => "a1".repeat(Math.ceil(n / 2)).slice(0, n);
const token = (prefix: string) => `${prefix}${body(40)}`;

describe("the prefix decides the provider", () => {
  it("reads the families the folder actually contains", () => {
    const cases: [string, string][] = [
      [token("sk-or-v1-"), "openrouter"],
      [token("sk-ant-"), "anthropic"],
      [token("sk-proj-"), "openai"],
      [token("sk-cp-"), "cerebras"],
      [token("gsk_"), "groq"],
      [token("AIza"), "google"],
      [token("tgp_"), "together"],
      [token("xai-"), "xai"],
      [token("AQ."), "cohere"],
      [token("apf_"), "apifreellm"],
      [token("hf_"), "huggingface"],
      [token("nvapi-"), "nvidia"],
    ];
    for (const [value, provider] of cases) {
      expect(classifyKey(value).provider, value.slice(0, 9)).toBe(provider);
    }
  });

  it("lets the longest prefix win, so an OpenRouter key is not filed as OpenAI", () => {
    expect(classifyKey(token("sk-or-")).provider).toBe("openrouter");
    expect(classifyKey(token("sk-")).provider).toBe("unknown");
    expect(classifyKey(token("sk-")).rejected).toContain("not knowable");
  });
});

describe("what is not a key", () => {
  it("refuses the report lines and the links the folder also carries", () => {
    for (const junk of ["404=", "157=2", "https://api.groq.com/openai/v1", "the-quick-brown-fox-jumps", token("gsk_").slice(0, 12), ""]) {
      const found = classifyKey(junk);
      expect(found.provider, junk).toBeNull();
      expect(found.rejected, junk).toBeTruthy();
    }
  });

  it("keeps an unknown prefix rather than guessing a company", () => {
    const found = classifyKey(token("zzz-"));
    expect(found.provider).toBeNull();
    expect(found.rejected).toContain("no provider wears this prefix");
  });
});

describe("the corpus pass", () => {
  it("counts a key once, whatever files it appears in", () => {
    const groq = token("gsk_");
    const result = intakeCorpus([
      `groq: ${groq}`,
      groq,
      `${token("AIza")} extra`,
      "https://api.groq.com/openai/v1/models",
      "404=",
    ]);
    expect(result.duplicates, "the same key in two files is one key").toBe(1);
    expect(result.byProvider.groq).toBe(1);
    expect(result.byProvider.google).toBe(1);
    // A link is long enough to be a token, so it is refused out loud; `404=` never becomes
    // a token at all and is not counted as a decision.
    expect(result.rejected).toBe(1);
  });

  it("pulls the key out of a labelled line", () => {
    const line = `openrouter sk-or-v1-${body(40)}`;
    // The label is too short to be a key, so only the key survives the split.
    const found = keysFromLine(line);
    expect(found).toHaveLength(1);
    expect(classifyKey(found[0]).provider).toBe("openrouter");
  });

  it("never returns a provider for a rejected token, so nothing is inserted mislabelled", () => {
    for (const row of intakeCorpus(["junk-line-123456789012345", token("gsk_")]).rows) {
      if (row.rejected) expect(row.provider).toBeNull();
    }
  });
});
