/**
 * API Keys Management API
 * Manage API keys from database with CRUD operations
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

// Helper to mask key (show first 4 and last 4 chars)
function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

// Helper to test key validity
async function testKey(provider: string, key: string): Promise<{ valid: boolean; message: string }> {
  try {
    let testUrl: string;
    let headers: Record<string, string> = { "Authorization": `Bearer ${key}` };

    switch (provider) {
      case "groq":
        testUrl = "https://api.groq.com/openai/v1/models";
        break;
      case "mistral":
        testUrl = "https://api.mistral.ai/v1/models";
        break;
      case "openrouter":
        testUrl = "https://openrouter.ai/api/v1/models";
        break;
      case "pexels":
        testUrl = "https://api.pexels.com/v1/curated?per_page=1";
        break;
      default:
        return { valid: false, message: "Unknown provider" };
    }

    const response = await fetch(testUrl, { headers, method: "GET" });

    if (response.ok) {
      return { valid: true, message: "Key is valid" };
    } else if (response.status === 401 || response.status === 403) {
      return { valid: false, message: "Invalid key or unauthorized" };
    } else if (response.status === 429) {
      return { valid: true, message: "Key valid but rate limited" };
    } else {
      return { valid: false, message: `HTTP ${response.status}: ${response.statusText}` };
    }
  } catch (error) {
    return { valid: false, message: error instanceof Error ? error.message : "Network error" };
  }
}

/**
 * GET /api/admin/keys
 * List all API keys (masked)
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, provider, key, is_active, cooldown_until, total_requests, last_used_at, created_at")
      .order("provider", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Keys API] Error fetching keys:", JSON.stringify(error, null, 2));
      return NextResponse.json(
        { success: false, error: "Failed to fetch keys", details: error },
        { status: 500 }
      );
    }

    // Mask keys for security
    const maskedKeys = data.map((k) => ({
      id: k.id,
      provider: k.provider,
      key: maskKey(k.key),
      is_active: k.is_active,
      cooldown_until: k.cooldown_until,
      total_requests: k.total_requests,
      last_used_at: k.last_used_at,
      created_at: k.created_at,
    }));

    // Group by provider
    const grouped = {
      groq: maskedKeys.filter((k) => k.provider === "groq"),
      openrouter: maskedKeys.filter((k) => k.provider === "openrouter"),
      mistral: maskedKeys.filter((k) => k.provider === "mistral"),
      pexels: maskedKeys.filter((k) => k.provider === "pexels"),
    };

    return NextResponse.json({ success: true, keys: maskedKeys, grouped });
  } catch (error) {
    console.error("[Keys API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/keys
 * Add new key: { provider, key }
 * Test key: { provider, key, test: true }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, key, test } = body;

    if (!provider || !key) {
      return NextResponse.json(
        { success: false, error: "Missing provider or key" },
        { status: 400 }
      );
    }

    // Validate provider
    const validProviders = ["groq", "openrouter", "mistral", "pexels"];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { success: false, error: `Invalid provider. Must be one of: ${validProviders.join(", ")}` },
        { status: 400 }
      );
    }

    // Test key if requested
    if (test) {
      const testResult = await testKey(provider, key);
      return NextResponse.json({
        success: true,
        valid: testResult.valid,
        message: testResult.message,
      });
    }

    // Insert key
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("api_keys")
      .insert({ provider, key })
      .select("id, provider, is_active, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { success: false, error: "Key already exists for this provider" },
          { status: 409 }
        );
      }
      console.error("[Keys API] Error inserting key:", error);
      return NextResponse.json(
        { success: false, error: "Failed to add key" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      key: { ...data, key: maskKey(key) },
      message: "Key added successfully",
    });
  } catch (error) {
    console.error("[Keys API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/keys
 * Delete key: { id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing key id" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("api_keys")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[Keys API] Error deleting key:", error);
      return NextResponse.json(
        { success: false, error: "Failed to delete key" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Key ${id} deleted successfully`,
    });
  } catch (error) {
    console.error("[Keys API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
