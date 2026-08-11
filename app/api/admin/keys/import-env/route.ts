/**
 * POST /api/admin/keys/import-env
 * ⚠️ استيراد كل المفاتيح من env variables إلى قاعدة البيانات
 * يُستخدم مرة واحدة فقط للانتقال الكامل لنظام DB-only
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

// Parse key pools from environment
const parseKeyPool = (envPrefix: string): string[] => {
  let allKeys: string[] = [];
  
  if (process.env[envPrefix]) {
    allKeys = allKeys.concat(process.env[envPrefix]!.split(",").map((k) => k.trim()).filter(Boolean));
  }
  
  for (let i = 1; i <= 20; i++) {
    const chunkName = `${envPrefix}_${i}`;
    if (process.env[chunkName]) {
      allKeys = allKeys.concat(process.env[chunkName]!.split(",").map((k) => k.trim()).filter(Boolean));
    }
  }
  
  return Array.from(new Set(allKeys));
};

const ENV_KEY_POOLS: Record<string, string[]> = {
  groq:        parseKeyPool("GROQ_KEYS"),
  openrouter:  parseKeyPool("OPENROUTER_KEYS"),
  mistral:     parseKeyPool("MISTRAL_KEYS"),
  pexels:      parseKeyPool("PEXELS_KEYS"),
  deepseek:    parseKeyPool("DEEPSEEK_KEYS"),
  google:      parseKeyPool("GOOGLE_AI_KEYS").length > 0 ? parseKeyPool("GOOGLE_AI_KEYS") : parseKeyPool("GEMINI_API_KEY"),
  together:    parseKeyPool("TOGETHER_API_KEYS"),
  cerebras:    parseKeyPool("CEREBRAS_API_KEY"),
  cohere:      parseKeyPool("COHERE_API_KEY"),
  aimlapi:     parseKeyPool("AIMLAPI_KEYS"),
  nvidia:      parseKeyPool("NVIDIA_API_KEYS"),
  chutes:      parseKeyPool("CHUTES_API_KEYS"),
  cloudflare:  parseKeyPool("CLOUDFLARE_AI_KEYS"),
  huggingface: parseKeyPool("HUGGINGFACE_KEYS"),
  apifreellm:  parseKeyPool("APIFREELLM_KEYS"),
  bytez:       parseKeyPool("BYTEZ_KEYS"),
  api_ninjas:  parseKeyPool("API_NINJAS_KEYS"),
};

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    let totalImported = 0;
    let totalSkipped = 0;
    const details: Record<string, { imported: number; skipped: number; total: number }> = {};

    // ✅ Batch insert لكل provider دفعة واحدة بدل key واحد key واحد
    for (const [provider, keys] of Object.entries(ENV_KEY_POOLS)) {
      if (keys.length === 0) {
        details[provider] = { imported: 0, skipped: 0, total: 0 };
        continue;
      }

      // Get existing keys لهذا الـ provider دفعة واحدة
      const { data: existingKeys } = await supabase
        .from("api_keys")
        .select("key")
        .eq("provider", provider);

      const existingKeysSet = new Set(existingKeys?.map(k => k.key) || []);
      
      // Filter out duplicates
      const keysToInsert = keys.filter(k => !existingKeysSet.has(k));
      const skipped = keys.length - keysToInsert.length;

      if (keysToInsert.length > 0) {
        // Bulk insert - دفعة واحدة!
        const { error: insertError } = await supabase
          .from("api_keys")
          .insert(
            keysToInsert.map(key => ({
              provider: provider,
              key: key,
              is_active: true,
              is_backup: false,
              notes: "Imported from env variables",
              total_requests: 0,
            }))
          );

        if (insertError) {
          console.error(`[Import] Failed to insert ${provider} keys:`, insertError);
          details[provider] = { imported: 0, skipped: keys.length, total: keys.length };
        } else {
          totalImported += keysToInsert.length;
          totalSkipped += skipped;
          details[provider] = {
            imported: keysToInsert.length,
            skipped,
            total: keys.length,
          };
        }
      } else {
        totalSkipped += skipped;
        details[provider] = { imported: 0, skipped, total: keys.length };
      }
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${totalImported} keys, skipped ${totalSkipped} duplicates`,
      totalImported,
      totalSkipped,
      details,
    });

  } catch (error: any) {
    console.error("[Import] Error:", error);
    return NextResponse.json(
      { error: error.message || "Import failed" },
      { status: 500 }
    );
  }
}
