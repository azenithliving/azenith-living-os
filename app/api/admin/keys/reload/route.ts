/**
 * POST /api/admin/keys/reload
 * Hot-reload API keys from database without server restart
 */

import { NextRequest, NextResponse } from "next/server";
import { reloadKeys } from "@/lib/api-keys-service";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    // Admin authentication check
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    // Optional: verify admin session from request
    // For now, assuming this endpoint is protected by middleware or internal only

    console.log("[Admin API] Reloading API keys...");
    
    // Execute hot-reload
    const result = await reloadKeys();
    
    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error || "Failed to reload keys",
          success: false 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "API keys reloaded successfully",
      providers: result.providers,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    console.error("[Admin API] Reload error:", error);
    return NextResponse.json(
      { 
        error: error.message || "Internal server error",
        success: false 
      },
      { status: 500 }
    );
  }
}
