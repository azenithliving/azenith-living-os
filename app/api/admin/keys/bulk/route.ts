/**
 * POST /api/admin/keys/bulk
 * إضافة مفاتيح متعددة دفعة واحدة مع اختبار متوازٍ
 *
 * Body:
 *   { provider, keys: string[], notes?, isBackup?, testKeys?, concurrency? }
 *
 * Response:
 *   { success, summary: { total, added, duplicate, failed, errored }, results[], message }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { reloadKeys } from "@/lib/api-keys-service";

const TEST_TIMEOUT_MS = 8000;

// ── اختبار مفتاح واحد ────────────────────────────────────────────────
async function testSingleKey(
  provider: string,
  key: string
): Promise<{ valid: boolean; error?: string }> {
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
      cfg = {
        url: "https://openrouter.ai/api/v1/models",
        headers: { Authorization: `Bearer ${key}`, "HTTP-Referer": "https://azenithliving.com" },
      };
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
        url: "https://api.anthropic.com/v1/messages",
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-3-haiku-20240307", messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
        extraOk: [400],
      };
      break;
    case "cerebras":
      cfg = {
        url: "https://api.cerebras.ai/v1/chat/completions",
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "llama-3.3-70b", messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
        extraOk: [400],
      };
      break;
    case "sambanova":
      cfg = {
        url: "https://api.sambanova.ai/v1/chat/completions",
        method: "POST",
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

    // quota / payment → المفتاح صحيح
    if (res.status === 429 || res.status === 402) return { valid: true };
    if (res.status === 401) return { valid: false, error: "401 Unauthorized — مفتاح غير صحيح" };
    if (res.status === 403) return { valid: false, error: "403 Forbidden — مفتاح محظور" };

    const extra = cfg.extraOk ?? [];
    return res.ok || extra.includes(res.status)
      ? { valid: true }
      : { valid: false, error: `HTTP ${res.status}: ${res.statusText}` };

  } catch (err: any) {
    clearTimeout(timer);
    // Timeout → نقبل المفتاح (لا نرفضه بسبب بطء الشبكة)
    if (err.name === "AbortError") return { valid: true };
    return { valid: false, error: err.message ?? "Connection failed" };
  }
}

// ── Handler الرئيسي ───────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      provider,
      keys,
      notes      = "",
      isBackup   = false,
      testKeys   = true,
      concurrency = 5,
    } = body as {
      provider:    string;
      keys:        string[];
      notes?:      string;
      isBackup?:   boolean;
      testKeys?:   boolean;
      concurrency?: number;
    };

    if (!provider || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json(
        { success: false, error: "provider و keys[] مطلوبان" },
        { status: 400 }
      );
    }

    // تنظيف: إزالة الفراغات والمكررات والفارغ
    const cleaned = [...new Set(keys.map(k => k.trim()).filter(Boolean))];

    if (cleaned.length === 0) {
      return NextResponse.json(
        { success: false, error: "لا توجد مفاتيح صالحة بعد التنظيف" },
        { status: 400 }
      );
    }

    // ── اختبار بالتوازي على دفعات ──────────────────────────────────
    const testResults: { key: string; valid: boolean; error?: string }[] = [];

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

    const validKeys   = testResults.filter(r => r.valid);
    const invalidKeys = testResults.filter(r => !r.valid);

    // ── حفظ في DB ──────────────────────────────────────────────────
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
    }

    type ResultStatus = "added" | "failed_test" | "duplicate" | "error";
    const results: { key: string; status: ResultStatus; error?: string }[] = [];

    // سجّل الفاشلة مباشرة
    invalidKeys.forEach(r => results.push({ key: r.key, status: "failed_test", error: r.error }));

    if (validKeys.length > 0) {
      const rows = validKeys.map(r => ({
        provider:  provider.toLowerCase(),
        key:       r.key,
        notes:     notes || null,
        is_backup: isBackup,
        is_active: true,
      }));

      // محاولة upsert جماعي أولاً
      const { data: upserted, error: upsertErr } = await supabase
        .from("api_keys")
        .upsert(rows, { onConflict: "provider,key", ignoreDuplicates: true })
        .select("key");

      if (!upsertErr && upserted) {
        const insertedKeys = new Set(upserted.map((r: any) => r.key));
        validKeys.forEach(r => {
          results.push({ key: r.key, status: insertedKeys.has(r.key) ? "added" : "duplicate" });
        });
      } else {
        // fallback: إضافة واحدة واحدة
        console.warn("[Bulk] upsert failed, falling back to single inserts:", upsertErr?.message);
        for (const r of validKeys) {
          const { error: singleErr } = await supabase
            .from("api_keys")
            .insert({ provider: provider.toLowerCase(), key: r.key, notes: notes || null, is_backup: isBackup, is_active: true });

          if (!singleErr) {
            results.push({ key: r.key, status: "added" });
          } else if (singleErr.message.includes("duplicate") || singleErr.message.includes("unique")) {
            results.push({ key: r.key, status: "duplicate" });
          } else {
            results.push({ key: r.key, status: "error", error: singleErr.message });
          }
        }
      }
    }

    // Hot-reload الذاكرة
    await reloadKeys();

    const added     = results.filter(r => r.status === "added").length;
    const duplicate = results.filter(r => r.status === "duplicate").length;
    const failed    = results.filter(r => r.status === "failed_test").length;
    const errored   = results.filter(r => r.status === "error").length;

    return NextResponse.json({
      success: true,
      summary: { total: cleaned.length, added, duplicate, failed, errored },
      results,
      message: `تمت الإضافة: ${added} | مكرر: ${duplicate} | فشل الاختبار: ${failed}`,
    });

  } catch (error: any) {
    console.error("[Bulk Import] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
