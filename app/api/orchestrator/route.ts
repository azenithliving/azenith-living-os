import { NextResponse } from 'next/server';
import { askGroqMessages, askDeepSeek, askOpenRouter } from '@/lib/ai-orchestrator';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const startTime = Date.now();
  const { intent, context, options = {} } = await req.json();
  const supabase = getSupabaseAdminClient();

  // 1. ANALYZE RECENT HEALTH
  const { data: healthData } = await supabase
    .from('ai_provider_health')
    .select('*');

  const healthyProviders = healthData?.filter(p => p.is_healthy && p.balance_status === 'sufficient') || [];
  
  // 2. DEFINE PROVIDER CHAIN (Strategy: Quality -> Speed -> Resilience)
  // We prioritize models based on current telemetry
  const providers = [
    { name: 'deepseek', fn: (p: string) => askDeepSeek(p, options) },
    { name: 'groq', fn: (p: string) => askGroqMessages([{ role: 'user', content: p }], options) },
    { name: 'openrouter', fn: (p: string) => askOpenRouter(p, undefined, { ...options, model: "google/gemini-2.0-pro-exp-05:free" }) }
  ];

  // Sort based on health score (simple heuristic for now)
  providers.sort((a, b) => {
    const healthA = healthData?.find(p => p.provider_name === a.name);
    const healthB = healthData?.find(p => p.provider_name === b.name);
    if (!healthA || !healthB) return 0;
    return healthB.latency_ms - healthA.latency_ms; // Prefer lower latency if healthy
  });

  let finalResponse = null;
  let usedProvider = '';

  // 3. EXECUTE RECURSIVE ATTEMPT LOOP
  for (const provider of providers) {
    try {
      usedProvider = provider.name;
      const result = await provider.fn(intent);
      
      if (result.success) {
        finalResponse = result;
        // Update success telemetry
        await updateProviderHealth(provider.name, true, null, Date.now() - startTime);
        break;
      } else {
        console.warn(`⚠️ Provider ${provider.name} failed: ${result.error}`);
        await updateProviderHealth(provider.name, false, result.error);
      }
    } catch (e: any) {
      console.error(`❌ Fatal Error with provider ${provider.name}:`, e);
      await updateProviderHealth(provider.name, false, e.message);
    }
  }

  // 4. LOG EXECUTION TELEMETRY
  if (supabase) {
    await supabase.from('execution_telemetry').insert({
      operation_type: 'genesis_orchestration',
      intent,
      provider_used: usedProvider,
      status: finalResponse?.success ? 'success' : 'failure',
      error_message: finalResponse?.success ? null : 'All providers exhausted',
      execution_time_ms: Date.now() - startTime,
      metadata: { options }
    });
  }

  if (finalResponse?.success) {
    return NextResponse.json(finalResponse);
  }

  return NextResponse.json({ 
    success: false, 
    error: "THE OMNIPOTENT PROTOCOL FAILED TO PENETRATE THE OBSTACLE. ALL CHANNELS EXHAUSTED.",
    details: "This is a rare convergence of provider failures. Manual intervention required."
  }, { status: 503 });
}

async function updateProviderHealth(name: string, success: boolean, error: string | null, latency?: number) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  const { data: current } = await supabase
    .from('ai_provider_health')
    .select('*')
    .eq('provider_name', name)
    .single();

  const updates: any = {
    last_checked: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (success) {
    updates.is_healthy = true;
    updates.consecutive_failures = 0;
    updates.balance_status = 'sufficient';
    if (latency) updates.latency_ms = latency;
  } else {
    updates.consecutive_failures = (current?.consecutive_failures || 0) + 1;
    updates.last_error = error;
    if (error?.includes('402') || error?.includes('balance')) {
      updates.balance_status = 'empty';
      updates.is_healthy = false;
    }
    if (updates.consecutive_failures > 3) {
      updates.is_healthy = false;
    }
  }

  await supabase
    .from('ai_provider_health')
    .update(updates)
    .eq('provider_name', name);
}
