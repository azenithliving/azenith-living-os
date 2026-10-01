// @vitest-environment node
/**
 * Whose key is this.
 *
 * The pool was measured at 1,241 rows with 1,240 of them written in one batch by an
 * importer nobody can account for. These checks keep the answer to «is it his?» inside one
 * honest rule: a hash prefix decides it, no key value is ever printed, and nothing in the
 * census is allowed to delete what it does not own.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { OWNER_ENV_NAMES, keyFingerprint, ownerFingerprints, provenanceOf } from "@/lib/ops/key-provenance";

describe("the fingerprint", () => {
  it("is short, stable and never the key", () => {
    const print = keyFingerprint("sk-test-abcdef123456");
    expect(print).toHaveLength(12);
    expect(print).toMatch(/^[0-9a-f]{12}$/);
    expect(print).not.toContain("sk-test");
    expect(keyFingerprint("sk-test-abcdef123456")).toBe(print);
    expect(keyFingerprint("sk-test-abcdef123457")).not.toBe(print);
  });

  it("survives a missing value without becoming an empty identity", () => {
    expect(keyFingerprint(undefined)).toBe(keyFingerprint(""));
    expect(keyFingerprint(null)).not.toBe(keyFingerprint("null-ish"));
  });
});

describe("the owner's own keys", () => {
  it("reads a comma pool the way it was pasted", () => {
    const owned = ownerFingerprints("google", { GEMINI_API_KEY: "aaa, bbb ,ccc" } as NodeJS.ProcessEnv);
    expect([...owned].sort()).toEqual([keyFingerprint("aaa"), keyFingerprint("bbb"), keyFingerprint("ccc")].sort());
  });

  it("reads the chunked form too", () => {
    const owned = ownerFingerprints("together", { TOGETHER_API_KEYS_2: "xxx" } as NodeJS.ProcessEnv);
    expect(owned.has(keyFingerprint("xxx"))).toBe(true);
  });

  it("does not credit one provider's key to another", () => {
    const env = { OPENAI_API_KEY: "only-openai" } as NodeJS.ProcessEnv;
    expect(ownerFingerprints("google", env).size).toBe(0);
    expect(ownerFingerprints("openai", env).size).toBe(1);
  });

  it("names only providers the store actually calls", () => {
    expect(Object.keys(OWNER_ENV_NAMES).length).toBeGreaterThan(8);
    for (const [provider, names] of Object.entries(OWNER_ENV_NAMES)) {
      expect(names.length, provider).toBeGreaterThan(0);
      for (const name of names) expect(name, provider).toMatch(/API_KEY/);
    }
  });
});

describe("the census instrument", () => {
  const source = () => readFileSync("scripts/keys-census.mjs", "utf8");

  it("prints no key, and deletes nothing", () => {
    const script = source();
    expect(script).not.toMatch(/console\.[a-z]+\([^)]*row\.key/);
    expect(script).not.toMatch(/\bdelete\b/i);
    expect(script).toMatch(/is_active = false/);
    expect(script).toMatch(/quarantined .* provenance unknown/);
  });

  it("refuses to quarantine a provider whose capability would go dark", () => {
    // The brake: switching off every key he cannot account for would also switch off the
    // capability. Only a provider standing on one of his own keys may be trimmed.
    expect(source()).toMatch(/if \(c\.owner === 0 \|\| c\.unknownIds\.length === 0\)/);
  });
});
