/**
 * GET /api/admin/keys - List all API keys with stats per provider
 * POST /api/admin/keys - Add new API key with optional test
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { reloadKeys } from "@/lib/api-keys-service";

// Test key validity by making a simple API call
async function testApiKey(provider: string, key: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    let response: Response;
    
    switch (provider.toLowerCase()) {
      case "groq":
        response = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        break;
        
      case "openrouter":
        response = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        break;
        
      case "mistral":
        response = await fetch("https://api.mistral.ai/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        break;
        
      case "openai":
        response = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        break;
        
      case "anthropic":
        response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 5,
          }),
        });
        break;
        
      case "google":
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
        );
        break;
        
      case "deepseek":
        response = await fetch("https://api.deepseek.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        break;
        
      case "cerebras":
        response = await fetch("https://api.cerebras.ai/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        break;
        
      case "sambanova":
        response = await fetch("https://api.sambanova.ai/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        break;
        
      case "together":
        response = await fetch("https://api.together.xyz/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        break;
        
      case "cohere":
        response = await fetch("https://api.cohere.ai/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        break;
        
      case "pexels":
        response = await fetch("https://api.pexels.com/v1/curated?per_page=1", {
          headers: { Authorization: key },
        });
        break;
        
      default:
        // For providers without easy test endpoint, assume valid
        return { valid: true };
    }
    
    const valid = response.ok || response.status === 200;
    return {
      valid,
      error: valid ? undefined : `HTTP ${response.status}: ${response.statusText}`,
    };
    
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || "Connection failed",
    };
  }
}

// GET: List all keys grouped by provider
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .order("provider", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Admin API] Failed to fetch keys:", error);
      return NextResponse.json(
        { error: "Failed to fetch keys" },
        { status: 500 }
      );
    }

    // Group by provider with stats
    const grouped: Record<string, any> = {};
    const now = new Date();

    for (const key of data || []) {
      const provider = key.provider;
      if (!grouped[provider]) {
        grouped[provider] = {
          provider,
          keys: [],
          stats: {
            total: 0,
            active: 0,
            backup: 0,
            inCooldown: 0,
          },
        };
      }

      grouped[provider].keys.push({
        id: key.id,
        key: key.key.substring(0, 12) + "..." + key.key.slice(-4), // Masked
        keyFull: key.key, // For editing
        isActive: key.is_active,
        isBackup: key.is_backup,
        notes: key.notes,
        cooldownUntil: key.cooldown_until,
        totalRequests: key.total_requests,
        lastUsedAt: key.last_used_at,
        createdAt: key.created_at,
      });

      grouped[provider].stats.total++;
      if (key.is_active) grouped[provider].stats.active++;
      if (key.is_backup) grouped[provider].stats.backup++;
      if (key.cooldown_until && new Date(key.cooldown_until) > now) {
        grouped[provider].stats.inCooldown++;
      }
    }

    return NextResponse.json({
      success: true,
      providers: Object.values(grouped),
    });
    
  } catch (error: any) {
    console.error("[Admin API] GET error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Add new key
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

    // Optional: Test key before adding
    if (shouldTest) {
      console.log(`[Admin API] Testing ${provider} key...`);
      const testResult = await testApiKey(provider, key);
      if (!testResult.valid) {
        return NextResponse.json(
          { 
            error: "Key test failed",
            details: testResult.error,
            success: false 
          },
          { status: 400 }
        );
      }
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
        provider: provider.toLowerCase(),
        key,
        notes: notes || null,
        is_backup: isBackup || false,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("[Admin API] Insert error:", error);
      return NextResponse.json(
        { 
          error: error.message.includes("duplicate") 
            ? "This key already exists" 
            : "Failed to add key",
          details: error.message 
        },
        { status: 400 }
      );
    }

    // Hot-reload keys
    await reloadKeys();

    return NextResponse.json({
      success: true,
      message: "Key added successfully",
      key: {
        id: data.id,
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
