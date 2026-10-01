/**
 * key-verify.ts — asking each provider, in its own words, whether this key is his and alive.
 *
 * A pool of keys nobody has checked is a pool that fails in front of a customer. Each check
 * is the cheapest call the provider offers for the purpose — usually a list of models, which
 * costs no tokens — and the answer is kept in four states, because «not 200» is not one fact:
 * a spent quota, a revoked key and a network that did not answer need different actions, and
 * the store has already been burned once by treating them as the same thing.
 *
 * Server only. A key value is passed to its own provider and nowhere else; nothing here
 * returns, logs or stores a key.
 */

export type VerifyState =
  | "writes"
  /** The company answered a hello (its model list) — which is NOT the same as being able to answer a request. */
  | "alive"
  | "quota"
  /** The account answers and refuses on money: «add credits», «payment required», «out of funds». */
  | "unfunded"
  | "dead"
  | "unreachable"
  | "unwritten";

export type VerifyOutcome = { state: VerifyState; status: number | null; ms: number; note: string | null };

type Check = { url: string; header?: (key: string) => Record<string, string>; query?: (key: string) => string };

const bearer = (key: string) => ({ Authorization: `Bearer ${key}` });

/** One line per provider the store calls. A provider missing here is reported, not guessed. */
const CHECKS: Record<string, Check> = {
  google: { url: "https://generativelanguage.googleapis.com/v1beta/models", query: (key) => `?key=${encodeURIComponent(key)}` },
  groq: { url: "https://api.groq.com/openai/v1/models", header: bearer },
  openai: { url: "https://api.openai.com/v1/models", header: bearer },
  openrouter: { url: "https://openrouter.ai/api/v1/models", header: bearer },
  together: { url: "https://api.together.xyz/v1/models", header: bearer },
  deepseek: { url: "https://api.deepseek.com/models", header: bearer },
  anthropic: { url: "https://api.anthropic.com/v1/models", header: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }) },
  cohere: { url: "https://api.cohere.com/v2/models", header: bearer },
  mistral: { url: "https://api.mistral.ai/v1/models", header: bearer },
  cerebras: { url: "https://api.cerebras.ai/v1/models", header: bearer },
  xai: { url: "https://api.x.ai/v1/models", header: bearer },
  huggingface: { url: "https://huggingface.co/api/whoami-v2", header: bearer },
  nvidia: { url: "https://integrate.api.nvidia.com/v1/models", header: bearer },
  aimlapi: { url: "https://api.aimlapi.com/v1/models", header: bearer },
  apifreellm: { url: "https://api.apifreellm.com/v1/models", header: bearer },
  sambanova: { url: "https://api.sambanova.ai/v1/models", header: bearer },
  pexels: { url: "https://api.pexels.com/v1/me", header: (key) => ({ Authorization: key }) },
};

export const VERIFIABLE_PROVIDERS = Object.keys(CHECKS);

/**
 * The hello is not the job.
 *
 * Measured on 2026-10-02: 1,321 keys in this pool answered a model list — and when the same
 * keys were asked to write one word, only two companies obeyed. Six of them answered with a
 * money wall («payment required», «credit balance is too low», «no credits remaining», «run
 * out of funds»), and three more did not recognise their own keys. A desk that counts
 * greetings as capacity is the exact thing the owner asked this store to stop doing.
 *
 * So a key is asked the cheapest real question the provider has: write four tokens. The
 * model names below were read from each company's own list the same night, not remembered.
 */
type WriteCheck = { url: string; body: string; header?: (key: string) => Record<string, string> };

const openAiBody = (model: string) =>
  JSON.stringify({ model, messages: [{ role: "user", content: "قل نعم" }], max_tokens: 4 });

const WRITERS: Record<string, WriteCheck> = {
  google: {
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
    body: JSON.stringify({ contents: [{ parts: [{ text: "قل نعم" }] }], generationConfig: { maxOutputTokens: 4 } }),
  },
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", body: openAiBody("llama-3.3-70b-versatile"), header: bearer },
  openai: { url: "https://api.openai.com/v1/chat/completions", body: openAiBody("gpt-4.1-nano"), header: bearer },
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", body: openAiBody("meta-llama/llama-3.3-70b-instruct:free"), header: bearer },
  together: { url: "https://api.together.xyz/v1/chat/completions", body: openAiBody("meta-llama/Llama-3.3-70B-Instruct-Turbo-Free"), header: bearer },
  deepseek: { url: "https://api.deepseek.com/chat/completions", body: openAiBody("deepseek-chat"), header: bearer },
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 4, messages: [{ role: "user", content: "قل نعم" }] }),
    header: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" }),
  },
  cohere: { url: "https://api.cohere.com/v2/chat", body: openAiBody("command-a-03-2025"), header: bearer },
  mistral: { url: "https://api.mistral.ai/v1/chat/completions", body: openAiBody("mistral-small-latest"), header: bearer },
  cerebras: { url: "https://api.cerebras.ai/v1/chat/completions", body: openAiBody("gpt-oss-120b"), header: bearer },
  aimlapi: { url: "https://api.aimlapi.com/v1/chat/completions", body: openAiBody("meta-llama/llama-3.3-70b-instruct"), header: bearer },
  sambanova: { url: "https://api.sambanova.ai/v1/chat/completions", body: openAiBody("DeepSeek-V3.2"), header: bearer },
};

/** Which providers can be asked to write, not only greeted. */
export const WRITABLE_PROVIDERS = Object.keys(WRITERS);

/** A money wall is a different fact from a revoked key, and needs a different action. */
const UNFUNDED = /payment required|credit|funds|balance|billing|top up|plan/i;

function writeStateOf(status: number, body: string): VerifyState {
  if (status === 200 && !/"error"/i.test(body.slice(0, 400))) return "writes";
  if (status === 429) return "quota";
  if (UNFUNDED.test(body)) return "unfunded";
  if (status === 401 || status === 403 || status === 404 || status === 400 || status === 422) return "dead";
  if (status >= 500) return "unreachable";
  return "dead";
}

/**
 * Ask one key to write four tokens. Returns `unwritten` for a provider this file has no
 * shape for — that is reported, never guessed at.
 */
export async function verifyWrites(provider: string, keyValue: string, timeoutMs = 20000): Promise<VerifyOutcome> {
  const check = WRITERS[String(provider ?? "").toLowerCase()];
  const started = Date.now();
  if (!check) return { state: "unwritten", status: null, ms: 0, note: "no write check written for this provider" };
  if (!keyValue) return { state: "dead", status: null, ms: 0, note: "empty key" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const auth = check.header ? check.header(keyValue) : {};
    const response = await fetch(check.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth, ...(provider === "google" ? { "x-goog-api-key": keyValue } : {}) },
      body: check.body,
      signal: controller.signal,
    });
    const body = await response.text().catch(() => "");
    return {
      state: writeStateOf(response.status, body),
      status: response.status,
      ms: Date.now() - started,
      note: response.ok ? null : body.replace(/\s+/g, " ").slice(0, 120),
    };
  } catch (error) {
    const aborted = (error as Error)?.name === "AbortError";
    return { state: "unreachable", status: null, ms: Date.now() - started, note: aborted ? "timed out" : String((error as Error)?.message ?? error).slice(0, 120) };
  } finally {
    clearTimeout(timer);
  }
}

function stateOf(status: number, body: string): VerifyState {
  if (status === 200 || status === 204) return "alive";
  if (status === 429) return "quota";
  if (status === 401 || status === 403 || status === 400 || status === 404) {
    // A spent or revoked key sometimes answers 429-flavoured prose; the body decides.
    return /quota|rate limit|exceeded/i.test(body) ? "quota" : "dead";
  }
  if (status >= 500) return "unreachable";
  return "dead";
}

/**
 * One key, one provider, one bounded request. `timeoutMs` is short on purpose: a provider
 * that takes eight seconds to say hello is not going to answer a customer faster.
 */
export async function verifyKey(provider: string, keyValue: string, timeoutMs = 8000): Promise<VerifyOutcome> {
  const check = CHECKS[String(provider ?? "").toLowerCase()];
  const started = Date.now();
  if (!check) return { state: "unwritten", status: null, ms: 0, note: "no check written for this provider" };
  if (!keyValue) return { state: "dead", status: null, ms: 0, note: "empty key" };

  const url = check.url + (check.query ? check.query(keyValue) : "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: check.header ? check.header(keyValue) : undefined,
      signal: controller.signal,
    });
    const body = response.ok ? "" : (await response.text().catch(() => "")).slice(0, 300);
    return {
      state: stateOf(response.status, body),
      status: response.status,
      ms: Date.now() - started,
      note: response.ok ? null : body.replace(/\s+/g, " ").slice(0, 120) || `HTTP ${response.status}`,
    };
  } catch (error) {
    const aborted = (error as Error)?.name === "AbortError";
    return {
      state: "unreachable",
      status: null,
      ms: Date.now() - started,
      note: aborted ? `ما ردّش في ${Math.round(timeoutMs / 1000)} ثانية` : String((error as Error)?.message ?? error).slice(0, 120),
    };
  } finally {
    clearTimeout(timer);
  }
}
