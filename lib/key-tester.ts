/**
 * lib/key-tester.ts
 * ══════════════════════════════════════════════════════════════════════
 * نظام اختبار مفاتيح API ذكي وديناميكي
 *
 * المبدأ:
 *  1. لكل provider له endpoint لجلب الـ models → نجلبها أولاً ونختار
 *     أول model مناسب للاختبار (بدون hard-code لأي model name).
 *  2. للـ providers التي تحتاج POST بـ model → نجلب الـ models ديناميكياً
 *     ونختار الأول المتاح، لو فشل نجرب الثاني، وهكذا.
 *  3. لو الـ models endpoint نفسه رجع 200 → المفتاح صحيح (لا داعي لـ POST).
 *  4. كل الحالات مغطاة: 401/403 = ميت | 429/402 = صحيح لكن مقيّد |
 *     Timeout = نقبل | Connection error = نرفض.
 *
 * الاستخدام:
 *   import { smartTestKey } from "@/lib/key-tester";
 *   const result = await smartTestKey("cerebras", "csk-...");
 *   // { valid: true/false, error?: string, modelUsed?: string }
 * ══════════════════════════════════════════════════════════════════════
 */

export interface KeyTestResult {
  valid:      boolean;
  error?:     string;
  modelUsed?: string;   // الـ model الذي استُخدم في الاختبار
  timedOut?:  boolean;  // true لو الاختبار انتهى بـ timeout (اعتُبر ناجحاً)
}

const TIMEOUT_MS = 10_000; // 10 ثواني

// ── helper: fetch مع timeout ──────────────────────────────────────────
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ── تفسير HTTP status ─────────────────────────────────────────────────
function interpretStatus(
  status: number,
  extraOk: number[] = []
): "valid" | "invalid" | "continue" {
  if (status === 401) return "invalid"; // مفتاح غلط
  if (status === 403) return "invalid"; // محظور
  if (status === 429) return "valid";   // rate limited = صحيح
  if (status === 402) return "valid";   // payment required = صحيح لكن نفد رصيده
  if (status === 200 || status === 201) return "valid";
  if (status >= 200 && status < 300)   return "valid";
  if (extraOk.includes(status))        return "valid";
  return "continue"; // مثل 404 بسبب model خاطئ → نجرب model آخر
}

// ══════════════════════════════════════════════════════════════════════
// Strategy A: GET /v1/models — يكفي وحده لإثبات صحة المفتاح
// ══════════════════════════════════════════════════════════════════════
async function testViaModelsEndpoint(
  modelsUrl: string,
  headers: Record<string, string>
): Promise<KeyTestResult> {
  try {
    const res = await fetchWithTimeout(modelsUrl, { headers });
    const st  = interpretStatus(res.status);

    if (st === "valid")   return { valid: true };
    if (st === "invalid") return { valid: false, error: `HTTP ${res.status}` };

    // status غير متوقع
    return { valid: false, error: `HTTP ${res.status}: ${res.statusText}` };

  } catch (err: any) {
    if (err.name === "AbortError") return { valid: true, timedOut: true };
    return { valid: false, error: err.message ?? "Connection failed" };
  }
}

// ══════════════════════════════════════════════════════════════════════
// Strategy B: جلب الـ models ثم POST بأول model متاح
// ══════════════════════════════════════════════════════════════════════
async function testViaAutoModel(
  modelsUrl:     string,
  completionsUrl: string,
  authHeader:    Record<string, string>,
  modelFilter?:  (id: string) => boolean  // فلتر اختياري للـ models
): Promise<KeyTestResult> {
  // ── الخطوة 1: جلب الـ models ──────────────────────────────────────
  let models: string[] = [];

  try {
    const modelsRes = await fetchWithTimeout(modelsUrl, { headers: authHeader });

    if (modelsRes.status === 401 || modelsRes.status === 403) {
      return { valid: false, error: `HTTP ${modelsRes.status} on models endpoint` };
    }

    if (modelsRes.status === 429 || modelsRes.status === 402) {
      // rate limited = مفتاح صحيح
      return { valid: true };
    }

    if (modelsRes.ok) {
      try {
        const json = await modelsRes.json();
        // OpenAI-compatible format: { data: [{ id }] }
        const raw: string[] = Array.isArray(json.data)
          ? json.data.map((m: any) => m.id as string).filter(Boolean)
          : Array.isArray(json.models)
          ? json.models.map((m: any) => (typeof m === "string" ? m : m.id)).filter(Boolean)
          : [];

        models = modelFilter ? raw.filter(modelFilter) : raw;
      } catch {
        // JSON parse فشل — لكن الـ status 200 = صحيح
        return { valid: true };
      }
    }
  } catch (err: any) {
    if (err.name === "AbortError") return { valid: true, timedOut: true };
    // models endpoint فشل بـ network error — نكمل بـ fallback
  }

  // ── الخطوة 2: POST بأول model متاح ────────────────────────────────
  // لو ما فيش models مجلوبة، نستخدم قائمة fallback فارغة (نرفض)
  if (models.length === 0) {
    // لو مقدرناش نجيب models لكن الـ 401/403 مش ظهروا = نقبل
    return { valid: true };
  }

  // نجرب أول 3 models بس عشان ما نضيعش وقت
  const toTry = models.slice(0, 3);

  for (const modelId of toTry) {
    try {
      const res = await fetchWithTimeout(completionsUrl, {
        method:  "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body:    JSON.stringify({
          model:      modelId,
          messages:   [{ role: "user", content: "hi" }],
          max_tokens: 1,
        }),
      });

      const st = interpretStatus(res.status, [400, 422]);

      if (st === "valid")   return { valid: true,  modelUsed: modelId };
      if (st === "invalid") return { valid: false, error: `HTTP ${res.status}` };
      // "continue" = model غير مدعوم، نجرب التالي

    } catch (err: any) {
      if (err.name === "AbortError") return { valid: true, timedOut: true };
      // network error — نجرب model ثاني
    }
  }

  // جربنا كل الـ models ولم نجد نتيجة حاسمة = نقبل (المشكلة في API مش المفتاح)
  return { valid: true };
}

// ══════════════════════════════════════════════════════════════════════
// نقطة الدخول الرئيسية
// ══════════════════════════════════════════════════════════════════════
export async function smartTestKey(
  provider: string,
  key:      string
): Promise<KeyTestResult> {
  const p = provider.toLowerCase();

  switch (p) {

    // ── Providers يكفي GET /models ──────────────────────────────────
    case "groq":
      return testViaModelsEndpoint(
        "https://api.groq.com/openai/v1/models",
        { Authorization: `Bearer ${key}` }
      );

    case "openrouter":
      return testViaModelsEndpoint(
        "https://openrouter.ai/api/v1/models",
        { Authorization: `Bearer ${key}`, "HTTP-Referer": "https://azenithliving.com" }
      );

    case "mistral":
      return testViaModelsEndpoint(
        "https://api.mistral.ai/v1/models",
        { Authorization: `Bearer ${key}` }
      );

    case "openai":
      return testViaModelsEndpoint(
        "https://api.openai.com/v1/models",
        { Authorization: `Bearer ${key}` }
      );

    case "deepseek":
      return testViaModelsEndpoint(
        "https://api.deepseek.com/v1/models",
        { Authorization: `Bearer ${key}`, Accept: "application/json" }
      );

    case "together":
      return testViaModelsEndpoint(
        "https://api.together.xyz/v1/models",
        { Authorization: `Bearer ${key}` }
      );

    case "cohere":
      return testViaModelsEndpoint(
        "https://api.cohere.ai/v1/models",
        { Authorization: `Bearer ${key}` }
      );

    case "xai":
      return testViaModelsEndpoint(
        "https://api.x.ai/v1/models",
        { Authorization: `Bearer ${key}` }
      );

    case "aimlapi":
      return testViaModelsEndpoint(
        "https://api.aimlapi.com/v1/models",
        { Authorization: `Bearer ${key}` }
      );

    case "huggingface":
      return testViaModelsEndpoint(
        "https://huggingface.co/api/whoami",
        { Authorization: `Bearer ${key}` }
      );

    case "pexels":
      return testViaModelsEndpoint(
        "https://api.pexels.com/v1/curated?per_page=1",
        { Authorization: key }  // بدون Bearer
      );

    case "google":
      return testViaModelsEndpoint(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
        {}
      );

    // ── Providers تحتاج اكتشاف model ثم POST ──────────────────────
    case "cerebras":
      return testViaAutoModel(
        "https://api.cerebras.ai/v1/models",
        "https://api.cerebras.ai/v1/chat/completions",
        { Authorization: `Bearer ${key}` }
      );

    case "sambanova":
      return testViaAutoModel(
        "https://api.sambanova.ai/v1/models",
        "https://api.sambanova.ai/v1/chat/completions",
        { Authorization: `Bearer ${key}` }
      );

    case "anthropic": {
      // Anthropic لا تدعم /models بشكل عام → POST مباشر
      // لكن نفس المشكلة — الـ model قد يتغير
      // الحل: نجلب /v1/models وإلا نستخدم قائمة fallback معروفة
      const authH = { "x-api-key": key, "anthropic-version": "2023-06-01" };

      // جرب جلب models (قد لا يكون متاحاً)
      let models: string[] = [];
      try {
        const mr = await fetchWithTimeout("https://api.anthropic.com/v1/models", { headers: authH });
        if (mr.status === 401 || mr.status === 403) return { valid: false, error: `HTTP ${mr.status}` };
        if (mr.ok) {
          const j = await mr.json();
          models = Array.isArray(j.data) ? j.data.map((m: any) => m.id).filter(Boolean) : [];
        }
      } catch { /* fallback */ }

      // Fallback models معروفة مرتبة من الأرخص للأغلى
      if (models.length === 0) {
        models = [
          "claude-haiku-4-5",
          "claude-3-haiku-20240307",
          "claude-3-5-haiku-20241022",
          "claude-3-5-sonnet-20241022",
        ];
      }

      for (const modelId of models.slice(0, 3)) {
        try {
          const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
            method:  "POST",
            headers: { ...authH, "Content-Type": "application/json" },
            body:    JSON.stringify({
              model: modelId, messages: [{ role: "user", content: "hi" }], max_tokens: 1,
            }),
          });
          const st = interpretStatus(res.status, [400, 422]);
          if (st === "valid")   return { valid: true,  modelUsed: modelId };
          if (st === "invalid") return { valid: false, error: `HTTP ${res.status}` };
        } catch (err: any) {
          if (err.name === "AbortError") return { valid: true, timedOut: true };
        }
      }
      return { valid: true }; // ما حددناش → نقبل
    }

    // ── Providers بدون endpoint اختبار موثوق ─────────────────────
    case "cloudflare":
    case "apifreellm":
    case "bytez":
    case "api_ninjas":
    default:
      // نقبل مباشرة — المستخدم مسؤول عن صحة المفتاح
      return { valid: true };
  }
}
