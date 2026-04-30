/**
 * Azenith Infinite Pulse: Mark Dead Image API
 * 
 * Marks images as inactive when they fail to load in the browser.
 * Part of the Auto-Healing system.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageId } = body;

    if (!imageId || typeof imageId !== "number") {
      return NextResponse.json(
        { error: "Invalid imageId" },
        { status: 400 }
      );
    }

    // Mark image as inactive
    const { error } = await supabase
      .from("curated_images")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
        metadata: {
          ...await getExistingMetadata(imageId),
          marked_dead_at: new Date().toISOString(),
          marked_dead_reason: "Client-side load failure"
        }
      })
      .eq("id", imageId);

    if (error) {
      console.error(`[Mark Dead] Failed to mark image ${imageId}:`, error);
      return NextResponse.json(
        { error: "Failed to mark image" },
        { status: 500 }
      );
    }

    console.log(`[Mark Dead] Image ${imageId} marked as dead`);

    return NextResponse.json({
      success: true,
      imageId,
      message: "Image marked as inactive"
    });

  } catch (error) {
    console.error("[Mark Dead] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function getExistingMetadata(imageId: number): Promise<Record<string, any>> {
  const { data } = await supabase
    .from("curated_images")
    .select("metadata")
    .eq("id", imageId)
    .single();
  
  return data?.metadata || {};
}
