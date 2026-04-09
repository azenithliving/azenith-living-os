"use client";

import { useState, useEffect, useCallback } from "react";

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

  const curateImages = useCallback(async () => {
    if (!initialImages || initialImages.length === 0) {
      setImages([]);
      return;
    }

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
      });

      if (!response.ok) {
        throw new Error(`Curation failed: ${response.statusText}`);
      }

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

  // Run curation when dependencies change
  useEffect(() => {
    curateImages();
  }, [curateImages]);

  return {
    images,
    loading,
    error,
    curationStats,
    refetch: curateImages,
  };
}
