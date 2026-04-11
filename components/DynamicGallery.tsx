"use client";

/**
 * Azenith Infinite Pulse: Elite Gallery Component v2.0
 * 
 * Features:
 * - 25-image batch system (replaces 15-image infinite scroll)
 * - Fact cards interleaved between batches using architectDB
 * - Fixed-height containers for Zero Layout Shift (CLS)
 * - Server-side shuffled image fetching
 * - Auto-healing on image errors
 * - Obsidian/Gold theme with Playfair Display typography
 */

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Sparkles, Info, Lightbulb, X } from "lucide-react";
import { getRandomDesignTip, type DesignTip } from "@/architectDB";
import GoldPulseLoader from "./GoldPulseLoader";

// ============================================
// CONFIGURATION
// ============================================

const BATCH_SIZE = 25;              // Images per batch
const SCROLL_THRESHOLD = 200;       // px before bottom
const DEBOUNCE_TIME = 300;        // ms between fetches
const FACT_CARD_HEIGHT = 280;     // Fixed height for CLS prevention

interface Photo {
  id: number;
  src: { large2x?: string; large?: string; medium?: string; original?: string };
  alt?: string;
  photographer?: string;
  metadata?: {
    aiScore?: number;
    luxury?: number;
    quality?: number;
    reason?: string;
  };
}

interface DynamicGalleryProps {
  roomId: string;
  roomTitle: string;
  roomQuery: string;
  initialPhotos: Photo[];
  currentStyle: string;
  intent: string;
  budget: string;
  onImageClick: (index: number) => void;
  trackNeuralInteraction?: (imageId: number, interactionType: "hover" | "modal" | "download" | "reject", metadata?: Record<string, unknown>) => void;
}

// ============================================
// FACT CARD COMPONENT (Fixed Height)
// ============================================

function FactCard({ tip, onClose }: { tip: DesignTip; onClose?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="relative overflow-hidden rounded-2xl border border-[#C5A059]/30 bg-gradient-to-br from-[#1A1A1B] via-[#232324] to-[#1A1A1B] p-6 shadow-2xl"
      style={{ height: `${FACT_CARD_HEIGHT}px` }}
    >
      {/* Gold accent line */}
      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-[#C5A059] via-[#E5D4A1] to-[#C5A059]" />
      
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-white/40 transition-colors hover:text-white/80"
          aria-label="Dismiss tip"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C5A059]/20">
          <Lightbulb className="h-5 w-5 text-[#C5A059]" />
        </div>
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-[#C5A059]">
            معلومة هندسية
          </span>
          <h3 className="font-playfair text-lg font-semibold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            {tip.title}
          </h3>
        </div>
      </div>

      {/* Content */}
      <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-white/80">
        {tip.content}
      </p>

      {/* Technical Specs */}
      {tip.technicalSpecs && (
        <div className="mt-auto rounded-lg border border-white/5 bg-white/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-[#C5A059]">
            <Info className="h-3 w-3" />
            <span className="uppercase tracking-wider">المواصفات الفنية</span>
          </div>
          <div className="space-y-1 text-xs text-white/60">
            {tip.technicalSpecs.measurement && (
              <p><span className="text-white/40">الأبعاد:</span> {tip.technicalSpecs.measurement}</p>
            )}
            {tip.technicalSpecs.colorTemp && (
              <p><span className="text-white/40">درجة الحرارة:</span> {tip.technicalSpecs.colorTemp}</p>
            )}
            {tip.technicalSpecs.ratio && (
              <p><span className="text-white/40">النسبة:</span> {tip.technicalSpecs.ratio}</p>
            )}
            {tip.technicalSpecs.standard && (
              <p><span className="text-white/40">المعيار:</span> {tip.technicalSpecs.standard}</p>
            )}
          </div>
        </div>
      )}

      {/* Decorative gradient */}
      <div className="absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-[#C5A059]/5 blur-3xl" />
    </motion.div>
  );
}

// ============================================
// IMAGE GRID ITEM (With Auto-Healing)
// ============================================

function GalleryImage({
  photo,
  index,
  onClick,
  onError,
  isPriority,
}: {
  photo: Photo;
  index: number;
  onClick: () => void;
  onError: () => void;
  isPriority: boolean;
}) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const handleError = () => {
    setHasError(true);
    onError();
  };

  if (hasError) {
    return (
      <div 
        className="relative h-full w-full overflow-hidden rounded-xl border border-white/5 bg-white/5"
        onClick={onClick}
      >
        <div className="flex h-full flex-col items-center justify-center p-4 text-center">
          <Sparkles className="mb-2 h-8 w-8 text-[#C5A059]/30" />
          <p className="text-xs text-white/40">صورة غير متوفرة</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: isLoaded ? 1 : 0, scale: isLoaded ? 1 : 0.95 }}
      transition={{ duration: 0.3, delay: (index % 10) * 0.05 }}
      className={`relative h-full w-full overflow-hidden rounded-xl border border-white/10 transition-all duration-300 hover:border-[#C5A059]/30 ${
        index % 5 === 0 ? "col-span-2 row-span-2" : "col-span-1 row-span-1"
      }`}
      onClick={onClick}
    >
      <Image
        src={photo.src?.large2x || photo.src?.large || photo.src?.medium || "/placeholder-room.jpg"}
        alt={photo.alt || `Gallery image ${index + 1}`}
        fill
        sizes={index % 5 === 0 ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 50vw, 33vw"}
        className="object-cover transition-transform duration-500 hover:scale-105"
        priority={isPriority}
        loading={isPriority ? "eager" : "lazy"}
        quality={85}
        onError={handleError}
        onLoad={() => setIsLoaded(true)}
      />
      
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 hover:opacity-100">
        {photo.metadata?.aiScore && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-[#C5A059]" />
            <span className="text-xs text-white/90">
              Elite {(photo.metadata.aiScore * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// MAIN DYNAMIC GALLERY COMPONENT
// ============================================

export default function DynamicGallery({
  roomId,
  roomTitle,
  roomQuery,
  initialPhotos,
  currentStyle,
  intent,
  budget,
  onImageClick,
  trackNeuralInteraction,
}: DynamicGalleryProps) {
  // State management
  const [allPhotos, setAllPhotos] = useState<Photo[]>(initialPhotos);
  const [displayedPhotos, setDisplayedPhotos] = useState<Photo[]>([]);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [factCardTip, setFactCardTip] = useState<DesignTip | null>(null);
  const [seed, setSeed] = useState<number>(Date.now());
  const [errorCount, setErrorCount] = useState(0);

  // Refs
  const galleryEndRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Mount logic
  useEffect(() => {
    setMounted(true);
    // Load first batch and generate fact card
    loadBatch(0);
    setFactCardTip(getRandomDesignTip(roomId));
  }, []);

  // SAFETY TIMEOUT: Force mounted to true after 4 seconds if stuck
  useEffect(() => {
    if (mounted) return;
    
    const safetyTimer = setTimeout(() => {
      console.warn("[SAFETY] DynamicGallery mounted forced to true after timeout");
      setMounted(true);
    }, 4000);
    
    return () => clearTimeout(safetyTimer);
  }, [mounted]);

  // Reset when style/room changes
  useEffect(() => {
    setCurrentBatch(0);
    setDisplayedPhotos([]);
    setHasMore(true);
    setSeed(Date.now());
    setFactCardTip(getRandomDesignTip(roomId));
    fetchShuffledImages(true);
  }, [roomId, currentStyle]);

  // ============================================
  // SERVER-SIDE SHUFFLED FETCHING
  // ============================================
  
  const fetchShuffledImages = useCallback(async (reset: boolean = false) => {
    if (isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    setIsLoadingMore(true);

    try {
      const response = await fetch(
        `/api/elite-gallery?roomId=${roomId}&style=${currentStyle}&seed=${seed}&limit=100`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(`Gallery API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.photos && data.photos.length > 0) {
        if (reset) {
          setAllPhotos(data.photos);
          setCurrentBatch(0);
          loadBatch(0, data.photos);
        } else {
          setAllPhotos(prev => [...prev, ...data.photos]);
        }
        
        console.log(`[Elite Gallery] Fetched ${data.photos.length} shuffled images`);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("[Elite Gallery] Fetch error:", error);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [roomId, currentStyle, seed]);

  // ============================================
  // BATCH LOADING LOGIC
  // ============================================

  const loadBatch = useCallback((batchIndex: number, photos: Photo[] = allPhotos) => {
    const start = batchIndex * BATCH_SIZE;
    const end = start + BATCH_SIZE;
    const batch = photos.slice(start, end);

    if (batch.length === 0) {
      setHasMore(false);
      return;
    }

    setDisplayedPhotos(prev => [...prev, ...batch]);
    setCurrentBatch(batchIndex);

    // Generate new fact card every 2 batches
    if ((batchIndex + 1) % 2 === 0) {
      setFactCardTip(getRandomDesignTip(roomId));
    }

    console.log(`[Elite Gallery] Loaded batch ${batchIndex + 1}: ${batch.length} images`);
  }, [allPhotos, roomId]);

  // ============================================
  // INFINITE SCROLL OBSERVER
  // ============================================

  useEffect(() => {
    if (!mounted) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isFetchingRef.current) {
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }

          debounceTimerRef.current = setTimeout(() => {
            const nextBatch = currentBatch + 1;
            const start = nextBatch * BATCH_SIZE;

            if (start < allPhotos.length) {
              // Load from existing photos
              loadBatch(nextBatch);
            } else if (hasMore) {
              // Fetch more from server
              fetchShuffledImages();
            }
          }, DEBOUNCE_TIME);
        }
      },
      { rootMargin: `${SCROLL_THRESHOLD}px` }
    );

    const currentEnd = galleryEndRef.current;
    if (currentEnd) {
      observer.observe(currentEnd);
    }

    return () => {
      observer.disconnect();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [mounted, currentBatch, allPhotos.length, hasMore, isLoadingMore, loadBatch, fetchShuffledImages]);

  // ============================================
  // AUTO-HEALING: Mark dead images
  // ============================================

  const handleImageError = useCallback((photoId: number) => {
    console.log(`[Elite Gallery] Image ${photoId} failed to load, marking as dead`);
    setErrorCount(prev => prev + 1);
    
    // Report to server for maintenance
    fetch("/api/mark-dead-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId: photoId }),
    }).catch(() => {}); // Silent fail

    // Remove from display
    setDisplayedPhotos(prev => prev.filter(p => p.id !== photoId));
  }, []);

  // ============================================
  // RENDER
  // ============================================

  if (!mounted) {
    return (
      <div className="py-12">
        <GoldPulseLoader text="Loading elite gallery..." size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Error count indicator (only if significant) */}
      {errorCount > 5 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-400">
          {errorCount} images filtered out for quality. Refresh for fresh content.
        </div>
      )}

      {/* Gallery Grid with Fact Card Interleaving */}
      <div className="space-y-8">
        {displayedPhotos.length > 0 && (
          <div className="grid auto-rows-[200px] grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
            {displayedPhotos.map((photo, index) => {
              const isPriority = index < 4;
              
              return (
                <GalleryImage
                  key={`${photo.id}-${index}`}
                  photo={photo}
                  index={index}
                  onClick={() => onImageClick(index)}
                  onError={() => handleImageError(photo.id)}
                  isPriority={isPriority}
                />
              );
            })}
          </div>
        )}

        {/* Fact Card Interleaved Every 25 Images (After 2nd batch) */}
        {displayedPhotos.length >= BATCH_SIZE * 2 && factCardTip && (
          <div className="my-8">
            <FactCard 
              tip={factCardTip} 
              onClose={() => setFactCardTip(null)}
            />
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoadingMore && hasMore && (
        <div className="py-8">
          <GoldPulseLoader text="Curating elite luxury..." size="md" />
        </div>
      )}

      {/* End Message */}
      {!hasMore && displayedPhotos.length > 0 && (
        <div className="py-8 text-center">
          <p className="text-sm text-white/40">
            You&apos;ve seen our elite collection. Refresh for a fresh curation.
          </p>
          <button
            onClick={() => {
              setSeed(Date.now());
              setDisplayedPhotos([]);
              setCurrentBatch(0);
              setHasMore(true);
              fetchShuffledImages(true);
            }}
            className="mt-4 rounded-full border border-[#C5A059]/30 bg-[#C5A059]/10 px-6 py-2 text-sm text-[#C5A059] transition-all hover:bg-[#C5A059]/20"
          >
            Refresh Collection
          </button>
        </div>
      )}

      {/* Infinite Scroll Sentinel */}
      <div ref={galleryEndRef} className="h-8" />
    </div>
  );
}

export { FactCard, GalleryImage };
