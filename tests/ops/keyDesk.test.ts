// @vitest-environment node
/**
 * The key desk: the list, the guidance, and what it is not allowed to say.
 *
 * The desk exists because the owner asked to see every free model, know how many of his
 * keys answer, and be told in two lines where to get the rest. That makes the copy the
 * product, and the address of each key page a thing he will actually click — so both are
 * checked here, along with the rule that a screen about keys never shows a key.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DESK_NOT_A_MODEL, DESK_UNASKABLE, KEY_DESK_IDS, KEY_DESK_PROVIDERS, deskVerdict, keyDeskGuide } from "@/lib/ops/key-desk";
import { VERIFIABLE_PROVIDERS } from "@/lib/ops/key-verify";

describe("the list of free models", () => {
  it("covers the providers the store actually calls", () => {
    expect(KEY_DESK_IDS.length).toBeGreaterThanOrEqual(10);
    for (const id of ["google", "groq", "openrouter", "cerebras", "together", "cohere", "anthropic"]) {
      expect(KEY_DESK_IDS, id).toContain(id);
    }
  });

  it("tells him something for every model it lists", () => {
    for (const provider of KEY_DESK_PROVIDERS) {
      expect(provider.label, provider.id).toBeTruthy();
      expect(provider.good, provider.id).toContain(" ");
      expect(provider.steps, provider.id).toMatch(/./);
      expect(provider.steps.length, provider.id).toBeGreaterThan(20);
      expect(provider.keysUrl, provider.id).toMatch(/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i);
    }
  });

  it("speaks only his language on the desk", () => {
    for (const provider of KEY_DESK_PROVIDERS) {
      expect(provider.label, provider.id).not.toMatch(/[A-Za-z]/);
      expect(provider.good, provider.id).not.toMatch(/[A-Za-z]{3,}/);
      expect(provider.steps, provider.id).not.toMatch(/[A-Za-z]{6,}/);
    }
    for (const verdict of ["مفيش مفتاح من دول في المتجر", "فيه مفتاح بيجاوب دلوقتي"]) {
      expect(verdict).not.toMatch(/[A-Za-z]/);
    }
  });

  it("knows which providers can be verified and which it cannot ask yet", () => {
    // A provider on the desk with no check would show «unverified» forever and nobody would
    // know whether that means dead keys or an unwritten probe.
    for (const id of KEY_DESK_IDS) {
      expect(VERIFIABLE_PROVIDERS, id).toContain(id);
    }
  });
});

describe("the verdict", () => {
  const row = (over: Partial<Parameters<typeof deskVerdict>[0]>) => ({ rows: 0, active: 0, writes: 0, alive: 0, unfunded: 0, refused: 0, quota: 0, ...over });

  it("says the difference between no key, spent ceiling and a refused key", () => {
    expect(deskVerdict(row({}))).toBe("مفيش مفتاح من دول في المتجر");
    expect(deskVerdict(row({ rows: 10, alive: 3, active: 10 }))).toBe("بيرد على التحية، بس لسه ما اتقاسش إنه بيكتب");
    expect(deskVerdict(row({ rows: 10, quota: 10, active: 10 }))).toContain("سقفها خلص");
    expect(deskVerdict(row({ rows: 10, refused: 10 }))).toContain("مرفوضة");
    expect(deskVerdict(row({ rows: 10, active: 10 }))).toContain("اعمل التحقق");
  });

  it("finds a provider by id and returns nothing for one it does not list", () => {
    expect(keyDeskGuide("groq")?.label).toBeTruthy();
    expect(keyDeskGuide("not-a-provider")).toBeNull();
  });
});

describe("the desk door", () => {
  const source = () => readFileSync("app/api/admin/keys/desk/route.ts", "utf8");

  it("never answers with a key value", () => {
    const door = source();
    // The key is read in order to be asked about; it is never put in a response body.
    expect(door).toContain("const rows = (data ?? []) as unknown as");
    expect(door).not.toMatch(/key: row\.key/);
    expect(door).toContain('select("id,provider,key,error_count")');
    expect(door).not.toMatch(/NextResponse\.json\(\{[^)]*\bkey\b:/);
  });

  it("caps what one press can ask", () => {
    expect(source()).toMatch(/Math\.min\(25,/);
  });
});

describe("no provider disappears from the desk without a reason", () => {
  const source = (path: string) => readFileSync(path, "utf8");

  it("covers every name the orchestrator can call and every name the picker loads", () => {
    const orchestrator = source("lib/ai-orchestrator.ts");
    const picker = source("lib/api-keys-service.ts");

    const union = (text: string, marker: string) => {
      const start = text.indexOf(marker);
      const block = text.slice(start, text.indexOf(";", start));
      return [...block.matchAll(/"([a-z_0-9]+)"/g)].map((m) => m[1]).filter((v) => v !== marker);
    };

    const named = new Set([
      ...union(orchestrator, "type AIProvider ="),
      ...union(picker, "const PROVIDERS: ApiKeyProvider[] = ["),
    ]);
    expect(named.size, "the parse itself must keep working or this guard is theatre").toBeGreaterThan(12);

    for (const provider of named) {
      const covered = KEY_DESK_IDS.includes(provider) || provider in DESK_UNASKABLE || provider in DESK_NOT_A_MODEL;
      expect(covered, `${provider} is callable but neither on the desk nor explained`).toBe(true);
    }
  });

  it("explains each name it leaves off the desk", () => {
    for (const [provider, reason] of Object.entries({ ...DESK_UNASKABLE, ...DESK_NOT_A_MODEL })) {
      expect(reason.length, provider).toBeGreaterThan(20);
      expect(reason, provider).not.toMatch(/[A-Za-z]{4,}/);
    }
  });
});

describe("adding a key from the desk", () => {
  const door = () => readFileSync("app/api/admin/keys/desk/route.ts", "utf8");
  const screen = () => readFileSync("app/admin/v2/keys/page.tsx", "utf8");

  it("asks the two questions and never echoes the key back", () => {
    const source = door();
    expect(source).toMatch(/action === "add"/);
    expect(source).toMatch(/verifyKey\(provider, keyValue\)/);
    expect(source).toMatch(/verifyWrites\(provider, keyValue\)/);
    // What the answer may carry: the provider, the verdict, his language. Never the key.
    expect(source).not.toMatch(/json\(\{[^)]{0,400}\bkey:\s*keyValue/);
    expect(source).toMatch(/write_model/);
  });

  it("gives him the field, the provider list and the answer line", () => {
    const page = screen();
    expect(page).toMatch(/data-key-add/);
    expect(page).toMatch(/data-key-provider/);
    expect(page).toMatch(/data-key-input/);
    expect(page).toMatch(/أضف وتحقّق/);
    // The screen must not show the pasted key as plain text once typed — it is a password field.
    expect(page).toMatch(/type=["']password["']|autoComplete=["']off["']/);
  });

  it("does not conclude anything from a provider that did not answer", () => {
    // An absence of evidence is not a dead key: the verdict helper returns null and the row
    // is left alone, or the desk would kill working keys on a network blip.
    expect(door()).toMatch(/if \(!verdict\) continue;/);
    expect(door()).toMatch(/return null;/);
  });
});

describe("the desk counts the whole pool", () => {
  it("pages the key list instead of reading the first thousand", () => {
    const door = readFileSync("app/api/admin/keys/desk/route.ts", "utf8");
    // The gateway answers a thousand rows whatever the caller asks for; a single `.limit()`
    // made the desk print «١٬٠٠ مفتاح» about a pool more than twice that size.
    expect(door).toMatch(/\.range\(/);
    expect(door).not.toMatch(/\.limit\(5000\)/);
  });
});
