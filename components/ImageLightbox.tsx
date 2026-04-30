"use client";

import { useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import Image from "next/image";

interface ImageLightboxProps {
  isOpen: boolean;
  images: Array<{ src: { large2x?: string; large?: string }; alt?: string }>;
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onNavigate: (index: number) => void;
  onScroll?: (scrollPosition: number) => void;
  onDownload?: (index: number) => void;
}

export default function ImageLightbox({
  isOpen,
  images,
  currentIndex,
  onClose,
  onNext,
  onPrev,
  onNavigate,
  onScroll,
  onDownload,
}: ImageLightboxProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
    },
    [isOpen, onClose, onNext, onPrev]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Scroll tracking for gallery engagement
  useEffect(() => {
    if (!isOpen || !onScroll) return;

    const handleScroll = () => {
      onScroll(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isOpen, onScroll]);

  const currentImage = images[currentIndex];
  if (!currentImage) return null;

  const imageUrl = currentImage.src?.large2x || currentImage.src?.large || "/placeholder-room.jpg";

  // Handle download with blob/fetch for actual file save
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!imageUrl || isDownloading) return;
    
    setIsDownloading(true);
    
    try {
      // Fetch image as blob to force download
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `azenith-design-${currentIndex + 1}.jpg`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup blob URL after a delay
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      
      // Call tracking callback
      if (onDownload) {
        onDownload(currentIndex);
      }
    } catch (error) {
      console.error('[Download] Failed to download image:', error);
      // Fallback: open in new tab
      window.open(imageUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 hover:scale-110"
            aria-label="إغلاق"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Download button - elegant gold, top-left */}
          {onDownload && (
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="absolute left-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-[#d4af37] transition-all hover:bg-white/20 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: '#d4af37' }}
              aria-label="تحميل"
              title="تحميل"
            >
              <Download className={`h-6 w-6 ${isDownloading ? 'animate-pulse' : ''}`} />
            </button>
          )}

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPrev();
                }}
                className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 hover:scale-110"
                aria-label="الصورة السابقة"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNext();
                }}
                className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 hover:scale-110"
                aria-label="الصورة التالية"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Main image */}
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="relative h-[85vh] w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={imageUrl}
              alt={currentImage.alt || `صورة ${currentIndex + 1}`}
              fill
              className="object-contain"
              sizes="90vw"
              priority
            />
          </motion.div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 flex max-w-[90vw] -translate-x-1/2 gap-2 overflow-x-auto rounded-xl bg-black/50 p-3 backdrop-blur-sm">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(idx);
                  }}
                  className={`relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg transition-all ${
                    idx === currentIndex
                      ? "ring-2 ring-[#C5A059]"
                      : "opacity-50 hover:opacity-80"
                  }`}
                >
                  <Image
                    src={img.src?.large || "/placeholder-room.jpg"}
                    alt={`thumbnail ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Image counter */}
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 text-sm text-white backdrop-blur-sm">
            {currentIndex + 1} / {images.length}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
