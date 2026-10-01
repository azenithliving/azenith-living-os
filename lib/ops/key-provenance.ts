/**
 * key-provenance.ts — whose key is this, without ever asking what it is.
 *
 * The pool in the database was measured on 2026-10-01: 1,241 rows across 16 providers,
 * 1,240 of them written in a single batch on 2026-08-11 with the note «Imported from env
 * variables», none carrying an owner, one noted as a GitHub Actions harvester token. Three
 * providers do all the work; the rest are decoration. The owner's ruling is that his own
 * keys are the capacity and everything else is a liability — a key he cannot account for
 * is somebody else's quota, or somebody else's bill, running under his store's name.
 *
 * So this module answers one question and never touches the second: is this row the same
 * key as one of his? It answers with a hash prefix, which is enough to match and useless
 * to steal. No key value ever leaves this file, and none is ever logged.
 */
import { createHash } from "node:crypto";

/** The env names he fills himself, per provider the store actually calls. */
export const OWNER_ENV_NAMES: Record<string, string[]> = {
  google: ["GEMINI_API_KEY", "GOOGLE_AI_API_KEY", "NEXT_PUBLIC_GEMINI_API_KEY"],
  groq: ["GROQ_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  mistral: ["MISTRAL_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
  cerebras: ["CEREBRAS_API_KEY"],
  together: ["TOGETHER_API_KEYS"],
  cohere: ["COHERE_API_KEY"],
  xai: ["XAI_API_KEY"],
  aimlapi: ["AIMLAPI_API_KEY"],
  pexels: ["PEXELS_API_KEYS"],
};

/** 12 hex characters: enough to identify a key, not enough to be one. */
export function keyFingerprint(value: unknown): string {
  return createHash("sha256")
    .update(String(value ?? ""))
    .digest("hex")
    .slice(0, 12);
}

/**
 * A pool may be stored as one value or comma-separated chunks (`KEY`, `KEY_1`…`KEY_20`),
 * which is how the big providers are usually pasted. Read the same way the importer did.
 */
export function ownerFingerprints(provider: string, env: NodeJS.ProcessEnv = process.env): Set<string> {
  const names = OWNER_ENV_NAMES[provider] ?? [];
  const found = new Set<string>();
  for (const name of names) {
    const direct = env[name];
    if (direct) for (const part of direct.split(",")) if (part.trim()) found.add(keyFingerprint(part.trim()));
    for (let chunk = 1; chunk <= 20; chunk++) {
      const value = env[`${name}_${chunk}`];
      if (value) for (const part of value.split(",")) if (part.trim()) found.add(keyFingerprint(part.trim()));
    }
  }
  return found;
}

export type Provenance = "owner" | "unknown";

export function provenanceOf(keyValue: unknown, owned: Set<string>): Provenance {
  return owned.has(keyFingerprint(keyValue)) ? "owner" : "unknown";
}

/** What the census prints, and what the quarantine decision is counted from. */
export type ProviderCensus = {
  provider: string;
  rows: number;
  active: number;
  owner: number;
  unknown: number;
  /** The same key stored more than once — one quota counted twice is a false capacity. */
  duplicates: number;
  requests: number;
  envNamesFilled: string[];
};
