import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { filterImagesWithAI, type PhotoCandidate } from "@/utils/aiImageFilter";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// Constants for reservoir pattern
const POOL_SIZE = 80; // Total curated images to store per room-style
const DELIVERY_SIZE = 15; // Images delivered per request
const POOL_TTL_DAYS = 30; // Refresh pool every 30 days

export interface CuratedReservoirRequest {
  roomId: string;
  style: string;
  seed?: number; // For deterministic randomization during session
  forceRefresh?: boolean;
}

export interface CuratedReservoirResponse {
  photos: PhotoCandidate[];
  source: "reservoir" | "ai_curated" | "fallback";
  poolSize: number;
  deliveredCount: number;
  isRefreshing: boolean;
}

interface ImagePool {
  id: string;
  room_id: string;
  style: string;
  pool: PhotoCandidate[];
  metadata: {
    totalCurated: number;
    lastRefreshed: string;
  };
  created_at: string;
}

/**
 * Shuffle array using Fisher-Yates algorithm with seeded random
 */
function shuffleArray<T>(array: T[], seed?: number): T[] {
  const shuffled = [...array];
  let currentSeed = seed || Date.now();
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Simple seeded random
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const j = Math.floor((currentSeed / 233280) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

/**
 * Get random subset from pool
 */
function getRandomSubset<T>(pool: T[], count: number, seed?: number): T[] {
  const shuffled = shuffleArray(pool, seed);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Check if pool needs refresh (30+ days old)
 */
function isPoolStale(createdAt: string): boolean {
  const poolDate = new Date(createdAt);
  const cutoffDate = new Date(Date.now() - POOL_TTL_DAYS * 24 * 60 * 60 * 1000);
  return poolDate < cutoffDate;
}

/**
 * POST /api/curated-images
 * Dynamic Content Reservoir with rotation
 */
export async function POST(request: NextRequest): Promise<NextResponse<CuratedReservoirResponse | { error: string }>> {
  try {
    const body: CuratedReservoirRequest = await request.json();
    const { roomId, style, seed, forceRefresh = false } = body;

    if (!roomId || !style) {
      return NextResponse.json(
        { error: "Missing required fields: roomId, style" },
        { status: 400 }
      );
    }

    const poolKey = `${roomId}-${style}`;
    const startTime = Date.now();

    // 1. Check for existing pool in database
    let poolData: ImagePool | null = null;
    let isRefreshing = false;

    try {
      const { data, error } = await supabase
        .from("curated_reservoirs")
        .select("*")
        .eq("id", poolKey)
        .single();

      if (!error && data) {
        poolData = data as ImagePool;
      }
    } catch (err) {
      console.log(`[Reservoir] No existing pool for ${poolKey}`);
    }

    // 2. Check if pool needs refresh (30+ days old or forced)
    const needsRefresh = !poolData || 
                        forceRefresh || 
                        isPoolStale(poolData.created_at) ||
                        (poolData.pool?.length || 0) < POOL_SIZE / 2;

    if (needsRefresh && !isRefreshing) {
      isRefreshing = true;
      
      // Trigger background refresh (don't await)
      refreshPoolInBackground(roomId, style, poolKey);
    }

    // 3. If we have a valid pool, deliver random subset
    if (poolData && poolData.pool && poolData.pool.length > 0) {
      const deliveredPhotos = getRandomSubset(poolData.pool, DELIVERY_SIZE, seed);
      
      console.log(`[Reservoir] Delivered ${deliveredPhotos.length}/${poolData.pool.length} images from ${poolKey} (refreshing: ${isRefreshing})`);
      
      return NextResponse.json({
        photos: deliveredPhotos,
        source: "reservoir",
        poolSize: poolData.pool.length,
        deliveredCount: deliveredPhotos.length,
        isRefreshing,
      });
    }

    // 4. No pool available - fallback to on-demand curation
    console.log(`[Reservoir] No pool available, falling back to on-demand for ${poolKey}`);
    
    // Fetch from Pexels
    const roomQueries: Record<string, string> = {
      "master-bedroom": "luxury master bedroom interior -office -desk",
      "living-room": "luxury living room lounge architecture",
      "kitchen": "modern high-end kitchen marble",
      "dressing-room": "bespoke walk-in closet furniture design",
      "home-office": "luxury home office study room -bedroom -living",
      "youth-room": "modern youth bedroom design",
      "dining-room": "luxury dining room interior",
      "interior-design": "luxury interior design architecture",
    };

    const query = roomQueries[roomId] || `${roomId} luxury interior`;
    const pexelsResponse = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${POOL_SIZE}&page=1`,
      {
        headers: {
          Authorization: process.env.NEXT_PUBLIC_PEXELS_API_KEY || "",
        },
      }
    );

    if (!pexelsResponse.ok) {
      return NextResponse.json(
        { photos: [], source: "fallback", poolSize: 0, deliveredCount: 0, isRefreshing: false },
        { status: 200 }
      );
    }

    const pexelsData = await pexelsResponse.json();
    const rawPhotos: PhotoCandidate[] = pexelsData.photos?.map((p: unknown) => ({
      id: (p as { id: number }).id,
      url: (p as { url: string }).url,
      src: (p as { src: PhotoCandidate["src"] }).src,
      alt: (p as { alt?: string }).alt,
    })) || [];

    // Filter with AI
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

    const filterResult = await filterImagesWithAI(rawPhotos, roomTypeMap[roomId] || roomId, style);
    
    // Deliver subset
    const deliveredPhotos = getRandomSubset(filterResult.approvedPhotos, DELIVERY_SIZE, seed);

    // Store new pool (fire and forget)
    if (filterResult.approvedPhotos.length > 0) {
      storePool(poolKey, roomId, style, filterResult.approvedPhotos);
    }

    return NextResponse.json({
      photos: deliveredPhotos,
      source: "ai_curated",
      poolSize: filterResult.approvedPhotos.length,
      deliveredCount: deliveredPhotos.length,
      isRefreshing: false,
    });

  } catch (error) {
    console.error("[Reservoir] Route error:", error);
    return NextResponse.json(
      { photos: [], source: "fallback", poolSize: 0, deliveredCount: 0, isRefreshing: false },
      { status: 500 }
    );
  }
}

/**
 * Background pool refresh with Empty Batch Rule
 * If batch yields 0 perfect matches, auto-fetch next batch until MIN_PERFECT_MATCHES found
 */
const MIN_PERFECT_MATCHES = 6;
const MAX_FETCH_ATTEMPTS = 5;

async function refreshPoolInBackground(roomId: string, style: string, poolKey: string): Promise<void> {
  try {
    console.log(`[Reservoir] Starting background refresh for ${poolKey} with Empty Batch Rule`);
    
    // Fetch fresh images from Pexels (multiple pages for variety)
    const roomQueries: Record<string, string> = {
      "master-bedroom": "luxury master bedroom interior -office -desk",
      "living-room": "luxury living room lounge architecture",
      "kitchen": "modern high-end kitchen marble",
      "dressing-room": "bespoke walk-in closet furniture design",
      "home-office": "luxury home office study room -bedroom -living",
      "youth-room": "modern youth bedroom design",
      "dining-room": "luxury dining room interior",
      "interior-design": "luxury open-plan penthouse architecture",
    };

    const query = roomQueries[roomId] || `${roomId} luxury interior`;
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

    let allApprovedPhotos: PhotoCandidate[] = [];
    let fetchAttempts = 0;
    let currentPage = 1;

    // EMPTY BATCH RULE: Keep fetching until we have at least MIN_PERFECT_MATCHES
    while (allApprovedPhotos.length < MIN_PERFECT_MATCHES && fetchAttempts < MAX_FETCH_ATTEMPTS) {
      fetchAttempts++;
      console.log(`[Reservoir] Fetch attempt ${fetchAttempts}: Need ${MIN_PERFECT_MATCHES - allApprovedPhotos.length} more perfect images`);
      
      const batchRawPhotos: PhotoCandidate[] = [];
      
      // Fetch 2 pages per attempt (80 images raw)
      for (let pageOffset = 0; pageOffset < 2; pageOffset++) {
        const page = currentPage + pageOffset;
        const response = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=40&page=${page}`,
          {
            headers: {
              Authorization: process.env.NEXT_PUBLIC_PEXELS_API_KEY || "",
            },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          const photos = data.photos?.map((p: unknown) => ({
            id: (p as { id: number }).id,
            url: (p as { url: string }).url,
            src: (p as { src: PhotoCandidate["src"] }).src,
            alt: (p as { alt?: string }).alt,
          })) || [];
          batchRawPhotos.push(...photos);
        }
        
        // Rate limit between requests
        if (pageOffset < 1) await new Promise(r => setTimeout(r, 1000));
      }
      
      currentPage += 2;

      // Filter this batch with AI (Extreme Strictness)
      const filterResult = await filterImagesWithAI(batchRawPhotos, roomTypeMap[roomId] || roomId, style);
      
      console.log(`[Reservoir] Batch ${fetchAttempts}: ${filterResult.approvedPhotos.length}/${batchRawPhotos.length} passed AI filter`);
      
      // Add approved photos to our collection
      allApprovedPhotos.push(...filterResult.approvedPhotos);
      
      // If this batch had 0 matches, log warning and continue to next batch (Empty Batch Rule)
      if (filterResult.approvedPhotos.length === 0) {
        console.warn(`[Reservoir] EMPTY BATCH detected - 0 perfect matches. Fetching next batch...`);
      }
      
      // Rate limit between batches
      if (fetchAttempts < MAX_FETCH_ATTEMPTS && allApprovedPhotos.length < MIN_PERFECT_MATCHES) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // Store refreshed pool if we have any approved photos
    if (allApprovedPhotos.length > 0) {
      await storePool(poolKey, roomId, style, allApprovedPhotos);
      console.log(`[Reservoir] Background refresh complete: ${allApprovedPhotos.length} perfect images stored (${fetchAttempts} fetch attempts)`);
      
      if (allApprovedPhotos.length < MIN_PERFECT_MATCHES) {
        console.warn(`[Reservoir] WARNING: Only ${allApprovedPhotos.length} perfect images found after ${fetchAttempts} attempts (target: ${MIN_PERFECT_MATCHES})`);
      }
    } else {
      console.error(`[Reservoir] CRITICAL: No perfect images found after ${MAX_FETCH_ATTEMPTS} fetch attempts`);
    }
  } catch (error) {
    console.error("[Reservoir] Background refresh failed:", error);
  }
}

/**
 * Store pool in Supabase
 */
async function storePool(
  poolKey: string, 
  roomId: string, 
  style: string, 
  photos: PhotoCandidate[]
): Promise<void> {
  try {
    await supabase.from("curated_reservoirs").upsert({
      id: poolKey,
      room_id: roomId,
      style,
      pool: photos,
      metadata: {
        totalCurated: photos.length,
        lastRefreshed: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    }, {
      onConflict: "id",
    });
    console.log(`[Reservoir] Stored ${photos.length} images for ${poolKey}`);
  } catch (err) {
    console.error("[Reservoir] Failed to store pool:", err);
  }
}
