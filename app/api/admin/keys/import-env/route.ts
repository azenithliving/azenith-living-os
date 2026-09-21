import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { AdminApiAuthError, requireAdminApiAccess } from "@/lib/admin-api-auth";

const parseKeyPool = (envPrefix: string): string[] => {
  const values = [process.env[envPrefix] || ""];
  for (let i = 1; i <= 20; i++) values.push(process.env[`${envPrefix}_${i}`] || "");
  return [...new Set(values.flatMap((value) => value.split(",").map((key) => key.trim()).filter(Boolean)))];
};

const ENV_KEY_POOLS: Record<string, string[]> = {
  groq: parseKeyPool("GROQ_KEYS"), openrouter: parseKeyPool("OPENROUTER_KEYS"), mistral: parseKeyPool("MISTRAL_KEYS"), pexels: parseKeyPool("PEXELS_KEYS"), deepseek: parseKeyPool("DEEPSEEK_KEYS"), google: parseKeyPool("GOOGLE_AI_KEYS").length ? parseKeyPool("GOOGLE_AI_KEYS") : parseKeyPool("GEMINI_API_KEY"), together: parseKeyPool("TOGETHER_API_KEYS"), cerebras: parseKeyPool("CEREBRAS_API_KEY"), cohere: parseKeyPool("COHERE_API_KEY"), xai: parseKeyPool("XAI_KEYS"), api_ninjas: parseKeyPool("API_NINJAS_KEYS"), aimlapi: parseKeyPool("AIMLAPI_KEYS"), apifreellm: parseKeyPool("APIFREELLM_KEYS"), bytez: parseKeyPool("BYTEZ_KEYS"), nvidia: parseKeyPool("NVIDIA_KEYS"), chutes: parseKeyPool("CHUTES_KEYS"),
};

export async function POST(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const details: Record<string, { imported: number; skipped: number; total: number; error?: string }> = {};

    for (const [provider, keys] of Object.entries(ENV_KEY_POOLS)) {
      if (!keys.length) { details[provider] = { imported: 0, skipped: 0, total: 0 }; continue; }
      const { data: existing, error: existingError } = await supabase.from("api_keys").select("key").eq("provider", provider);
      if (existingError) { totalErrors++; details[provider] = { imported: 0, skipped: 0, total: keys.length, error: existingError.message }; continue; }
      const existingSet = new Set((existing || []).map((row: { key: string }) => row.key));
      const toInsert = keys.filter((key) => !existingSet.has(key));
      const skipped = keys.length - toInsert.length;
      if (!toInsert.length) { totalSkipped += skipped; details[provider] = { imported: 0, skipped, total: keys.length }; continue; }
      const { error } = await supabase.from("api_keys").insert(toInsert.map((key) => ({ provider, key, is_active: true, is_backup: false, notes: "Imported from env variables", total_requests: 0 })));
      if (error) { totalErrors++; details[provider] = { imported: 0, skipped, total: keys.length, error: error.message }; continue; }
      totalImported += toInsert.length; totalSkipped += skipped; details[provider] = { imported: toInsert.length, skipped, total: keys.length };
    }

    if (totalErrors) return NextResponse.json({ success: false, partial: totalImported > 0, totalImported, totalSkipped, totalErrors, details, error: "Some providers failed to import" }, { status: 502 });
    return NextResponse.json({ success: true, totalImported, totalSkipped, details });
  } catch (error) {
    if (error instanceof AdminApiAuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("[Import] Error:", error);
    return NextResponse.json({ success: false, error: "Import failed" }, { status: 500 });
  }
}
