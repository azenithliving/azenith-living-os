"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import ImageLightbox from "./ImageLightbox";
import AIStylePicker from "./AIStylePicker";
import GoldPulseLoader from "./GoldPulseLoader";
import useSessionStore, { type StylePreference } from "@/stores/useSessionStore";
import { useImageTracking } from "@/hooks/useImageTracking";

// Client-only gallery to avoid hydration issues
const DynamicGallery = dynamic(() => import("./DynamicGallery"), { ssr: false });

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
  }>;
  styleDesc?: { category: string; description: string };
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

  // Simplified local state
  const [photos, setPhotos] = useState(initialPhotos);
  const [currentStyle, setCurrentStyle] = useState(initialStyle);
  const [poolSize, setPoolSize] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Image hover tracking
  const { score, hoveredImage, feedback, onHoverStart, onHoverEnd } = useImageTracking();

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
          lastPage: `/room/${room.id}`,
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
    router.replace(`/room/${room.id}?${params.toString()}`, { scroll: false });

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
            {styleDesc?.category ?? room.category}
          </span>
          <h1 className="mt-2 text-4xl font-bold md:text-6xl">{room.title}</h1>
        </div>
        <button
          onClick={handleShuffle}
          disabled={loading}
          className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-all hover:bg-amber-500/20 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Shuffle
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
            alt={room.title}
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
            انقر للتكبير
          </span>
        </div>
      </motion.div>

      <div className="mb-12">
        <p className="border-r-2 border-amber-500 pr-6 text-xl italic leading-relaxed text-gray-400">
          &ldquo;{styleDesc?.description ?? room.description}&rdquo;
        </p>
      </div>

      {loading && (
        <div className="mb-8 flex items-center justify-center py-12">
          <GoldPulseLoader text="جاري تحديث الصور..." size="md" />
        </div>
      )}

      {/* Client-Only Gallery */}
      <DynamicGallery
        roomId={room.id}
        roomTitle={room.title}
        roomQuery={room.query}
        initialPhotos={initialPhotos}
        currentStyle={currentStyle}
        intent={intent || "exploring"}
        budget={budget || "flexible"}
        onImageClick={(index) => openLightbox(index + 1)}
        trackNeuralInteraction={trackNeuralInteraction}
      />

      <ImageLightbox
        isOpen={lightboxOpen}
        images={photos}
        currentIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        onNext={nextImage}
        onPrev={prevImage}
        onNavigate={navigateToImage}
        onDownload={(index) => {
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
