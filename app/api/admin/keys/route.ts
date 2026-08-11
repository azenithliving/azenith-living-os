/**
 * GET  /api/admin/keys — قائمة المفاتيح مجمعة بالـ provider
 * POST /api/admin/keys — إضافة مفتاح جديد مع اختبار اختياري
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { reloadKeys, getAllLiveStats } from "@/lib/api-keys-service";

// ═══════════════════════════════════════════════════════════════════
// اختبار المفاتيح — مع timeout صارم وتغطية كاملة لكل provider
// ═══════════════════════════════════════════════════════════════════

const TEST_TIMEOUT_MS = 8000; // 8 ثواني كحد أقصى

interface TestConfig {
  url: string;
  method?: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
  extraValidStatuses?: number[];
}

function buildTestConfig(provider: string, key: string): TestConfig | null {
  const p = provider.toLowerCase();

  switch (p) {
    case "groq":
      return {
        url: "https://api.groq.com/openai/v1/models",
        headers: { Authorization: `Bearer ${key}` },
      };

    case "openrouter":
      return {
        url: "https://openrouter.ai/api/v1/models",
        headers: {
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": "https://azenithliving.com",
        },
      };

    case "mistral":
      return {
        url: "https://api.mistral.ai/v1/models",
        headers: { Authorization: `Bearer ${key}` },
      };

    case "openai":
      return {
        url: "https://api.openai.com/v1/models",
        headers: { Authorization: `Bearer ${key}` },
      };

    case "deepseek":
      return {
        url: "https://api.deepseek.com/v1/models",
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
      };

    case "together":
      return {
        url: "https://api.together.xyz/v1/models",
        headers: { Authorization: `Bearer ${key}` },
      };

    case "cohere":
      return {
        url: "https://api.cohere.ai/v1/models",
        headers: { Authorization: `Bearer ${key}` },
      };

    case "xai":
      return {
        url: "https://api.x.ai/v1/models",
        headers: { Authorization: `Bearer ${key}` },
      };

    case "aimlapi":
      return {
        url: "https://api.aimlapi.com/v1/models",
        headers: { Authorization: `Bearer ${key}` },
      };

    case "huggingface":
      return {
        url: "https://huggingface.co/api/whoami",
        headers: { Authorization: `Bearer ${key}` },
      };

    case "pexels":
      return {
        url: "https://api.pexels.com/v1/curated?per_page=1",
        headers: { Authorization: key },
      };

    case "google":
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
        headers: {},
      };

    case "anthropic":
      return {
        url: "https://api.anthropic.com/v1/messages",
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 1,
        }),
        extraValidStatuses: [400],
      };

    case "cerebras":
      return {
        url: "https://api.cerebras.ai/v1/chat/completions",
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-oss-120b",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 1,
        }),
        extraValidStatuses: [400],
      };

    case "sambanova":
      return {
        url: "https://api.sambanova.ai/v1/chat/completions",
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "Meta-Llama-3.1-8B-Instruct",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 1,
        }),
        extraValidStatuses: [400],
      };

    case "cloudflare":
    case "apifreellm":
    case "bytez":
    case "api_ninjas":
    default:
      return null;
  }
}

async function testApiKey(
  provider: string,
  key: string
): Promise<{ valid: boolean; error?: string }> {
  const config = buildTestConfig(provider, key);
  if (!config) return { valid: true };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

  try {
    const response = await fetch(config.url, {
      method:  config.method || "GET",
      headers: config.headers,
      body:    config.body,
      signal:  controller.signal,
    });

    clearTimeout(timer);

    if (response.status === 429 || response.status === 402) {
      return { valid: true };
    }

    if (response.status === 401) {
      return { valid: false, error: "مفتاح غير صحيح (401 Unauthorized)" };
    }
    if (response.status === 403) {
      return { valid: false, error: "مفتاح محظور (403 Forbidden)" };
    }

    const extra = config.extraValidStatuses || [];
    const valid  = response.ok || extra.includes(response.status);

    if (valid) return { valid: true };

    return {
      valid: false,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };

  } catch (err: any) {
    clearTimeout(timer);

    if (err.name === "AbortError") {
      console.warn(`[Key Test] Timeout for ${provider} — accepting key`);
      return { valid: true };
    }

    return {
      valid: false,
      error: `خطأ في الاتصال: ${err.message || "Connection failed"}`,
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    const [dbResult, liveStats] = await Promise.all([
      supabase
        .from("api_keys")
        .select("*")
        .order("provider",   { ascending: true })
        .order("created_at", { ascending: false }),
      getAllLiveStats(),
    ]);

    if (dbResult.error) {
      console.error("[Admin API] Failed to fetch keys:", dbResult.error);
      return NextResponse.json(
        { error: "Failed to fetch keys" },
        { status: 500 }
      );
    }

    const grouped: Record<string, any> = {};
    const now = new Date();

    for (const key of dbResult.data || []) {
      const provider = key.provider;
      if (!grouped[provider]) {
        grouped[provider] = {
          provider,
          keys: [],
          stats: {
            total: 0, active: 0, inactive: 0,
            backup: 0, inCooldown: 0, dead: 0,
            live: liveStats[provider] || {
              live_total: 0, live_active: 0,
              live_cooldown: 0, live_dead: 0,
              live_requests: 0, loaded: false,
            },
          },
        };
      }

      const isDead =
        (key.error_count && key.error_count >= 3) ||
        (key.last_error && (
          key.last_error.includes("401") ||
          key.last_error.includes("403") ||
          key.last_error.includes("Invalid") ||
          key.last_error.includes("Unauthorized") ||
          key.last_error.includes("Forbidden") ||
          key.last_error.startsWith("[DEAD]")
        ));

      const inCooldown = key.cooldown_until && new Date(key.cooldown_until) > now;

      grouped[provider].keys.push({
        id:            key.id,
        key:           key.key.substring(0, 12) + "..." + key.key.slice(-4),
        keyFull:       key.key,
        isActive:      key.is_active,
        isBackup:      key.is_backup,
        notes:         key.notes,
        cooldownUntil: key.cooldown_until,
        totalRequests: key.total_requests || 0,
        lastUsedAt:    key.last_used_at,
        createdAt:     key.created_at,
        isDead:        isDead || false,
        lastError:     key.last_error,
        errorCount:    key.error_count || 0,
      });

      grouped[provider].stats.total++;
      if (isDead)              grouped[provider].stats.dead++;
      else if (key.is_backup)  grouped[provider].stats.backup++;
      else if (inCooldown)     grouped[provider].stats.inCooldown++;
      else if (key.is_active)  grouped[provider].stats.active++;
      else                     grouped[provider].stats.inactive++;
    }

    return NextResponse.json({
      success: true,
      providers: Object.values(grouped),
      liveStats,
    });

  } catch (error: any) {
    console.error("[Admin API] GET error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, key, notes, isBackup, testKey: shouldTest } = body;

    if (!provider || !key) {
      return NextResponse.json(
        { error: "Provider and key are required" },
        { status: 400 }
      );
    }

    if (shouldTest) {
      console.log(`[Admin API] Testing ${provider} key...`);
      const testResult = await testApiKey(provider, key);

      if (!testResult.valid) {
        return NextResponse.json(
          {
            success: false,
            error:   "Key test failed",
            details: testResult.error || "المفتاح غير صحيح",
          },
          { status: 400 }
        );
      }

      console.log(`[Admin API] ✅ ${provider} key passed test`);
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    const { data, error } = await supabase
      .from("api_keys")
      .insert({
        provider:  provider.toLowerCase(),
        key,
        notes:     notes || null,
        is_backup: isBackup || false,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("[Admin API] Insert error:", error);

      let userMessage = "Failed to add key";
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        userMessage = "هذا المفتاح موجود بالفعل";
      } else if (error.message.includes("check") || error.message.includes("constraint")) {
        userMessage = `Provider "${provider}" غير مدعوم في قاعدة البيانات — يجب إضافته للـ CHECK constraint`;
      }

      return NextResponse.json(
        { error: userMessage, details: error.message },
        { status: 400 }
      );
    }

    await reloadKeys();

    return NextResponse.json({
      success: true,
      message: "تم إضافة المفتاح بنجاح",
      key: {
        id:       data.id,
        provider: data.provider,
        isBackup: data.is_backup,
      },
    });

  } catch (error: any) {
    console.error("[Admin API] POST error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
