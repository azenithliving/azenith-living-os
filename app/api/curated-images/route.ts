import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";

// Constants
const DELIVERY_SIZE = 30; // Images delivered per request

export interface PhotoCandidate {
  id: number;
  url: string;
  src: {
    original?: string;
    large2x?: string;
    large?: string;
    medium?: string;
    small?: string;
  };
  alt?: string;
  photographer?: string;
}

export interface CuratedImagesResponse {
  photos: PhotoCandidate[];
  source: "storage" | "pexels_fallback" | "none";
  count: number;
  folder: string;
}

/**
 * GET /api/curated-images?room=living-room&style=modern
 * Fetch curated images from Supabase Storage with Pexels fallback
 */
export async function GET(request: NextRequest): Promise<NextResponse<CuratedImagesResponse | { error: string }>> {
  try {
    const { searchParams } = new URL(request.url);
    const room = searchParams.get("room");
    const style = searchParams.get("style");
    const page = Math.max(Number(searchParams.get("page") || "1"), 1);
    const perPage = Math.min(Math.max(Number(searchParams.get("per_page") || "30"), 1), 50);

    if (!room || !style) {
      return NextResponse.json(
        { error: "Missing required query parameters: room, style" },
        { status: 400 }
      );
    }

    const folderPath = `curated/${room}/${style}`;
    console.log(`[Curated Images] Fetching from: ${folderPath}`);

    // 1. Try to get images from Supabase Storage
    const { data: storageFiles, error: storageError } = await supabase.storage
      .from("images")
      .list(folderPath);

    if (storageError) {
      console.error(`[Curated Images] Storage error:`, storageError);
    }

    // Filter for image files only
    const imageFiles = storageFiles?.filter(
      file => file.name.match(/\.(jpg|jpeg|png|webp|gif)$/i)
    ) || [];

    console.log(`[Curated Images] Found ${imageFiles.length} images in storage`);

    // 2. If we have stored images, return them
    if (imageFiles.length > 0) {
      // Calculate pagination
      const startIdx = (page - 1) * perPage;
      const endIdx = startIdx + perPage;
      const paginatedFiles = imageFiles.slice(startIdx, endIdx);

      // Generate public URLs
      const photos: PhotoCandidate[] = paginatedFiles.map((file, index) => {
        const { data: urlData } = supabase.storage
          .from("images")
          .getPublicUrl(`${folderPath}/${file.name}`);

        return {
          id: index + startIdx + 1,
          url: urlData.publicUrl,
          src: {
            original: urlData.publicUrl,
            large2x: urlData.publicUrl,
            large: urlData.publicUrl,
            medium: urlData.publicUrl,
            small: urlData.publicUrl,
          },
          alt: `${room} ${style} design ${index + startIdx + 1}`,
          photographer: "Azenith Curated Collection",
        };
      });

      return NextResponse.json({
        photos,
        source: "storage",
        count: photos.length,
        folder: folderPath,
      });
    }

    // 3. Fallback to Pexels API
    console.log(`[Curated Images] No stored images, falling back to Pexels`);
    
    const pexelsPhotos = await fetchFromPexels(room, style, perPage, page);
    
    return NextResponse.json({
      photos: pexelsPhotos,
      source: pexelsPhotos.length > 0 ? "pexels_fallback" : "none",
      count: pexelsPhotos.length,
      folder: folderPath,
    });

  } catch (error) {
    console.error("[Curated Images] Route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Fetch images from Pexels as fallback
 */
async function fetchFromPexels(
  room: string,
  style: string,
  perPage: number,
  page: number
): Promise<PhotoCandidate[]> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_PEXELS_API_KEY || process.env.PEXELS_API_KEY;
    if (!apiKey) {
      console.error("[Curated Images] No Pexels API key available");
      return [];
    }

    const roomQueries: Record<string, string> = {
      "master-bedroom": "luxury master bedroom interior",
      "living-room": "luxury living room lounge",
      "kitchen": "modern high-end kitchen",
      "dressing-room": "walk-in closet design",
      "home-office": "luxury home office study",
      "youth-room": "modern youth bedroom",
      "dining-room": "luxury dining room",
      "interior-design": "luxury interior design",
      "bedroom": "luxury bedroom interior",
      "bathroom": "luxury bathroom interior",
    };

    const styleHints: Record<string, string> = {
      modern: "modern minimal",
      classic: "classic elegant",
      industrial: "industrial loft",
      scandinavian: "scandinavian cozy",
      minimalist: "minimalist clean",
      luxury: "luxury premium",
      contemporary: "contemporary design",
    };

    const roomQuery = roomQueries[room] || `${room} interior`;
    const styleHint = styleHints[style] || style;
    const query = `${styleHint} ${roomQuery}`;

    console.log(`[Curated Images] Pexels query: ${query}`);

    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`,
      {
        headers: {
          Authorization: apiKey,
        },
      }
    );

    if (!response.ok) {
      console.error(`[Curated Images] Pexels API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    return (data.photos || []).map((p: unknown) => ({
      id: (p as { id: number }).id,
      url: (p as { url: string }).url,
      src: (p as { src: PhotoCandidate["src"] }).src,
      alt: (p as { alt?: string }).alt,
      photographer: (p as { photographer?: string }).photographer,
    }));

  } catch (error) {
    console.error("[Curated Images] Pexels fetch error:", error);
    return [];
  }
}

/**
 * POST /api/curated-images
 * Backward compatibility - redirects to storage-based logic
 */
export async function POST(request: NextRequest): Promise<NextResponse<CuratedImagesResponse | { error: string }>> {
  try {
    const body = await request.json();
    const { roomId, style, seed, page = 1, perPage = 30 } = body;

    if (!roomId || !style) {
      return NextResponse.json(
        { error: "Missing required fields: roomId, style" },
        { status: 400 }
      );
    }

    // Redirect to GET handler with query params
    const url = new URL(request.url);
    url.searchParams.set("room", roomId);
    url.searchParams.set("style", style);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));

    // Create a new request with the updated URL
    const getRequest = new NextRequest(url);
    return GET(getRequest);

  } catch (error) {
    console.error("[Curated Images] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

