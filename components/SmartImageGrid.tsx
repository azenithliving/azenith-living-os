"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Info } from "lucide-react";
import { useSmartImages } from "@/hooks/useSmartImages";
import ImageHoverWrapper from "./ImageHoverWrapper";

interface SmartImageGridProps {
  roomType: string;
  style: string;
  intent?: string;
  budget?: string;
  initialImages: Array<{
    id: number;
    src: { large?: string; large2x?: string };
    photographer?: string;
    avg_color?: string;
  }>;
  onImageClick?: (index: number) => void;
  onReject?: (imageId: number, reason: string) => void;
}

export default function SmartImageGrid({
  roomType,
  style,
  intent = "exploring",
  budget = "flexible",
  initialImages,
  onImageClick,
  onReject,
}: SmartImageGridProps) {
  const { images, loading, error, curationStats, refetch } = useSmartImages({
    roomType,
    style,
    intent,
    budget,
    initialImages,
  });

  const [hoveredImage, setHoveredImage] = useState<number | null>(null);
  const [rejectedImages, setRejectedImages] = useState<Set<number>>(new Set());
  const [showTooltip, setShowTooltip] = useState<number | null>(null);

  const handleReject = (imageId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setRejectedImages((prev) => new Set([...prev, imageId]));
    onReject?.(imageId, "User rejected");
    console.log(`[Smart Grid] User rejected image ${imageId}`);
  };

  const getQualityBadge = (score: number) => {
    if (score >= 90) return { label: "Perfect", color: "bg-emerald-500" };
    if (score >= 80) return { label: "Excellent", color: "bg-green-500" };
    if (score >= 70) return { label: "Good", color: "bg-blue-500" };
    return { label: "Fair", color: "bg-yellow-500" };
  };

  const filteredImages = images.filter((img) => !rejectedImages.has(img.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-white/60">
          <Sparkles className="h-5 w-5 animate-pulse text-amber-400" />
          <span>AI is curating images for your {style} {roomType}...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-900/20 p-4 text-red-400">
        <p className="text-sm">Curation unavailable: {error}</p>
        <button
          onClick={refetch}
          className="mt-2 text-xs underline hover:text-red-300"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Curation Stats */}
      {curationStats && (
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-sm text-white/80">
              AI Curated: {curationStats.approved} of {curationStats.total} images
            </span>
          </div>
          <span className="text-xs text-white/50">
            {curationStats.rejectionRate}% rejected
          </span>
        </div>
      )}

      {/* Masonry Grid */}
      <div className="grid auto-rows-[200px] grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
        {filteredImages.map((image, index) => {
          const badge = getQualityBadge(image.qualityScore);
          const isHovered = hoveredImage === image.id;

          return (
            <ImageHoverWrapper
              key={image.id}
              imageIndex={index + 1}
              onHoverStart={() => setHoveredImage(image.id)}
              onHoverEnd={() => setHoveredImage(null)}
              onDownload={() => {
                console.log(`[Smart Grid] Download image ${image.id}`);
              }}
              imageUrl={image.url}
              onImageClick={() => onImageClick?.(index)}
            >
              <motion.div
                className={`relative h-full w-full overflow-hidden rounded-xl ${
                  index % 5 === 0 ? "col-span-2 row-span-2" : "col-span-1 row-span-1"
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                {/* Image */}
                <Image
                  src={image.url}
                  alt={`${roomType} design ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                />

                {/* Quality Badge */}
                <div className="absolute left-3 top-3 z-20">
                  <div
                    className={`flex items-center gap-1 rounded-full ${badge.color} px-2 py-1 text-[10px] font-medium text-white shadow-lg`}
                  >
                    <Sparkles className="h-3 w-3" />
                    {badge.label}
                  </div>
                </div>

                {/* Info Tooltip Button */}
                <button
                  className="absolute right-3 top-3 z-20 rounded-full bg-black/50 p-1.5 text-white/80 backdrop-blur-sm transition-all hover:bg-black/70"
                  onMouseEnter={() => setShowTooltip(image.id)}
                  onMouseLeave={() => setShowTooltip(null)}
                >
                  <Info className="h-3.5 w-3.5" />
                </button>

                {/* Reject Button */}
                <button
                  className="absolute right-3 bottom-3 z-20 rounded-full bg-red-500/80 p-1.5 text-white opacity-0 shadow-lg transition-all hover:bg-red-600 group-hover:opacity-100"
                  onClick={(e) => handleReject(image.id, e)}
                  title="Not relevant"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                {/* Tooltip */}
                <AnimatePresence>
                  {showTooltip === image.id && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-3 top-12 z-30 w-48 rounded-lg border border-white/10 bg-gray-900/95 p-3 text-xs shadow-xl backdrop-blur-sm"
                    >
                      <p className="font-medium text-amber-400">AI Analysis</p>
                      <div className="mt-2 space-y-1 text-white/80">
                        <div className="flex justify-between">
                          <span>Quality:</span>
                          <span className="font-medium">{image.qualityScore}/100</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Relevance:</span>
                          <span className="font-medium">{image.relevanceScore}/100</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Budget:</span>
                          <span className="capitalize">{image.budgetMatch}</span>
                        </div>
                      </div>
                      <p className="mt-2 text-[10px] italic text-white/60">
                        &ldquo;{image.reason}&rdquo;
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </ImageHoverWrapper>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredImages.length === 0 && !loading && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-amber-400/50" />
          <p className="mt-3 text-white/60">
            No images match your criteria. Try adjusting your style or budget.
          </p>
          <button
            onClick={refetch}
            className="mt-4 rounded-lg bg-amber-500/20 px-4 py-2 text-sm text-amber-400 hover:bg-amber-500/30"
          >
            Refresh Curation
          </button>
        </div>
      )}
    </div>
  );
}
