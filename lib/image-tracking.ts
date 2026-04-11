"use client";

/**
 * Image Viewing Tracker for Style DNA Analysis
 * Tracks user image interactions to build Style DNA profile
 */

const STORAGE_KEY = "azenith_viewed_images";
const MAX_STORED_IMAGES = 50;

export type ViewedImage = {
  url: string;
  timestamp: number;
  roomType?: string;
  tags?: string[];
};

/**
 * Track an image view
 */
export function trackImageView(imageUrl: string, metadata?: { roomType?: string; tags?: string[] }): void {
  if (typeof window === "undefined") return;

  try {
    const existing = getViewedImages();
    
    // Don't add duplicates, move to front if exists
    const filtered = existing.filter((img) => img.url !== imageUrl);
    
    const newEntry: ViewedImage = {
      url: imageUrl,
      timestamp: Date.now(),
      roomType: metadata?.roomType,
      tags: metadata?.tags,
    };
    
    // Add to front and limit size
    const updated = [newEntry, ...filtered].slice(0, MAX_STORED_IMAGES);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    
    // Dispatch custom event for real-time updates
    window.dispatchEvent(new CustomEvent("azenith:image-viewed", { 
      detail: { url: imageUrl, totalViews: updated.length } 
    }));
    
  } catch (error) {
    console.error("[ImageTracking] Failed to track view:", error);
  }
}

/**
 * Get all viewed images
 */
export function getViewedImages(): ViewedImage[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored) as ViewedImage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Get just the image URLs for API calls
 */
export function getViewedImageUrls(): string[] {
  return getViewedImages().map((img) => img.url);
}

/**
 * Clear tracked images
 */
export function clearViewedImages(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get image count
 */
export function getViewedImageCount(): number {
  return getViewedImages().length;
}

/**
 * React hook for tracking images
 */
export function useImageTracking() {
  return {
    track: trackImageView,
    getImages: getViewedImages,
    getUrls: getViewedImageUrls,
    clear: clearViewedImages,
    count: getViewedImageCount(),
  };
}
