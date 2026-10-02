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

export type VerifyOutcome = {
  state: VerifyState;
  status: number | null;
  ms: number;
  note: string | null;
  /** The model this key answered with, when a write was asked for. */
  model?: string | null;
};

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
  // Measured, not assumed: `/v1/me` does not exist on this provider and answered 404 for all
  // five of his working image keys, which the pass then filed as refused. The cheapest real
  // call it does have is its curated list.
  pexels: { url: "https://api.pexels.com/v1/curated", query: () => "?per_page=1", header: (key) => ({ Authorization: key }) },
  // One free lookup, no key in the URL: the endpoint exists and answers 200 with his key.
  api_ninjas: { url: "https://api.api-ninjas.com/v1/country", query: () => "?name=Egypt", header: (key) => ({ "X-Api-Key": key }) },
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
type WriteCheck = {
  url: string;
  /** Built with the model this key is actually allowed to use. */
  body: (model: string) => string;
  header?: (key: string) => Record<string, string>;
  query?: (key: string) => string;
};

const openAiBody = (model: string) =>
  JSON.stringify({ model, messages: [{ role: "user", content: "قل نعم" }], max_tokens: 4 });

/** Each entry's second argument is the model this key named for itself. */
const WRITERS: Record<string, WriteCheck> = {
  google: {
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
    body: () => JSON.stringify({ contents: [{ parts: [{ text: "قل نعم" }] }], generationConfig: { maxOutputTokens: 4 } }),
    query: (key) => `?key=${encodeURIComponent(key)}`,
  },
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", body: openAiBody, header: bearer },
  openai: { url: "https://api.openai.com/v1/chat/completions", body: openAiBody, header: bearer },
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", body: openAiBody, header: bearer },
  together: { url: "https://api.together.xyz/v1/chat/completions", body: openAiBody, header: bearer },
  deepseek: { url: "https://api.deepseek.com/chat/completions", body: openAiBody, header: bearer },
  cohere: { url: "https://api.cohere.com/v2/chat", body: openAiBody, header: bearer },
  mistral: { url: "https://api.mistral.ai/v1/chat/completions", body: openAiBody, header: bearer },
  cerebras: { url: "https://api.cerebras.ai/v1/chat/completions", body: openAiBody, header: bearer },
  aimlapi: { url: "https://api.aimlapi.com/v1/chat/completions", body: openAiBody, header: bearer },
  sambanova: { url: "https://api.sambanova.ai/v1/chat/completions", body: openAiBody, header: bearer },
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    body: (model) => JSON.stringify({ model, max_tokens: 4, messages: [{ role: "user", content: "قل نعم" }] }),
    header: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" }),
  },
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
 *
 * The model is not hardcoded when it can be avoided: measured with the owner's own new keys,
 * a provider's list is per-account, and the name that was right last month comes back
 * «does not exist or you do not have access». So the key is asked what it may use, and the
 * first chat-shaped answer is taken.
 */
const CHATISH = /(llama|gemini|deepseek|qwen|gpt-oss|gpt-4|gpt-5|command|mistral|mixtral|phi|glm|allam|minimax|gemma|:free)/i;
const NOT_CHAT = /(whisper|guard|embed|tts|audio|image|ocr|rerank|clip|doctr|yolo)/i;

/** The models this particular key is allowed to use, in the provider's own words. */
export async function listModels(provider: string, keyValue: string, timeoutMs = 12000): Promise<string[]> {
  const check = CHECKS[String(provider ?? "").toLowerCase()];
  if (!check || !keyValue) return [];
  try {
    const url = check.url + (check.query ? check.query(keyValue) : "");
    const response = await fetch(url, {
      headers: check.header ? check.header(keyValue) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return [];
    const data: any = await response.json().catch(() => null);
    const list = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : Array.isArray(data) ? data : [];
    return list.map((m: any) => String(m?.id ?? m?.name ?? "")).filter(Boolean);
  } catch {
    return [];
  }
}

function pickChatModel(provider: string, ids: string[]): string | null {
  const usable = ids.filter((id) => !NOT_CHAT.test(id));
  const preferred = usable.filter((id) => CHATISH.test(id));
  const chosen = preferred[0] ?? usable[0] ?? null;
  if (!chosen) return null;
  // SambaNova's own list carries no request limit; its busiest model answers 429 for
  // everyone, so the second choice is kept for that case.
  return provider === "sambanova" ? (usable.find((id) => id !== chosen && /llama/i.test(id)) ?? chosen) : chosen;
}

export async function verifyWrites(
  provider: string,
  keyValue: string,
  options?: { timeoutMs?: number; model?: string }
): Promise<VerifyOutcome> {
  const name = String(provider ?? "").toLowerCase();
  const check = WRITERS[name];
  const started = Date.now();
  if (!check) return { state: "unwritten", status: null, ms: 0, note: "no write check written for this provider" };
  if (!keyValue) return { state: "dead", status: null, ms: 0, note: "empty key" };

  const model = options?.model || pickChatModel(name, await listModels(name, keyValue));
  if (!model) return { state: "unwritten", status: null, ms: 0, note: "the key named no model it may use" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? 20000);
  try {
    const response = await fetch(check.url + (check.query ? check.query(keyValue) : ""), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(check.header ? check.header(keyValue) : {}) },
      body: check.body(model),
      signal: controller.signal,
    });
    const text = await response.text().catch(() => "");
    return {
      state: writeStateOf(response.status, text),
      status: response.status,
      ms: Date.now() - started,
      note: response.ok ? null : text.replace(/\s+/g, " ").slice(0, 120),
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
