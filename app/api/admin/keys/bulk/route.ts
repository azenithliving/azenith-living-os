/**
 * POST /api/admin/keys/bulk
 * إضافة مفاتيح متعددة دفعة واحدة
 *
 * السلوك:
 * - المفاتيح الناجحة في الاختبار  → تُضاف كـ active
 * - المفاتيح الفاشلة في الاختبار  → تُضاف كـ dead (error_count=3) عشان تظهر في فلتر الميتة للمراجعة
 * - المفاتيح المكررة               → تُتجاهل
 * - Timeout أثناء الاختبار        → يُعامَل كنجاح (لا نعاقب المفتاح بسبب بطء الشبكة)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { reloadKeys } from "@/lib/api-keys-service";

const TEST_TIMEOUT_MS = 8000;

// ── اختبار مفتاح واحد ────────────────────────────────────────────────
async function testSingleKey(
  provider: string,
  key: string
): Promise<{ valid: boolean; timedOut?: boolean; error?: string }> {
  const p = provider.toLowerCase();

  type Cfg = {
    url: string;
    method?: "GET" | "POST";
    headers: Record<string, string>;
    body?: string;
    extraOk?: number[];
  };

  let cfg: Cfg | null = null;

  switch (p) {
    case "groq":
      cfg = { url: "https://api.groq.com/openai/v1/models", headers: { Authorization: `Bearer ${key}` } };
      break;
    case "openrouter":
      cfg = { url: "https://openrouter.ai/api/v1/models", headers: { Authorization: `Bearer ${key}`, "HTTP-Referer": "https://azenithliving.com" } };
      break;
    case "mistral":
      cfg = { url: "https://api.mistral.ai/v1/models", headers: { Authorization: `Bearer ${key}` } };
      break;
    case "openai":
      cfg = { url: "https://api.openai.com/v1/models", headers: { Authorization: `Bearer ${key}` } };
      break;
    case "deepseek":
      cfg = { url: "https://api.deepseek.com/v1/models", headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } };
      break;
    case "together":
      cfg = { url: "https://api.together.xyz/v1/models", headers: { Authorization: `Bearer ${key}` } };
      break;
    case "cohere":
      cfg = { url: "https://api.cohere.ai/v1/models", headers: { Authorization: `Bearer ${key}` } };
      break;
    case "xai":
      cfg = { url: "https://api.x.ai/v1/models", headers: { Authorization: `Bearer ${key}` } };
      break;
    case "aimlapi":
      cfg = { url: "https://api.aimlapi.com/v1/models", headers: { Authorization: `Bearer ${key}` } };
      break;
    case "huggingface":
      cfg = { url: "https://huggingface.co/api/whoami", headers: { Authorization: `Bearer ${key}` } };
      break;
    case "pexels":
      cfg = { url: "https://api.pexels.com/v1/curated?per_page=1", headers: { Authorization: key } };
      break;
    case "google":
      cfg = { url: `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, headers: {} };
      break;
    case "anthropic":
      cfg = {
        url: "https://api.anthropic.com/v1/messages", method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-3-haiku-20240307", messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
        extraOk: [400],
      };
      break;
    case "cerebras":
      cfg = {
        url: "https://api.cerebras.ai/v1/chat/completions", method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-oss-120b", messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
        extraOk: [400],
      };
      break;
    case "sambanova":
      cfg = {
        url: "https://api.sambanova.ai/v1/chat/completions", method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "Meta-Llama-3.1-8B-Instruct", messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
        extraOk: [400],
      };
      break;
    default:
      // provider بدون endpoint اختبار → نقبله مباشرة
      return { valid: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

  try {
    const res = await fetch(cfg.url, {
      method:  cfg.method || "GET",
      headers: cfg.headers,
      body:    cfg.body,
      signal:  controller.signal,
    });
    clearTimeout(timer);

    // quota / payment = مفتاح صحيح
    if (res.status === 429 || res.status === 402) return { valid: true };
    // رفض صريح = مفتاح غلط
    if (res.status === 401) return { valid: false, error: "401 Unauthorized" };
    if (res.status === 403) return { valid: false, error: "403 Forbidden" };

    const extra = cfg.extraOk ?? [];
    return res.ok || extra.includes(res.status)
      ? { valid: true }
      : { valid: false, error: `HTTP ${res.status}: ${res.statusText}` };

  } catch (err: any) {
    clearTimeout(timer);
    // Timeout → نقبل المفتاح
    if (err.name === "AbortError") return { valid: true, timedOut: true };
    return { valid: false, error: err.message ?? "Connection failed" };
  }
}

// ── حفظ دفعة في DB بـ INSERT واحدة واحدة (أكثر موثوقية من upsert) ───
async function insertKeys(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rows: {
    provider: string;
    key: string;
    notes: string | null;
    is_backup: boolean;
    is_active: boolean;
    error_count?: number;
    last_error?: string;
  }[]
): Promise<{ added: string[]; duplicates: string[]; errors: { key: string; error: string }[] }> {
  const added: string[] = [];
  const duplicates: string[] = [];
  const errors: { key: string; error: string }[] = [];

  // نحفظ على دفعات 20 في كل مرة
  const CHUNK = 20;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);

    // نحاول INSERT جماعي أولاً (أسرع)
    const { data, error } = await supabase!
      .from("api_keys")
      .insert(chunk)
      .select("key");

    if (!error && data) {
      data.forEach((r: any) => added.push(r.key));
      continue;
    }

    // لو فشل الجماعي (على الأرجح بسبب duplicate) → واحدة واحدة
    for (const row of chunk) {
      const { data: d, error: e } = await supabase!
        .from("api_keys")
        .insert(row)
        .select("key")
        .single();

      if (!e && d) {
        added.push(d.key);
      } else if (e) {
        const msg = e.message ?? "";
        if (msg.includes("duplicate") || msg.includes("unique") || e.code === "23505") {
          duplicates.push(row.key);
        } else {
          errors.push({ key: row.key, error: msg });
        }
      }
    }
  }

  return { added, duplicates, errors };
}

// ── Handler الرئيسي ───────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      provider,
      keys,
      notes       = "",
      isBackup    = false,
      testKeys    = true,
      concurrency = 5,
    } = body as {
      provider:     string;
      keys:         string[];
      notes?:       string;
      isBackup?:    boolean;
      testKeys?:    boolean;
      concurrency?: number;
    };

    if (!provider || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json(
        { success: false, error: "provider و keys[] مطلوبان" },
        { status: 400 }
      );
    }

    // تنظيف
    const cleaned = [...new Set(keys.map(k => k.trim()).filter(k => k.length > 0))];
    if (cleaned.length === 0) {
      return NextResponse.json(
        { success: false, error: "لا توجد مفاتيح صالحة" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
    }

    // ── اختبار متوازٍ ────────────────────────────────────────────────
    type TestResult = { key: string; valid: boolean; timedOut?: boolean; error?: string };
    const testResults: TestResult[] = [];

    if (testKeys) {
      const batchSize = Math.max(1, Math.min(concurrency, 10));
      for (let i = 0; i < cleaned.length; i += batchSize) {
        const batch = cleaned.slice(i, i + batchSize);
        const batchRes = await Promise.all(
          batch.map(async (key) => ({ key, ...(await testSingleKey(provider, key)) }))
        );
        testResults.push(...batchRes);
      }
    } else {
      cleaned.forEach(key => testResults.push({ key, valid: true }));
    }

    const passedKeys = testResults.filter(r => r.valid);
    const failedKeys = testResults.filter(r => !r.valid);

    // ── حفظ المفاتيح الناجحة ─────────────────────────────────────────
    const passRows = passedKeys.map(r => ({
      provider:  provider.toLowerCase(),
      key:       r.key,
      notes:     notes || null,
      is_backup: isBackup,
      is_active: true,
    }));

    // ── حفظ المفاتيح الفاشلة كـ "ميتة" للمراجعة ─────────────────────
    const failRows = failedKeys.map(r => ({
      provider:    provider.toLowerCase(),
      key:         r.key,
      notes:       notes || null,
      is_backup:   false,
      is_active:   false,
      error_count: 3,              // يظهر فوراً في فلتر "ميت"
      last_error:  `[DEAD] ${r.error ?? "Key test failed"}`,
    }));

    const [passResult, failResult] = await Promise.all([
      passRows.length > 0 ? insertKeys(supabase, passRows) : Promise.resolve({ added: [], duplicates: [], errors: [] }),
      failRows.length > 0 ? insertKeys(supabase, failRows) : Promise.resolve({ added: [], duplicates: [], errors: [] }),
    ]);

    // Hot-reload
    await reloadKeys();

    const summary = {
      total:       cleaned.length,
      added:       passResult.added.length,
      duplicate:   passResult.duplicates.length + failResult.duplicates.length,
      failed_test: failResult.added.length,       // فاشلة لكن حُفظت كـ dead
      errored:     passResult.errors.length + failResult.errors.length,
    };

    return NextResponse.json({
      success: true,
      summary,
      message: [
        `✅ أُضيف نشط: ${summary.added}`,
        summary.failed_test  > 0 ? `💀 مضاف كـ ميت للمراجعة: ${summary.failed_test}` : "",
        summary.duplicate    > 0 ? `⚠️ مكرر: ${summary.duplicate}` : "",
        summary.errored      > 0 ? `❌ خطأ في الحفظ: ${summary.errored}` : "",
      ].filter(Boolean).join(" | "),
    });

  } catch (error: any) {
    console.error("[Bulk Import] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
