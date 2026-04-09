"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface SmartImage {
  id: number;
  url: string;
  photographer: string;
  relevanceScore: number;
  qualityScore: number;
  budgetMatch: string;
  reason: string;
}

interface UseSmartImagesOptions {
  roomType: string;
  style: string;
  intent?: string;
  budget?: string;
  initialImages?: Array<{
    id: number;
    src: { large?: string; large2x?: string };
    photographer?: string;
    avg_color?: string;
  }>;
}

interface UseSmartImagesReturn {
  images: SmartImage[];
  loading: boolean;
  error: string | null;
  curationStats: {
    total: number;
    approved: number;
    rejectionRate: number;
  } | null;
  refetch: () => void;
}

/**
 * Smart Image Hook with AI Curation
 * Uses Gemini to filter and rank images based on user intent, budget, and style
 */
export function useSmartImages({
  roomType,
  style,
  intent = "exploring",
  budget = "flexible",
  initialImages = [],
}: UseSmartImagesOptions): UseSmartImagesReturn {
  const [images, setImages] = useState<SmartImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [curationStats, setCurationStats] = useState<UseSmartImagesReturn["curationStats"]>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const prevInitialImages = useRef(initialImages);
  const isFirstRun = useRef(true);
  
  // Backoff retry refs
  const retryCount = useRef(0);
  const retryTimer = useRef<NodeJS.Timeout | null>(null);
  const MAX_RETRIES = 3;
  const BASE_RETRY_DELAY = 2000; // 2 seconds

  const curateImages = useCallback(async (isRetry = false) => {
    if (!initialImages || initialImages.length === 0) {
      setImages([]);
      return;
    }

    // Skip if images haven't actually changed (prevents infinite loops)
    if (!isFirstRun.current && !isRetry && JSON.stringify(prevInitialImages.current) === JSON.stringify(initialImages)) {
      return;
    }
    prevInitialImages.current = initialImages;
    isFirstRun.current = false;

    setLoading(true);
    setError(null);

    try {
      // Prepare image candidates for AI curation
      const candidates = initialImages.map((img) => ({
        id: img.id,
        url: img.src?.large2x || img.src?.large || "",
        photographer: img.photographer || "Unknown",
        avg_color: img.avg_color || "#808080",
      }));

      // Call the curation API
      const response = await fetch("/api/curate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: candidates,
          intent,
          budget,
          roomType,
          style,
        }),
      }).catch((err) => {
        console.error("[Smart Images] Network error during curation:", err);
        throw new Error("Network error - please check your connection");
      });

      // Handle 429 with backoff retry
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : BASE_RETRY_DELAY * Math.pow(2, retryCount.current);
        
        if (retryCount.current < MAX_RETRIES) {
          retryCount.current++;
          console.log(`[Smart Images] 429 rate limited. Auto-retry ${retryCount.current}/${MAX_RETRIES} in ${waitTime}ms...`);
          
          if (retryTimer.current) {
            clearTimeout(retryTimer.current);
          }
          
          retryTimer.current = setTimeout(() => {
            curateImages(true);
          }, waitTime);
          
          return; // Don't set loading false yet - we're retrying
        } else {
          console.warn('[Smart Images] Max retries exceeded. Using fallback.');
          throw new Error('Rate limited - max retries exceeded');
        }
      }

      if (!response.ok) {
        throw new Error(`Curation failed: ${response.statusText}`);
      }

      // Reset retry count on success
      retryCount.current = 0;

      const result = await response.json();

      // Map approved IDs back to full image data with scores
      const curatedImages: SmartImage[] = result.approvedIds
        .map((id: number) => {
          const original = initialImages.find((img) => img.id === id);
          const analysis = result.analysis?.find((a: { id: number }) => a.id === id);
          
          if (!original) return null;
          
          return {
            id: original.id,
            url: original.src?.large2x || original.src?.large || "",
            photographer: original.photographer || "Unknown",
            relevanceScore: analysis?.relevanceScore || 75,
            qualityScore: analysis?.qualityScore || 75,
            budgetMatch: analysis?.budgetMatch || "flexible",
            reason: analysis?.reason || "AI curated",
          };
        })
        .filter(Boolean) as SmartImage[];

      setImages(curatedImages);
      setCurationStats({
        total: result.totalImages,
        approved: result.approvedCount,
        rejectionRate: result.rejectionRate,
      });

      console.log(`[Smart Images] Curated ${curatedImages.length}/${initialImages.length} images (${result.rejectionRate}% rejected)`);
    } catch (err) {
      console.error("[Smart Images] Curation error:", err);
      setError(err instanceof Error ? err.message : "Failed to curate images");
      // Fallback to initial images on error
      setImages(
        initialImages.map((img) => ({
          id: img.id,
          url: img.src?.large2x || img.src?.large || "",
          photographer: img.photographer || "Unknown",
          relevanceScore: 75,
          qualityScore: 75,
          budgetMatch: "flexible",
          reason: "Fallback (curation unavailable)",
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [initialImages, intent, budget, roomType, style]);

  // Run curation when dependencies change with debounce
  useEffect(() => {
    // Clear existing timers
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
    }
    
    // Reset retry count on dependency change
    retryCount.current = 0;
    
    // Debounce the curation call by 500ms
    debounceTimer.current = setTimeout(() => {
      curateImages();
    }, 500);
    
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
      }
    };
  }, [curateImages]);

  return {
    images,
    loading,
    error,
    curationStats,
    refetch: curateImages,
  };
}
