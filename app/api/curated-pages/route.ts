import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { filterImagesWithAI, type PhotoCandidate } from "@/utils/aiImageFilter";

export interface CuratedPageRequest {
  roomId: string;
  style: string;
  page: number;
  photos: PhotoCandidate[];
  forceRefresh?: boolean;
}

export interface CuratedPageResponse {
  photos: PhotoCandidate[];
  source: "cache" | "ai_filtered" | "fallback";
  rejectedCount: number;
  processingTime: number;
}

const RATE_LIMIT_MS = 1000; // 1 second between Gemini calls
const lastRequestTime = new Map<string, number>();

/**
 * POST /api/curated-pages
 * AI-powered filtering with Supabase caching per page
 */
export async function POST(request: NextRequest): Promise<NextResponse<CuratedPageResponse | { error: string }>> {
  try {
    const body: CuratedPageRequest = await request.json();
    const { roomId, style, page, photos, forceRefresh = false } = body;

    if (!roomId || !style || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: roomId, style, photos" },
        { status: 400 }
      );
    }

    const cacheKey = `${roomId}-${style}-page-${page}`;
    const startTime = Date.now();

    // Rate limiting check
    const now = Date.now();
    const lastRequest = lastRequestTime.get(cacheKey) || 0;
    if (now - lastRequest < RATE_LIMIT_MS) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - (now - lastRequest)));
    }
    lastRequestTime.set(cacheKey, Date.now());

    // 1. Check Supabase cache first (unless force refresh)
    if (!forceRefresh) {
      try {
        const { data: cachedPage, error: cacheError } = await supabase
          .from("curated_pages")
          .select("photos, rejected_count, created_at")
          .eq("cache_key", cacheKey)
          .gt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // 7 day cache
          .single();

        if (!cacheError && cachedPage?.photos) {
          console.log(`[Curated Pages] Cache hit for ${cacheKey}`);
          return NextResponse.json({
            photos: cachedPage.photos as PhotoCandidate[],
            source: "cache",
            rejectedCount: cachedPage.rejected_count || 0,
            processingTime: Date.now() - startTime,
          });
        }
      } catch (cacheErr) {
        console.warn("[Curated Pages] Cache check failed:", cacheErr);
      }
    }

    // 2. No cache - use AI filtering
    console.log(`[Curated Pages] AI filtering ${photos.length} images for ${cacheKey}`);
    
    const roomTypeMap: Record<string, string> = {
      "master-bedroom": "luxury master bedroom",
      "living-room": "luxury living room",
      "kitchen": "modern high-end kitchen",
      "dressing-room": "bespoke walk-in closet",
      "home-office": "luxury home office",
      "youth-room": "modern kids bedroom",
      "dining-room": "luxury dining room",
      "interior-design": "luxury interior design",
    };

    const roomType = roomTypeMap[roomId] || roomId;
    
    const filterResult = await filterImagesWithAI(photos, roomType, style);

    // 3. Store in Supabase cache (if we have approved photos)
    if (filterResult.approvedPhotos.length > 0) {
      try {
        await supabase.from("curated_pages").upsert({
          cache_key: cacheKey,
          room_id: roomId,
          style,
          page,
          photos: filterResult.approvedPhotos,
          rejected_count: filterResult.rejectedCount,
          total_count: photos.length,
          created_at: new Date().toISOString(),
        }, {
          onConflict: "cache_key",
        });
        console.log(`[Curated Pages] Cached ${filterResult.approvedPhotos.length} images for ${cacheKey}`);
      } catch (upsertErr) {
        console.warn("[Curated Pages] Failed to cache:", upsertErr);
      }
    }

    return NextResponse.json({
      photos: filterResult.approvedPhotos,
      source: "ai_filtered",
      rejectedCount: filterResult.rejectedCount,
      processingTime: filterResult.processingTime,
    });

  } catch (error) {
    console.error("[Curated Pages] Route error:", error);
    
    // Fallback: return empty array on error (strict policy)
    return NextResponse.json({
      photos: [],
      source: "fallback",
      rejectedCount: 0,
      processingTime: 0,
      error: "AI filtering failed",
    } as CuratedPageResponse & { error: string }, { status: 500 });
  }
}
