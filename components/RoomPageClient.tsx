"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Lightbulb, ChevronDown, Heart, Star, X, Sparkles, MessageCircle, ExternalLink, Bookmark } from "lucide-react";
import ImageLightbox from "./ImageLightbox";
import AIStylePicker from "./AIStylePicker";
import GoldPulseLoader from "./GoldPulseLoader";
import useSessionStore, { type StylePreference } from "@/stores/useSessionStore";
import { useImageTracking } from "@/hooks/useImageTracking";
import { getRoomTips, type RoomDesignTip } from "@/lib/room-design-tips";

// Client-only gallery to avoid hydration issues
const DynamicGallery = dynamic(() => import("./DynamicGallery"), { ssr: false });

interface RoomPageClientProps {
  room: {
    id: string;
    title: string;
    titleEn: string;
    category: string;
    categoryEn: string;
    description: string;
    descriptionEn: string;
    query: string;
  };
  initialPhotos: Array<{
    id: number;
    src: { large2x?: string; large?: string; medium?: string };
    alt?: string;
  }>;
  styleDesc?: { category: string; categoryEn: string; description: string; descriptionEn: string };
}

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

  // Use Arabic by default
  const isRTL = true;

  // Get room data (Arabic only)
  const roomTitle = room.title;
  const roomCategory = room.category;
  const roomDescription = room.description;

  // Simplified local state
  const [photos, setPhotos] = useState(initialPhotos);
  const [currentStyle, setCurrentStyle] = useState(initialStyle);
  const [poolSize, setPoolSize] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Batch image loading state
  const [batchPage, setBatchPage] = useState(1); // 1, 2, 3 max
  const [allBatchPhotos, setAllBatchPhotos] = useState(initialPhotos);
  const [batchTips, setBatchTips] = useState<RoomDesignTip[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreBatches, setHasMoreBatches] = useState(true);
  const MAX_BATCHES = 3;
  const PHOTOS_PER_BATCH = 30;

  // Smart Design Assistant state
  const [favorites, setFavorites] = useState<number[]>([]);
  const [likedPhotos, setLikedPhotos] = useState<Set<number>>(new Set());
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<{
    photoId: number;
    photoUrl: string;
    detectedStyle: string;
    styleAr: string;
    description: string;
    suggestions: Array<{ id: string; name: string; url: string }>;
    message: string;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showPriceMessage, setShowPriceMessage] = useState(false);

  // Image hover tracking
  const { score, hoveredImage, feedback, onHoverStart, onHoverEnd } = useImageTracking();

  // Load favorites from localStorage on mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem(`favorites_${room.id}`);
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (e) {
        console.error('Failed to parse favorites:', e);
      }
    }
  }, [room.id]);

  // Save favorites to localStorage
  const saveToFavorites = useCallback((photoId: number) => {
    setFavorites(prev => {
      const newFavorites = prev.includes(photoId) ? prev : [...prev, photoId];
      localStorage.setItem(`favorites_${room.id}`, JSON.stringify(newFavorites));
      return newFavorites;
    });
  }, [room.id]);

  // Handle like button click - triggers AI analysis
  const handleLikePhoto = useCallback(async (photo: typeof initialPhotos[0], index: number) => {
    // Mark as liked
    setLikedPhotos(prev => {
      const newSet = new Set(prev);
      newSet.add(photo.id);
      return newSet;
    });

    // Get image URL for analysis
    const imageUrl = photo.src?.large2x || photo.src?.large || photo.src?.medium;
    if (!imageUrl) return;

    // Open modal and start analysis
    setAnalysisModalOpen(true);
    setIsAnalyzing(true);
    setCurrentAnalysis(null);

    try {
      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          currentRoomId: room.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCurrentAnalysis({
          photoId: photo.id,
          photoUrl: imageUrl,
          detectedStyle: data.analysis.detectedStyle,
          styleAr: data.analysis.styleAr,
          description: data.analysis.description,
          suggestions: data.analysis.suggestions,
          message: data.analysis.message,
        });
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [room.id]);

  // Initialize tips when room/style changes
  useEffect(() => {
    const tips = getRoomTips(room.id, currentStyle, MAX_BATCHES);
    setBatchTips(tips);
    setBatchPage(1);
    setAllBatchPhotos(initialPhotos);
    setHasMoreBatches(initialPhotos.length >= PHOTOS_PER_BATCH && 1 < MAX_BATCHES);
  }, [room.id, currentStyle, initialPhotos]);

  // Ref-Gate for profile updates
  const hasRoomViewDispatchedRef = useRef<boolean>(false);
  const pendingUpdateRef = useRef<{
    stylePrefs: Record<string, StylePreference>;
    timestamp: number;
  } | null>(null);
  const aggregationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reservoirRef = useRef<{ poolSize: number; lastSeed: number }>({ poolSize: 0, lastSeed: 0 });

  // Track room view once
  useEffect(() => {
    if (!isHydrated || hasRoomViewDispatchedRef.current) return;
    
    hasRoomViewDispatchedRef.current = true;
    const stylePrefs = userProfile?.stylePreferences as Record<string, StylePreference> | undefined;
    const currentPref = stylePrefs?.[currentStyle] || { roomCount: 0, totalTimeSpent: 0, lastViewedAt: 0 };
    
    pendingUpdateRef.current = {
      stylePrefs: {
        ...stylePrefs,
        [currentStyle]: {
          roomCount: currentPref.roomCount + 1,
          totalTimeSpent: currentPref.totalTimeSpent,
          lastViewedAt: Date.now(),
        },
      },
      timestamp: Date.now(),
    };
    
    aggregationTimerRef.current = setTimeout(() => {
      if (pendingUpdateRef.current) {
        updateProfile({
          lastPage: `/rooms/${room.id}`,
          userProfile: {
            ...userProfile,
            stylePreferences: pendingUpdateRef.current.stylePrefs,
          },
        });
        pendingUpdateRef.current = null;
      }
    }, 2000);
    
    return () => {
      if (aggregationTimerRef.current) {
        clearTimeout(aggregationTimerRef.current);
      }
    };
  }, [isHydrated, currentStyle, room.id, userProfile, updateProfile]);

  // Shuffle handler
  const handleShuffle = useCallback(async () => {
    if (loading) return;
    
    setLoading(true);
    const newSeed = Date.now();
    
    try {
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
        if (data.photos?.length > 0) {
          setPhotos(data.photos);
          setPoolSize(data.poolSize || 0);
          reservoirRef.current = { poolSize: data.poolSize, lastSeed: newSeed };
        }
      }
    } catch (error) {
      console.error("[Shuffle] Failed:", error);
    } finally {
      setLoading(false);
    }
  }, [room.id, currentStyle, loading]);

  // Style change handler
  const handleStyleChange = useCallback(async (newStyle: string) => {
    if (newStyle === currentStyle) return;

    setLoading(true);
    setCurrentStyle(newStyle);
    setSelectedStyle(newStyle);

    // Update URL
    const params = new URLSearchParams(searchParams);
    params.set("style", newStyle);
    router.replace(`/rooms/${room.id}?${params.toString()}`, { scroll: false });

    // Fetch new images
    try {
      const newSeed = Date.now();
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
        if (data.photos?.length > 0) {
          setPhotos(data.photos);
          setPoolSize(data.poolSize || 0);
          reservoirRef.current = { poolSize: data.poolSize, lastSeed: newSeed };
        }
      }
    } catch (error) {
      console.error("[Style Change] Failed:", error);
    } finally {
      setLoading(false);
    }
  }, [currentStyle, room.id, router, searchParams, setSelectedStyle]);

  // Lightbox handlers
  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  // Load more images handler
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || batchPage >= MAX_BATCHES) return;

    setIsLoadingMore(true);
    const nextPage = batchPage + 1;

    try {
      // Fetch from curated-images API (Supabase Storage with Pexels fallback)
      const response = await fetch(
        `/api/curated-images?room=${encodeURIComponent(room.id)}&style=${encodeURIComponent(currentStyle)}&per_page=${PHOTOS_PER_BATCH}&page=${nextPage}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();

      if (data.photos && data.photos.length > 0) {
        setAllBatchPhotos(prev => [...prev, ...data.photos]);
        setBatchPage(nextPage);
        setHasMoreBatches(nextPage < MAX_BATCHES && data.photos.length >= PHOTOS_PER_BATCH);
      } else {
        setHasMoreBatches(false);
      }
    } catch (error) {
      console.error("[Load More] Failed:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [batchPage, currentStyle, isLoadingMore, room.id]);

  const nextImage = useCallback(() => {
    setLightboxIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  const prevImage = useCallback(() => {
    setLightboxIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const navigateToImage = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (aggregationTimerRef.current) {
        clearTimeout(aggregationTimerRef.current);
      }
      if (pendingUpdateRef.current) {
        updateProfile({
          lastPage: `/rooms/${room.id}`,
          userProfile: {
            ...userProfile,
            stylePreferences: pendingUpdateRef.current.stylePrefs,
          },
        });
      }
    };
  }, [room.id, updateProfile, userProfile]);

  const heroImage = photos[0];

  return (
    <>
      <div className="mb-8">
        <AIStylePicker
          selectedStyle={currentStyle}
          onStyleChange={handleStyleChange}
        />
      </div>

      <div className="mb-10 flex items-start justify-between">
        <div>
          <span className="text-sm uppercase tracking-wider text-amber-500">
            {isRTL ? (styleDesc?.category ?? roomCategory) : (styleDesc?.categoryEn ?? roomCategory)}
          </span>
          <h1 className="mt-2 text-4xl font-bold md:text-6xl">{roomTitle}</h1>
        </div>
        <button
          onClick={handleShuffle}
          disabled={loading}
          className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-all hover:bg-amber-500/20 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isRTL ? "تبديل" : "Shuffle"}
        </button>
      </div>

      <motion.div
        className="relative mb-12 aspect-[21/9] cursor-pointer overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
        onClick={() => openLightbox(0)}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.3 }}
      >
        {heroImage ? (
          <Image
            src={heroImage.src?.large2x || heroImage.src?.large || "/placeholder-room.jpg"}
            alt={roomTitle}
            fill
            sizes="(max-width: 768px) 100vw, 1200px"
            className="object-cover"
            priority={true}
            loading="eager"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-amber-900/20 to-black">
            <GoldPulseLoader text="Loading..." size="sm" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all hover:bg-black/30 hover:opacity-100">
          <span className="rounded-full bg-white/20 px-6 py-3 text-white backdrop-blur-sm">
            {isRTL ? "انقر للتكبير" : "Click to enlarge"}
          </span>
        </div>
      </motion.div>

      <div className="mb-12">
        <p className="border-r-2 border-amber-500 pr-6 text-xl italic leading-relaxed text-gray-400">
          &ldquo;{isRTL ? (styleDesc?.description ?? roomDescription) : (styleDesc?.descriptionEn ?? roomDescription)}&rdquo;
        </p>
      </div>

      {loading && (
        <div className="mb-8 flex items-center justify-center py-12">
          <GoldPulseLoader text={isRTL ? "جاري تحديث الصور..." : "Updating images..."} size="md" />
        </div>
      )}

      {/* Batch Image Gallery */}
      <div className="space-y-8">
        {/* Render photos and tips in batches */}
        {Array.from({ length: batchPage }).map((_, batchIndex) => {
          const startIdx = batchIndex * PHOTOS_PER_BATCH;
          const endIdx = startIdx + PHOTOS_PER_BATCH;
          const batchPhotos = allBatchPhotos.slice(startIdx, endIdx);
          const tip = batchTips[batchIndex];
          
          return (
            <div key={batchIndex} className="space-y-6">
              {/* Photo Grid for this batch */}
              {batchPhotos.length > 0 && (
                <div className="grid auto-rows-[240px] grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
                  {batchPhotos.map((photo, idx) => {
                    const globalIndex = startIdx + idx;
                    const isPriority = globalIndex < 4;
                    const isLarge = idx % 5 === 0;
                    const isLiked = likedPhotos.has(photo.id);
                    const isFavorited = favorites.includes(photo.id);
                    
                    return (
                      <div 
                        key={`${photo.id}-${globalIndex}`}
                        className={`group relative flex flex-col ${
                          isLarge ? "col-span-2 row-span-2" : "col-span-1 row-span-1"
                        }`}
                      >
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: idx * 0.03 }}
                          className="relative h-full w-full overflow-hidden rounded-xl border border-white/10 transition-all duration-300 hover:border-amber-500/30 cursor-pointer"
                          onClick={() => openLightbox(globalIndex)}
                          whileHover={{ scale: 1.02 }}
                        >
                          <Image
                            src={photo.src?.large2x || photo.src?.large || photo.src?.medium || "/placeholder-room.jpg"}
                            alt={photo.alt || `${roomTitle} - ${globalIndex + 1}`}
                            fill
                            sizes={isLarge ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 50vw, 33vw"}
                            className="object-cover transition-transform duration-500 hover:scale-105"
                            priority={isPriority}
                            loading={isPriority ? "eager" : "lazy"}
                            quality={85}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 hover:opacity-100">
                            <span className="absolute bottom-3 left-3 text-xs text-white/80">
                              {globalIndex + 1}
                            </span>
                          </div>
                        </motion.div>
                        
                        {/* Like & Favorite Buttons */}
                        <div className="mt-2 flex items-center justify-center gap-3">
                          <motion.button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLikePhoto(photo, globalIndex);
                            }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                              isLiked 
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" 
                                : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                            }`}
                          >
                            <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-current" : ""}`} />
                            <span>{isLiked ? "أعجبني" : "أعجبني"}</span>
                          </motion.button>
                          
                          <motion.button
                            onClick={(e) => {
                              e.stopPropagation();
                              saveToFavorites(photo.id);
                            }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                              isFavorited 
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" 
                                : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                            }`}
                          >
                            <Bookmark className={`h-3.5 w-3.5 ${isFavorited ? "fill-current" : ""}`} />
                            <span>{isFavorited ? "محفوظ" : "حفظ"}</span>
                          </motion.button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Design Tip Card */}
              {tip && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-6 shadow-2xl"
                >
                  {/* Gold accent line */}
                  <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-500 via-amber-300 to-amber-500" />
                  
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                      <Lightbulb className="h-6 w-6 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <span className="text-xs font-medium uppercase tracking-wider text-amber-400">
                        معلومة تصميمية - الدفعة {batchIndex + 1}
                      </span>
                      <h3 className="mt-1 text-xl font-bold text-white">
                        {tip.title}
                      </h3>
                      <p className="mt-2 text-base leading-relaxed text-gray-300">
                        {tip.content}
                      </p>
                      <span className="mt-3 inline-block rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
                        {tip.category === "furniture" && "أثاث"}
                        {tip.category === "lighting" && "إضاءة"}
                        {tip.category === "colors" && "ألوان"}
                        {tip.category === "layout" && "تخطيط"}
                        {tip.category === "materials" && "خامات"}
                      </span>
                    </div>
                  </div>
                  
                  {/* Decorative gradient */}
                  <div className="absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-amber-500/5 blur-3xl" />
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* Load More Button */}
      {hasMoreBatches && (
        <div className="mt-10 flex flex-col items-center gap-4">
          {isLoadingMore ? (
            <GoldPulseLoader text="جاري تحميل المزيد..." size="sm" />
          ) : (
            <motion.button
              onClick={handleLoadMore}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group flex items-center gap-3 rounded-full border border-amber-500/30 bg-amber-500/10 px-8 py-4 text-base font-medium text-amber-400 transition-all hover:bg-amber-500/20"
            >
              <span>مشاهدة المزيد</span>
              <span className="text-sm text-amber-500/60">
                ({batchPage} من {MAX_BATCHES})
              </span>
              <ChevronDown className="h-5 w-5 transition-transform group-hover:translate-y-1" />
            </motion.button>
          )}
          <p className="text-sm text-gray-500">
            يمكنك تحميل {MAX_BATCHES - batchPage} دفعات إضافية (30 صورة لكل دفعة)
          </p>
        </div>
      )}

      {/* End Message */}
      {!hasMoreBatches && batchPage >= MAX_BATCHES && (
        <div className="mt-10 text-center">
          <p className="text-gray-500">
            لقد شاهدت جميع الدفعات المتاحة ({MAX_BATCHES} × {PHOTOS_PER_BATCH} صورة)
          </p>
        </div>
      )}

      {/* Smart Design Assistant Modal */}
      {analysisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setAnalysisModalOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <span className="font-bold text-white">مساعد التصميم الذكي</span>
              </div>
              <button
                onClick={() => setAnalysisModalOpen(false)}
                className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[70vh] overflow-y-auto p-6">
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <GoldPulseLoader text="جاري تحليل الصورة..." size="md" />
                  <p className="mt-4 text-sm text-gray-400">
                    الذكاء الاصطناعي يحلل استايل التصميم ويقترح لك غرف مشابهة
                  </p>
                </div>
              ) : currentAnalysis ? (
                <div className="space-y-6">
                  {/* Analyzed Image */}
                  <div className="relative aspect-video overflow-hidden rounded-xl">
                    <Image
                      src={currentAnalysis.photoUrl}
                      alt="الصورة المحللة"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute left-4 top-4 rounded-full bg-amber-500/90 px-3 py-1 text-sm font-bold text-black">
                      {currentAnalysis.styleAr}
                    </div>
                  </div>

                  {/* AI Message */}
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <p className="text-amber-100 leading-relaxed">
                      {currentAnalysis.message}
                    </p>
                  </div>

                  {/* Style Suggestion */}
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 font-bold text-white">
                      <Star className="h-4 w-4 text-amber-400" />
                      تحب تشوف صور أكتر من استايل {currentAnalysis.styleAr}؟
                    </h4>
                    <button
                      onClick={() => {
                        router.push(`/rooms/${room.id}?style=${currentAnalysis.detectedStyle}`);
                        setAnalysisModalOpen(false);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 py-3 text-amber-400 transition-all hover:bg-amber-500/20"
                    >
                      <span>استكشف استايل {currentAnalysis.styleAr}</span>
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Room Suggestions */}
                  {currentAnalysis.suggestions.length > 0 && (
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 font-bold text-white">
                        <MessageCircle className="h-4 w-4 text-amber-400" />
                        بناءً على ذوقك، ممكن تعجبك:
                      </h4>
                      <div className="grid gap-3">
                        {currentAnalysis.suggestions.map((suggestion) => (
                          <motion.button
                            key={suggestion.id}
                            onClick={() => {
                              router.push(suggestion.url);
                              setAnalysisModalOpen(false);
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right transition-all hover:border-amber-500/30 hover:bg-white/10"
                          >
                            <span className="font-medium text-white">{suggestion.name}</span>
                            <ExternalLink className="h-4 w-4 text-amber-400" />
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Save to Favorites */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        saveToFavorites(currentAnalysis.photoId);
                      }}
                      className={`flex-1 rounded-xl py-3 font-medium transition-all ${
                        favorites.includes(currentAnalysis.photoId)
                          ? "bg-amber-500 text-black"
                          : "border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                      }`}
                    >
                      {favorites.includes(currentAnalysis.photoId) 
                        ? "✓ تم الحفظ في المفضلة" 
                        : "حفظ في المفضلة"}
                    </button>
                    
                    <button
                      onClick={() => setShowPriceMessage(true)}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 font-medium text-white transition-all hover:bg-white/10"
                    >
                      معرفة السعر
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-400">
                  حدث خطأ في التحليل. يرجى المحاولة مرة أخرى.
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Price Message Modal */}
      {showPriceMessage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            onClick={() => setShowPriceMessage(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-green-500/30 bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 shadow-2xl"
          >
            <button
              onClick={() => setShowPriceMessage(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-white/60 transition-colors hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <MessageCircle className="h-8 w-8 text-green-400" />
            </div>
            
            <h3 className="mb-3 text-xl font-bold text-white">لمعرفة الأسعار</h3>
            <p className="mb-6 text-gray-300">
              تواصل معنا مباشرة عبر واتساب للحصول على تفاصيل الأسعار وعرض خاص مناسب لميزانيتك.
            </p>
            
            <a
              href="https://wa.me/966500000000?text=مرحباً،%20أرغب%20في%20معرفة%20أسعار%20التصميم%20الداخلي"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 py-3 font-bold text-white transition-all hover:bg-green-600"
            >
              <MessageCircle className="h-5 w-5" />
              <span>تواصل عبر واتساب</span>
            </a>
          </motion.div>
        </div>
      )}

      <ImageLightbox
        isOpen={lightboxOpen}
        images={allBatchPhotos}
        currentIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        onNext={nextImage}
        onPrev={prevImage}
        onNavigate={navigateToImage}
        onDownload={(index) => {
          trackNeuralInteraction?.(index + 1, "download", {
            roomType: room.id,
            style: currentStyle,
            imageId: allBatchPhotos[index]?.id,
            source: "modal",
          });
        }}
      />
    </>
  );
}
