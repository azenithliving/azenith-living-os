import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analyzeImageMetadata, type ImageMetadata } from "@/services/aiEnhancement";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export interface EnhanceImageRequest {
  imageId: number;
  imageUrl: string;
  roomType: string;
  style: string;
}

export interface EnhanceImageResponse {
  metadata: ImageMetadata | null;
  source: "ai" | "cache" | "fallback";
}

/**
 * POST /api/enhance-image
 * AI-powered image metadata enhancement with Supabase caching
 */
export async function POST(request: NextRequest): Promise<NextResponse<EnhanceImageResponse | { error: string }>> {
  try {
    const body: EnhanceImageRequest = await request.json();
    const { imageId, imageUrl, roomType, style } = body;

    if (!imageId || !imageUrl || !roomType || !style) {
      return NextResponse.json(
        { error: "Missing required fields: imageId, imageUrl, roomType, style" },
        { status: 400 }
      );
    }

    // 1. Check if metadata already exists in Supabase
    try {
      const { data: existing, error: checkError } = await supabase
        .from("curated_images")
        .select("metadata")
        .eq("id", imageId)
        .single();

      if (!checkError && existing?.metadata) {
        console.log(`[Enhance Image] Cache hit for image ${imageId}`);
        return NextResponse.json({
          metadata: existing.metadata as ImageMetadata,
          source: "cache",
        });
      }
    } catch (err) {
      console.log(`[Enhance Image] No cache for image ${imageId}, generating new metadata`);
    }

    // 2. Generate metadata using AI
    console.log(`[Enhance Image] Generating metadata for image ${imageId}`);
    const metadata = await analyzeImageMetadata(imageUrl, roomType, style);

    if (!metadata) {
      return NextResponse.json({
        metadata: null,
        source: "fallback",
      });
    }

    // 3. Store in Supabase
    try {
      await supabase.from("curated_images").upsert({
        id: imageId,
        url: imageUrl,
        room_type: roomType,
        style,
        metadata,
        created_at: new Date().toISOString(),
      }, {
        onConflict: "id",
      });
      console.log(`[Enhance Image] Stored metadata for image ${imageId}`);
    } catch (storeErr) {
      console.warn("[Enhance Image] Failed to store metadata:", storeErr);
    }

    return NextResponse.json({
      metadata,
      source: "ai",
    });

  } catch (error) {
    console.error("[Enhance Image] Route error:", error);
    return NextResponse.json(
      { metadata: null, source: "fallback", error: "Enhancement failed" } as EnhanceImageResponse & { error: string },
      { status: 500 }
    );
  }
}
