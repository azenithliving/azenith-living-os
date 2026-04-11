"use client";

import { useEffect, useCallback, useRef } from "react";

/**
 * Hyper-Performance Engine
 * Predictive prefetching, hover detection, and smart resource loading
 */

// Cache for prefetched resources
const prefetchCache = new Set<string>();
const INTERACTION_HISTORY: Array<{ x: number; y: number; timestamp: number; element: string }> = [];
const MAX_HISTORY = 50;

interface HoverIntent {
  url: string;
  confidence: number;
  priority: "high" | "medium" | "low";
}

/**
 * Prefetch an image or resource
 */
export function prefetchResource(url: string, priority: "high" | "low" = "low"): void {
  if (prefetchCache.has(url) || typeof window === "undefined") return;
  
  prefetchCache.add(url);
  
  // Use appropriate prefetch method based on priority and resource type
  const isImage = url.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i);
  const isPage = url.startsWith("/") && !url.includes(".");
  
  if (isImage) {
    // High-priority images: preload immediately
    if (priority === "high") {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = url;
      link.fetchPriority = "high";
      document.head.appendChild(link);
    } else {
      // Low-priority: use Intersection Observer pattern
      const img = new Image();
      img.decoding = "async";
      img.src = url;
    }
  } else if (isPage) {
    // Page prefetching via Next.js router
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = url;
    document.head.appendChild(link);
  }
}

/**
 * Track user interaction patterns
 */
export function trackInteraction(x: number, y: number, element: string): void {
  INTERACTION_HISTORY.push({
    x,
    y,
    timestamp: Date.now(),
    element,
  });
  
  // Keep only recent history
  if (INTERACTION_HISTORY.length > MAX_HISTORY) {
    INTERACTION_HISTORY.shift();
  }
}

/**
 * Analyze interaction patterns to predict next actions
 */
export function analyzeHoverPatterns(): HoverIntent[] {
  if (INTERACTION_HISTORY.length < 3) return [];
  
  const recent = INTERACTION_HISTORY.slice(-10);
  const patterns: Map<string, number> = new Map();
  
  // Count element hover frequency
  recent.forEach((interaction) => {
    const count = patterns.get(interaction.element) || 0;
    patterns.set(interaction.element, count + 1);
  });
  
  // Convert to intents with confidence scores
  const intents: HoverIntent[] = [];
  patterns.forEach((count, element) => {
    if (element.startsWith("room-") || element.startsWith("gallery-")) {
      const confidence = Math.min(count / recent.length, 1);
      if (confidence > 0.3) {
        intents.push({
          url: `/rooms/${element.replace("room-", "")}`,
          confidence,
          priority: confidence > 0.7 ? "high" : "medium",
        });
      }
    }
  });
  
  return intents.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

/**
 * React hook for predictive prefetching on hover
 */
export function usePredictivePrefetch() {
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const onHoverStart = useCallback((elementId: string, imageUrl?: string) => {
    // Track interaction
    if (typeof window !== "undefined") {
      trackInteraction(window.innerWidth / 2, window.innerHeight / 2, elementId);
    }
    
    // Clear any existing timeout
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
    }
    
    // Prefetch after 100ms hover (indicates real intent vs accidental)
    prefetchTimeoutRef.current = setTimeout(() => {
      if (imageUrl) {
        prefetchResource(imageUrl, "high");
      }
      
      // Also prefetch related high-res versions
      if (imageUrl && imageUrl.includes("?w=")) {
        const highResUrl = imageUrl.replace(/\?w=\d+/, "?w=1920&q=90");
        prefetchResource(highResUrl, "low");
      }
    }, 100);
  }, []);
  
  const onHoverEnd = useCallback(() => {
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
      prefetchTimeoutRef.current = null;
    }
  }, []);
  
  // Analyze patterns periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const intents = analyzeHoverPatterns();
      intents.forEach((intent) => {
        if (intent.priority === "high") {
          prefetchResource(intent.url, "low");
        }
      });
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  return { onHoverStart, onHoverEnd };
}

/**
 * React hook for image progressive loading
 */
export function useProgressiveImage(src: string) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (!src) return;
    
    const img = new Image();
    img.decoding = "async";
    
    img.onload = () => {
      setLoadedSrc(src);
      setIsLoading(false);
    };
    
    img.onerror = () => {
      setIsLoading(false);
    };
    
    img.src = src;
  }, [src]);
  
  return { src: loadedSrc, isLoading };
}

// Add missing import
import { useState } from "react";

/**
 * Intersection Observer for lazy loading with prefetch trigger
 */
export function useViewportPrefetch(
  images: Array<{ id: string; lowRes: string; highRes: string }>,
  options?: { rootMargin?: string; threshold?: number }
) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadedImages = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-image-id");
            if (id && !loadedImages.current.has(id)) {
              loadedImages.current.add(id);
              
              // Find and load the image
              const image = images.find((img) => img.id === id);
              if (image) {
                // Load low-res immediately
                prefetchResource(image.lowRes, "high");
                
                // Prefetch high-res with delay
                setTimeout(() => {
                  prefetchResource(image.highRes, "low");
                }, 500);
              }
            }
          }
        });
      },
      {
        rootMargin: options?.rootMargin || "50px",
        threshold: options?.threshold || 0.1,
      }
    );
    
    // Observe all elements with data-image-id
    document.querySelectorAll("[data-image-id]").forEach((el) => {
      observerRef.current?.observe(el);
    });
    
    return () => observerRef.current?.disconnect();
  }, [images, options]);
}

/**
 * Preload critical resources for the current page
 */
export function preloadCriticalResources(resources: string[]): void {
  if (typeof window === "undefined") return;
  
  resources.forEach((url) => {
    if (prefetchCache.has(url)) return;
    
    const link = document.createElement("link");
    link.rel = "preload";
    
    if (url.match(/\.(css)$/i)) {
      link.as = "style";
    } else if (url.match(/\.(js)$/i)) {
      link.as = "script";
    } else if (url.match(/\.(woff2?|ttf|otf)$/i)) {
      link.as = "font";
      link.crossOrigin = "anonymous";
    }
    
    link.href = url;
    document.head.appendChild(link);
    prefetchCache.add(url);
  });
}

/**
 * Measure and report Core Web Vitals
 */
export function measureWebVitals(): void {
  if (typeof window === "undefined" || !("performance" in window)) return;
  
  // Largest Contentful Paint
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    console.log(`[Performance] LCP: ${lastEntry.startTime.toFixed(0)}ms`);
  }).observe({ type: "largest-contentful-paint", buffered: true } as PerformanceObserverInit);
  
  // Interaction to Next Paint (INP) - modern replacement for FID
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      // Use type assertion for interaction entries
      const eventEntry = entry as unknown as { processingStart: number; startTime: number };
      const delay = eventEntry.processingStart - eventEntry.startTime;
      console.log(`[Performance] INP: ${delay.toFixed(0)}ms`);
    }
  }).observe({ type: "event", buffered: true, durationThreshold: 0 } as PerformanceObserverInit);
  
  // Cumulative Layout Shift
  let clsValue = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      // Check for layout-shift specific properties
      const layoutEntry = entry as unknown as { hadRecentInput?: boolean; value?: number };
      if (!layoutEntry.hadRecentInput && typeof layoutEntry.value === "number") {
        clsValue += layoutEntry.value;
      }
    }
    console.log(`[Performance] CLS: ${clsValue.toFixed(3)}`);
  }).observe({ type: "layout-shift", buffered: true } as PerformanceObserverInit);
}

/**
 * Check if browser supports modern image formats
 */
export function checkImageFormatSupport(): { webp: boolean; avif: boolean } {
  if (typeof window === "undefined") return { webp: true, avif: false };
  
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  
  return {
    webp: canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0,
    avif: canvas.toDataURL("image/avif").indexOf("data:image/avif") === 0,
  };
}

/**
 * Get optimal image format for browser
 */
export function getOptimalImageFormat(): "avif" | "webp" | "jpeg" {
  const support = checkImageFormatSupport();
  if (support.avif) return "avif";
  if (support.webp) return "webp";
  return "jpeg";
}
