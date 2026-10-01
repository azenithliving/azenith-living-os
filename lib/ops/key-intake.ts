/**
 * key-intake.ts — sorting the folder of keys into something the store can trust.
 *
 * The owner's corpus was measured on 2026-10-02: four text files, 3,287 lines, 1,566
 * distinct tokens, no provider labels on almost any line. So the provider is read from the
 * shape of the key itself, and a key whose shape belongs to nobody is kept as unclassified
 * rather than guessed into a provider — a wrong label means the store sends a customer's
 * question to somebody else's service.
 *
 * Pure, so the rules can be tested without a folder, a database, or a single network call.
 * Nothing here prints a key: the only identity this module exposes is a fingerprint.
 */

export type Classified = {
  /** The provider the store calls, or null when the shape matches none of them. */
  provider: string | null;
  /** The prefix family that decided it — kept so the report can say why. */
  family: string;
  /** Why a token was refused outright (not a key at all). */
  rejected: string | null;
};

/** Longest prefix first: `sk-or-` must beat the bare `sk-`. */
const PREFIXES: [string, string][] = [
  ["sk-or-v1-", "openrouter"],
  ["sk-or-", "openrouter"],
  ["sk-ant-", "anthropic"],
  ["sk-proj-", "openai"],
  ["sk-svc-", "openai"],
  ["sk-cp-", "cerebras"],
  ["sk-sp-", "deepseek"],
  ["gsk_", "groq"],
  ["AIza", "google"],
  ["tgp_", "together"],
  ["xai-", "xai"],
  ["AQ.", "cohere"],
  ["apf_", "apifreellm"],
  ["hf_", "huggingface"],
  ["nvapi-", "nvidia"],
  ["fp-", "fireworks"],
  ["key-", "aimlapi"],
  ["sk-", "unknown"],
];

/**
 * A key is a long token of URL-safe characters. The corpus also carries report lines —
 * `404=`, `157=` and friends — and a URL, and a word; none of them may reach the database.
 */
export function classifyKey(raw: unknown): Classified {
  const token = String(raw ?? "").trim().split(/[\s,;|]+/)[0] ?? "";
  if (!token) return { provider: null, family: "empty", rejected: "empty" };
  if (/^https?:\/\//i.test(token)) return { provider: null, family: "url", rejected: "a link, not a key" };
  if (!/^[A-Za-z0-9_\-.]{20,200}$/.test(token)) {
    return { provider: null, family: token.slice(0, 3), rejected: "wrong shape for a key" };
  }
  // A key carries both letters and digits. Hex-only OpenRouter-style keys have no run of
  // six letters, so a run-length test threw away 147 of them on the first pass; what is
  // actually absent from a key is the mix — `404=2` and a plain word both fail here.
  if (!/[A-Za-z]/.test(token) || !/[0-9]/.test(token)) {
    return { provider: null, family: token.slice(0, 3), rejected: "no key-like body" };
  }
  for (const [prefix, provider] of PREFIXES) {
    if (token.startsWith(prefix)) {
      return { provider, family: prefix, rejected: provider === "unknown" ? "a bare sk- prefix: which company it belongs to is not knowable from the shape" : null };
    }
  }
  return { provider: null, family: token.slice(0, 4), rejected: "no provider wears this prefix" };
}

/**
 * One line of the corpus may hold a label and a key (`groq: gsk_…`), so every token on the
 * line is tried and the classifier decides. The split is deliberately dumb — length only —
 * because a filter that guesses what a key looks like here would hide junk from the report
 * instead of counting it as refused.
 */
export function keysFromLine(line: string): string[] {
  return String(line ?? "")
    .split(/[\s,;|"']+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 20);
}

export type IntakeRow = { token: string; provider: string | null; family: string; rejected: string | null };

export function intakeCorpus(lines: string[]): {
  rows: IntakeRow[];
  byProvider: Record<string, number>;
  unclassified: number;
  rejected: number;
  duplicates: number;
  total: number;
} {
  const seen = new Set<string>();
  const rows: IntakeRow[] = [];
  const byProvider: Record<string, number> = {};
  let unclassified = 0;
  let rejected = 0;
  let duplicates = 0;
  let total = 0;

  for (const line of lines) {
    for (const token of keysFromLine(line)) {
      total++;
      if (seen.has(token)) {
        duplicates++;
        continue;
      }
      seen.add(token);
      const found = classifyKey(token);
      rows.push({ token, ...found });
      if (found.rejected) rejected++;
      else if (!found.provider || found.provider === "unknown") unclassified++;
      else byProvider[found.provider] = (byProvider[found.provider] ?? 0) + 1;
    }
  }

  return { rows, byProvider, unclassified, rejected, duplicates, total };
}
