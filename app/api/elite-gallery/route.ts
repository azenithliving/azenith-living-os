/**
 * Azenith Infinite Pulse: Elite Gallery API
 * Server-side shuffled image fetching with random seed
 * 
 * Features:
 * - Randomized image selection from curated database
 * - Seed-based shuffling for reproducible randomness
 * - Returns 100 images per request (fresh sequence every time)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";

// ============================================
// FISHER-YATES SHUFFLE ALGORITHM
// ============================================

type RandomGenerator = () => number;

function seededRandom(seed: number): RandomGenerator {
  // Linear Congruential Generator for reproducible randomness
  let currentSeed = seed;
  const a = 1664525;
  const c = 1013904223;
  const m = 4294967296;
  
  return (): number => {
    currentSeed = (a * currentSeed + c) % m;
    return currentSeed / m;
  };
}

function shuffleArray<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  const random = seededRandom(seed);
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

// ============================================
// MAIN API HANDLER
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Check if Supabase client is available
    if (!supabase) {
      console.error("[Elite Gallery API] Supabase client not available, using Pexels fallback");
      const { searchParams } = new URL(request.url);
      const roomId = searchParams.get("roomId") || "interior-design";
      const style = searchParams.get("style") || "modern";
      const seed = parseInt(searchParams.get("seed") || Date.now().toString());
      const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 100);
      return await fetchFromPexelsFallback(roomId, style, seed, limit);
    }
    
    const { searchParams } = new URL(request.url);
    
    // Parse parameters
    const roomId = searchParams.get("roomId") || "interior-design";
    const style = searchParams.get("style") || "modern";
    const seed = parseInt(searchParams.get("seed") || Date.now().toString());
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 100);
    
    console.log(`[Elite Gallery API] Fetching: ${roomId}/${style} (seed: ${seed})`);
    
    // Fetch images from curated database
    // NOTE: is_active column removed - add it via migration if needed:
    // ALTER TABLE curated_images ADD COLUMN is_active BOOLEAN DEFAULT true;
    const { data: images, error } = await supabase!
      .from("curated_images")
      .select("*")
      .eq("room_type", roomId)
      .eq("style", style)
      .limit(1000); // Get large pool for shuffling
    
    if (error) {
      console.error("[Elite Gallery API] Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch images", photos: [] },
        { status: 500 }
      );
    }
    
    if (!images || images.length === 0) {
      console.log(`[Elite Gallery API] No images found for ${roomId}/${style}`);
      
      // Fallback: fetch from Pexels if no curated images
      return await fetchFromPexelsFallback(roomId, style, seed, limit);
    }
    
    // Shuffle images using seed for reproducible randomness
    const shuffled = shuffleArray(images, seed);
    
    // Transform to Photo format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const photos = shuffled.slice(0, limit).map((image: any) => ({
      id: image.id,
      src: {
        large2x: image.url as string,
        large: image.url as string,
        medium: (image.url as string).replace("?auto=compress&cs=tinysrgb&h=650&w=940", "?auto=compress&cs=tinysrgb&h=400&w=600"),
        original: image.url as string
      },
      alt: `${roomId} ${style} design`,
      photographer: (image.metadata?.photographer as string) || "Azenith Elite",
      metadata: {
        aiScore: (image.metadata?.overall as number) || (image.metadata?.aiScore as number),
        luxury: image.metadata?.luxury as number,
        quality: image.metadata?.quality as number,
        reason: image.metadata?.reason as string
      }
    }));
    
    console.log(`[Elite Gallery API] Returning ${photos.length} shuffled images`);
    
    return NextResponse.json({
      photos,
      seed,
      totalAvailable: images.length,
      roomId,
      style
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache"
      }
    });
    
  } catch (error) {
    console.error("[Elite Gallery API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", photos: [] },
      { status: 500 }
    );
  }
}

// ============================================
// PEXELS FALLBACK (When curated DB is empty)
// ============================================

async function fetchFromPexelsFallback(
  roomId: string, 
  style: string, 
  seed: number, 
  limit: number
) {
  try {
    const pexelsKey = process.env.PEXELS_KEYS?.split(",")[0];
    
    if (!pexelsKey) {
      throw new Error("No Pexels API key available");
    }
    
    const styleHints: Record<string, string> = {
      modern: "modern minimal luxury",
      classic: "classic elegant luxury",
      industrial: "industrial loft luxury",
      scandinavian: "scandinavian cozy luxury"
    };
    
    const query = `${styleHints[style] || style} luxury interior design ${roomId}`;
    const randomPage = (seed % 20) + 1; // Use seed for page selection
    
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${limit}&page=${randomPage}`,
      {
        headers: { "Authorization": pexelsKey },
        next: { revalidate: 0 }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`);
    }
    
    const data = await response.json();
    const photos = (data.photos || []).map((photo: any) => ({
      id: photo.id,
      src: photo.src,
      alt: photo.alt,
      photographer: photo.photographer,
      metadata: {
        aiScore: 0.75,
        source: "pexels-fallback"
      }
    }));
    
    return NextResponse.json({
      photos,
      seed,
      totalAvailable: photos.length,
      roomId,
      style,
      fallback: true
    }, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
    
  } catch (error) {
    console.error("[Elite Gallery API] Fallback error:", error);
    return NextResponse.json(
      { photos: [], error: "No images available" },
      { status: 503 }
    );
  }
}
