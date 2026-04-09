"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import ImageLightbox from "./ImageLightbox";
import AIStylePicker from "./AIStylePicker";
import GoldPulseLoader from "./GoldPulseLoader";
import ImageHoverWrapper from "./ImageHoverWrapper";
import SmartImageGrid from "./SmartImageGrid";
import useSessionStore, { type StylePreference } from "@/stores/useSessionStore";
import { useImageTracking } from "@/hooks/useImageTracking";

const INITIAL_LOAD_COUNT = 15;
const LOAD_MORE_COUNT = 15;
const SCROLL_THRESHOLD = 200; // pixels from bottom to trigger load
const DELIVERY_SIZE = 15; // Images delivered per reservoir request

interface RoomPageClientProps {
  room: {
    id: string;
    title: string;
    category: string;
    description: string;
    query: string;
  };
  initialPhotos: Array<{
    id: number;
    src: { large2x?: string; large?: string; medium?: string };
    alt?: string;
    metadata?: {
      colorPalette?: {
        primary: string;
        secondary: string;
        accent: string;
        neutrals: string[];
      };
      materials?: Array<{ name: string; type: string; finish?: string }>;
    };
  }>;
  styleDesc?: { category: string; description: string };
}

const STYLE_QUERY_HINTS: Record<string, string> = {
  modern: "modern minimal luxury",
  classic: "classic elegant luxury",
  industrial: "industrial loft luxury",
  scandinavian: "scandinavian cozy luxury",
};

// Masonry layout - Bento grid sizing classes
const getBentoSize = (index: number) => {
  const patterns = [
    "col-span-2 row-span-2", // Large
    "col-span-1 row-span-1", // Small
    "col-span-1 row-span-2", // Tall
    "col-span-2 row-span-1", // Wide
    "col-span-1 row-span-1", // Small
    "col-span-1 row-span-1", // Small
  ];
  return patterns[index % patterns.length];
};

// Fallback Pexels images by room type
const FALLBACK_IMAGES: Record<string, string[]> = {
  "master-bedroom": [
    "https://images.pexels.com/photos/1571453/pexels-photo-1571453.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=800",
  ],
  "living-room": [
    "https://images.pexels.com/photos/1080696/pexels-photo-1080696.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=800",
  ],
  "kitchen": [
    "https://images.pexels.com/photos/280232/pexels-photo-280232.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1080722/pexels-photo-1080722.jpeg?auto=compress&cs=tinysrgb&w=800",
  ],
  "dressing-room": [
    "https://images.pexels.com/photos/1860193/pexels-photo-1860193.jpeg?auto=compress&cs=tinysrgb&w=800",
  ],
  "interior-design": [
    "https://images.pexels.com/photos/1648771/pexels-photo-1648771.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1648776/pexels-photo-1648776.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1571468/pexels-photo-1571468.jpeg?auto=compress&cs=tinysrgb&w=800",
  ],
  "default": [
    "https://images.pexels.com/photos/1571453/pexels-photo-1571453.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=800",
  ]
};

// Get fallback image for a room type
const getFallbackImage = (roomId: string, index: number): string => {
  const fallbacks = FALLBACK_IMAGES[roomId] || FALLBACK_IMAGES["default"];
  return fallbacks[index % fallbacks.length];
};

export default function RoomPageClient({
  room,
  initialPhotos,
  styleDesc,
}: RoomPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStyle = searchParams.get("style") || "modern";

  // Store hooks
  const setSelectedStyle = useSessionStore((state) => state.setSelectedStyle);
  const updateProfile = useSessionStore((state) => state.updateProfile);
  const userProfile = useSessionStore((state) => state.userProfile);
  const isHydrated = useSessionStore((state) => state.isHydrated);
  const trackNeuralInteraction = useSessionStore((state) => state.trackNeuralInteraction);
  const intent = useSessionStore((state) => state.intent);
  const budget = useSessionStore((state) => state.budget);

  // Local state
  const [photos, setPhotos] = useState(initialPhotos.slice(0, INITIAL_LOAD_COUNT));
  const [currentStyle, setCurrentStyle] = useState(initialStyle);
  const [displayedCount, setDisplayedCount] = useState(INITIAL_LOAD_COUNT);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true); // Reservoir always has more
  const [currentPage, setCurrentPage] = useState(1);
  const [seed, setSeed] = useState<number>(0); // Start with 0, set real seed in useEffect after hydration
  const [poolSize, setPoolSize] = useState<number>(0); // Track available pool size
  const [isFetching, setIsFetching] = useState(false); // Global fetching flag for throttling
  const [rateLimitFreezeUntil, setRateLimitFreezeUntil] = useState<number>(0); // 5s freeze on 429

  // Initialize seed after hydration to avoid mismatch
  useEffect(() => {
    if (seed === 0) {
      setSeed(Date.now());
    }
  }, [seed]);

  // State Synchronization: Merge initialPhotos with client state after store rehydration
  // This prevents empty state if store rehydration clears the images
  useEffect(() => {
    if (isHydrated && initialPhotos.length > 0 && photos.length === 0) {
      console.log('[State Sync] Restoring initialPhotos after store rehydration');
      setPhotos(initialPhotos.slice(0, INITIAL_LOAD_COUNT));
    }
  }, [isHydrated, initialPhotos, photos.length]);

  const [loading, setLoading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  
  // Image hover tracking (+2 score on 2s hover)
  const { score, hoveredImage, feedback, onHoverStart, onHoverEnd } = useImageTracking();
  
  // Ref-Gate: Track if room view has been dispatched (once per mount)
  const hasRoomViewDispatchedRef = useRef<boolean>(false);
  
  // Smart Aggregation: Buffer for pending profile updates
  const pendingUpdateRef = useRef<{
    stylePrefs: Record<string, StylePreference>;
    timestamp: number;
  } | null>(null);
  const aggregationTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Infinite scroll refs
  const galleryEndRef = useRef<HTMLDivElement>(null);
  const sessionCacheRef = useRef<Map<string, Array<{ id: number; src: { large2x?: string; large?: string; medium?: string }; alt?: string }>>>(new Map());
  const isFetchingRef = useRef<boolean>(false);
  const reservoirRef = useRef<{ poolSize: number; lastSeed: number }>({ poolSize: 0, lastSeed: 0 });

  // Update style preferences in user profile - with Ref-Gate and Smart Aggregation
  useEffect(() => {
    if (!isHydrated) return;
    
    // Ref-Gate: Only dispatch room_view once per mount
    if (!hasRoomViewDispatchedRef.current) {
      hasRoomViewDispatchedRef.current = true;
      
      const stylePrefs = userProfile?.stylePreferences as Record<string, StylePreference> | undefined;
      const currentPref = stylePrefs?.[currentStyle] || { roomCount: 0, totalTimeSpent: 0, lastViewedAt: 0 };
      
      // Prepare pending update
      const now = Date.now();
      const updatedStylePrefs = {
        ...stylePrefs,
        [currentStyle]: {
          roomCount: currentPref.roomCount + 1,
          totalTimeSpent: currentPref.totalTimeSpent,
          lastViewedAt: now,
        },
      };
      
      pendingUpdateRef.current = {
        stylePrefs: updatedStylePrefs,
        timestamp: now,
      };
      
      // Smart Aggregation: Clear existing timer
      if (aggregationTimerRef.current) {
        clearTimeout(aggregationTimerRef.current);
      }
      
      // Smart Aggregation: Update store only after 2 seconds of no new interactions
      aggregationTimerRef.current = setTimeout(() => {
        if (pendingUpdateRef.current) {
          updateProfile({
            lastPage: `/room/${room.id}`,
            userProfile: {
              ...userProfile,
              stylePreferences: pendingUpdateRef.current.stylePrefs,
            },
          });
          pendingUpdateRef.current = null;
        }
      }, 2000);
    }
    
    // Cleanup on unmount
    return () => {
      if (aggregationTimerRef.current) {
        clearTimeout(aggregationTimerRef.current);
      }
    };
  }, [room.id]); // Minimal dependency - only room.id

  // Session-based cache key generator
  const getCacheKey = useCallback((style: string, page: number) => {
    return `${room.id}-${style}-${page}`;
  }, [room.id]);


  // Shuffle function - generates new seed to get different random subset
  const handleShuffle = useCallback(async () => {
    if (isLoadingMore || isFetchingRef.current) return;
    
    const newSeed = Date.now();
    setSeed(newSeed);
    setIsLoadingMore(true);
    
    try {
      // Fetch new random subset from reservoir
      const response = await fetch("/api/curated-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          style: currentStyle,
          seed: newSeed,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.photos && data.photos.length > 0) {
          setPhotos(data.photos);
          setPoolSize(data.poolSize || 0);
          reservoirRef.current = { poolSize: data.poolSize, lastSeed: newSeed };
          console.log(`[Shuffle] Loaded ${data.photos.length} images from reservoir pool of ${data.poolSize}`);
        }
      }
    } catch (error) {
      console.error("[Shuffle] Failed to shuffle images:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [room.id, currentStyle, isLoadingMore]);

  // Rate limiting: Track last fetch time
  const lastFetchTimeRef = useRef<number>(0);
  const RATE_LIMIT_MS = 2000; // 2 seconds minimum between fetches
  const RATE_LIMIT_FREEZE_MS = 5000; // 5 second freeze when 429 received

  // Load more images with AI-powered page-based filtering
  const loadMoreImages = useCallback(async () => {
    // Check global fetching flag
    if (isFetching || isFetchingRef.current || !hasMore || isLoadingMore) return;
    
    const now = Date.now();
    
    // Check 429 freeze period
    if (now < rateLimitFreezeUntil) {
      console.log(`[AI Infinite Scroll] Frozen due to rate limit, retry after ${rateLimitFreezeUntil - now}ms`);
      return;
    }
    
    // Rate limiting check (2 second minimum between fetches)
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    if (timeSinceLastFetch < RATE_LIMIT_MS) {
      console.log(`[AI Infinite Scroll] Throttled, waiting ${RATE_LIMIT_MS - timeSinceLastFetch}ms`);
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastFetch));
    }
    
    isFetchingRef.current = true;
    setIsFetching(true);
    setIsLoadingMore(true);
    lastFetchTimeRef.current = Date.now();
    
    try {
      const nextPage = currentPage + 1;
      const cacheKey = getCacheKey(currentStyle, nextPage);
      
      // Check session cache first
      const cached = sessionCacheRef.current.get(cacheKey);
      if (cached && cached.length > 0) {
        setPhotos(prev => [...prev, ...cached]);
        setDisplayedCount(prev => prev + cached.length);
        setCurrentPage(nextPage);
        console.log(`[AI Infinite Scroll] Loaded ${cached.length} from session cache`);
        return;
      }
      
      // Step 1: Fetch raw images from Pexels
      const styleHint = STYLE_QUERY_HINTS[currentStyle] || currentStyle;
      const query = `${styleHint} luxury interior design ${room.query}`;
      const pexelsResponse = await fetch(
        `/api/pexels?query=${encodeURIComponent(query)}&per_page=${LOAD_MORE_COUNT}&page=${nextPage}`
      ).catch((err) => {
        console.error('[AI Infinite Scroll] Pexels fetch error:', err);
        return null;
      });

      if (!pexelsResponse) {
        setIsLoadingMore(false);
        isFetchingRef.current = false;
        setIsFetching(false);
        return;
      }

      if (!pexelsResponse.ok) {
        // Rate limit (429) - freeze for 5s and use placeholder strategy
        if (pexelsResponse.status === 429) {
          console.warn('[AI Infinite Scroll] Rate limited (429), freezing for 5s');
          setRateLimitFreezeUntil(Date.now() + RATE_LIMIT_FREEZE_MS);
          // Placeholder Strategy: Keep showing current images, don't clear them
          // Just increment page so next attempt tries different batch
          setCurrentPage(nextPage);
          setIsLoadingMore(false);
          isFetchingRef.current = false;
          setIsFetching(false);
          return;
        }
        setHasMore(false);
        setIsLoadingMore(false);
        isFetchingRef.current = false;
        setIsFetching(false);
        return;
      }

      const pexelsData = await pexelsResponse.json();
      if (!Array.isArray(pexelsData?.photos) || pexelsData.photos.length === 0) {
        setHasMore(false);
        return;
      }

      // Step 2: Send to AI filtering API for curation
      const curatedResponse = await fetch("/api/curated-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          style: currentStyle,
          page: nextPage,
          photos: pexelsData.photos,
        }),
      }).catch((err) => {
        console.error('[AI Infinite Scroll] Curation API error:', err);
        return null;
      });

      if (!curatedResponse) {
        setIsLoadingMore(false);
        isFetchingRef.current = false;
        setIsFetching(false);
        return;
      }

      if (!curatedResponse.ok) {
        console.warn("[AI Infinite Scroll] AI filtering failed");
        setHasMore(false);
        return;
      }

      const curatedData = await curatedResponse.json();
      const approvedPhotos = curatedData.photos || [];
      
      // Cache the curated results
      sessionCacheRef.current.set(cacheKey, approvedPhotos);
      
      if (approvedPhotos.length > 0) {
        // Placeholder Strategy: Only swap photos when curated batch is 100% ready
        setPhotos(prev => [...prev, ...approvedPhotos]);
        setDisplayedCount(prev => prev + approvedPhotos.length);
        setCurrentPage(nextPage);
        console.log(`[AI Infinite Scroll] Gemini curated ${approvedPhotos.length}/${pexelsData.photos.length} images (source: ${curatedData.source})`);
      } else {
        // If AI rejected all, try next page but don't clear existing photos
        console.log("[AI Infinite Scroll] All images rejected by AI, trying next page");
        setCurrentPage(nextPage);
      }
    } catch (error) {
      console.error("[AI Infinite Scroll] Failed to load more images:", error);
      // Don't clear photos on error - keep showing what we have
    } finally {
      setIsLoadingMore(false);
      isFetchingRef.current = false;
      setIsFetching(false);
    }
  }, [currentPage, currentStyle, hasMore, isLoadingMore, isFetching, room.id, room.query, getCacheKey, rateLimitFreezeUntil]);

  // Debounce ref for infinite scroll to prevent rapid triggers
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Infinite scroll observer with proper cleanup and debounce
  useEffect(() => {
    // Disconnect any existing observer first to prevent memory leaks
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isFetchingRef.current && !isFetching) {
          // Clear any existing debounce timer
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          // Debounce: wait 500ms after intersection to ensure previous batch rendered
          debounceTimerRef.current = setTimeout(() => {
            if (!isFetchingRef.current && !isLoadingMore) {
              loadMoreImages();
            }
          }, 500);
        }
      },
      { rootMargin: `${SCROLL_THRESHOLD}px` }
    );

    const currentGalleryEnd = galleryEndRef.current;
    if (currentGalleryEnd) {
      observer.observe(currentGalleryEnd);
    }

    return () => {
      // Always disconnect the entire observer on cleanup
      observer.disconnect();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [hasMore, isLoadingMore, isFetching, loadMoreImages]);

  // Handle style change with instant refresh
  const handleStyleChange = useCallback(
    async (newStyle: string) => {
      if (newStyle === currentStyle) return;

      setLoading(true);
      setCurrentStyle(newStyle);
      setCurrentPage(1);
      setDisplayedCount(INITIAL_LOAD_COUNT);

      // Update URL without navigation
      const params = new URLSearchParams(searchParams);
      params.set("style", newStyle);
      router.replace(`/room/${room.id}?${params.toString()}`, { scroll: false });

      // Update store
      setSelectedStyle(newStyle);

      // Fetch new images from reservoir
      try {
        const newSeed = Date.now();
        setSeed(newSeed);
        
        // Fetch from curated reservoir API
        const response = await fetch("/api/curated-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: room.id,
            style: newStyle,
            seed: newSeed,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.photos && data.photos.length > 0) {
            setPhotos(data.photos);
            setPoolSize(data.poolSize || 0);
            setHasMore(true); // Reservoir always has more
            reservoirRef.current = { poolSize: data.poolSize, lastSeed: newSeed };
            console.log(`[Style Change] Loaded ${data.photos.length} images from reservoir pool of ${data.poolSize}`);
          }
        }
      } catch (error) {
        console.error("[Style Change] Failed to fetch from reservoir:", error);
      } finally {
        setLoading(false);
      }
    },
    [currentStyle, room.id, router, searchParams, setSelectedStyle]
  );

  // Track modal score separately
  const [modalScore, setModalScore] = useState(0);

  // Open lightbox - +5 points for modal engagement
  const openLightbox = useCallback(
    (index: number) => {
      setLightboxIndex(index);
      setLightboxOpen(true);
      
      // Add +5 for modal_view_engaged
      setModalScore(prev => {
        const newScore = prev + 5;
        console.log(`[modal_view_engaged] Image ${index} opened in fullscreen (+5 points). Modal Total: ${newScore}`);
        return newScore;
      });
    },
    []
  );

  // Lightbox navigation
  const nextImage = useCallback(() => {
    setLightboxIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  const prevImage = useCallback(() => {
    setLightboxIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const navigateToImage = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  // Cleanup timers
  useEffect(() => {
    return () => {
      // Flush any pending aggregation on unmount
      if (aggregationTimerRef.current) {
        clearTimeout(aggregationTimerRef.current);
      }
      if (pendingUpdateRef.current) {
        updateProfile({
          lastPage: `/room/${room.id}`,
          userProfile: {
            ...userProfile,
            stylePreferences: pendingUpdateRef.current.stylePrefs,
          },
        });
      }
    };
  }, [room.id, updateProfile, userProfile]);

  const heroImage = photos[0];
  const gallery = photos.slice(1);

  const displayCategory = styleDesc?.category ?? room.category;
  const displayDescription = styleDesc?.description ?? room.description;

  // Hydration guard
  const displayStyle = isHydrated ? currentStyle : initialStyle;

  return (
    <>
      {/* Style Picker */}
      <div className="mb-8">
        <AIStylePicker
          selectedStyle={displayStyle}
          onStyleChange={handleStyleChange}
        />
      </div>

      {/* Category & Title with Shuffle */}
      <div className="mb-10 flex items-start justify-between">
        <div>
          <span className="text-sm uppercase tracking-wider text-amber-500">
            {displayCategory}
          </span>
          <h1 className="mt-2 text-4xl font-bold md:text-6xl">
            {room.title}
          </h1>
        </div>
        <button
          onClick={handleShuffle}
          disabled={isLoadingMore}
          className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-all hover:bg-amber-500/20 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Shuffle
          {poolSize > 0 && <span className="text-xs text-amber-500/60">({poolSize})</span>}
        </button>
      </div>

      {/* Hero Image - Clickable */}
      <motion.div
        className="relative mb-12 aspect-[21/9] cursor-pointer overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
        onClick={() => openLightbox(0)}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.3 }}
      >
        {heroImage ? (
          <Image
            src={heroImage.src?.large2x || heroImage.src?.large || "/placeholder-room.jpg"}
            alt={room.title}
            fill
            sizes="(max-width: 768px) 100vw, 1200px"
            className="object-cover"
            priority={true}
            loading="eager"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-amber-900/20 to-black">
            <div className="relative">
              <div className="h-20 w-20 animate-pulse rounded-full bg-amber-500/20 blur-xl" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500/30 border-t-amber-500" />
              </div>
            </div>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all hover:bg-black/30 hover:opacity-100">
          <span className="rounded-full bg-white/20 px-6 py-3 text-white backdrop-blur-sm">
            انقر للتكبير
          </span>
        </div>
      </motion.div>

      {/* Description */}
      <div className="mb-12">
        <p className="border-r-2 border-amber-500 pr-6 text-xl italic leading-relaxed text-gray-400">
          &ldquo;{displayDescription}&rdquo;
        </p>
      </div>


      {/* Loading State */}
      {loading && (
        <div className="mb-8 flex items-center justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
          <span className="mr-4 text-white/60">جاري تحديث الصور...</span>
        </div>
      )}

      {/* AI-Powered Masonry Gallery Grid with Quality Scores */}
      {gallery.length > 0 && (
        <SmartImageGrid
          roomType={room.id}
          style={currentStyle}
          intent={intent || "exploring"}
          budget={budget || "flexible"}
          initialImages={gallery}
          onImageClick={(index) => openLightbox(index + 1)}
          onReject={(imageId, reason) => {
            console.log(`[AI Curation] User rejected image ${imageId}: ${reason}`);
            // Track negative feedback for AI training
            trackNeuralInteraction?.(imageId, "reject", {
              roomType: room.id,
              style: currentStyle,
              reason,
            });
          }}
        />
      )}

      {/* Infinite Scroll Sentinel & GoldPulse Loader */}
      <div ref={galleryEndRef} className="py-4">
        {isLoadingMore && hasMore && (
          <GoldPulseLoader text="Curating more luxury for you..." size="md" />
        )}
        {!hasMore && photos.length > 0 && (
          <div className="py-8 text-center text-sm text-gray-500">
            ✨ You&apos;ve seen all available images
          </div>
        )}
      </div>

      {gallery.length === 0 && !loading && (
        <div className="flex min-h-60 flex-col items-center justify-center gap-4 rounded-xl border border-white/10 bg-gradient-to-br from-amber-900/10 to-black p-8 text-center">
          <div className="relative">
            <div className="h-16 w-16 animate-pulse rounded-full bg-amber-500/20 blur-xl" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500/30 border-t-amber-500" />
            </div>
          </div>
          <p className="text-sm text-white/60">جاري تحميل المزيد من الصور...</p>
        </div>
      )}

      {/* Image Lightbox with scroll tracking */}
      <ImageLightbox
        isOpen={lightboxOpen}
        images={photos}
        currentIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        onNext={nextImage}
        onPrev={prevImage}
        onNavigate={navigateToImage}
        onDownload={(index) => {
          // Track download with psychological signal (+10 Commitment) from modal
          console.log(`[Psychological Signal] Critical Interest: Download (+10) from Modal`);
          console.log(`[Neural Analytics] Download image ${index + 1}: +10 points (Modal)`);
          trackNeuralInteraction?.(index + 1, "download", {
            roomType: room.id,
            style: currentStyle,
            imageId: photos[index]?.id,
            source: "modal",
          });
        }}
      />
    </>
  );
}
