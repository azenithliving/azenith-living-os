"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ImageMetadata } from "@/services/aiEnhancement";

interface ImageMetadataPanelProps {
  metadata: ImageMetadata | null | undefined;
  className?: string;
}

/**
 * Passive UI Component: Color Palette & Materials Display
 * 
 * Design Principles:
 * - Only renders if metadata exists (null = invisible)
 * - No loading states that block UI
 * - Non-breaking: Image displays exactly as before if no metadata
 * - Luxury aesthetic matching Azenith brand
 */
export default function ImageMetadataPanel({ metadata, className = "" }: ImageMetadataPanelProps) {
  // PASSIVE: If no metadata, render nothing (not even an empty div)
  if (!metadata) {
    return null;
  }

  const { colorPalette, materials, styleConfidence } = metadata;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`rounded-xl border border-amber-500/20 bg-gradient-to-br from-gray-900/80 to-gray-800/80 p-4 backdrop-blur-sm ${className}`}
      >
        {/* Header with confidence score */}
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-medium uppercase tracking-wider text-amber-400">
            AI Analysis
          </h4>
          {styleConfidence > 0 && (
            <span className="text-[10px] text-gray-500">
              {Math.round(styleConfidence * 100)}% match
            </span>
          )}
        </div>

        {/* Color Palette */}
        <div className="mb-4">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-gray-400">
            Color Palette
          </p>
          <div className="flex items-center gap-2">
            {/* Primary */}
            <div className="group relative">
              <div
                className="h-8 w-8 rounded-lg shadow-lg ring-1 ring-white/10 transition-transform group-hover:scale-110"
                style={{ backgroundColor: colorPalette.primary }}
              />
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-gray-500 opacity-0 transition-opacity group-hover:opacity-100">
                Primary
              </span>
            </div>

            {/* Secondary */}
            <div className="group relative">
              <div
                className="h-8 w-8 rounded-lg shadow-lg ring-1 ring-white/10 transition-transform group-hover:scale-110"
                style={{ backgroundColor: colorPalette.secondary }}
              />
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-gray-500 opacity-0 transition-opacity group-hover:opacity-100">
                Secondary
              </span>
            </div>

            {/* Accent */}
            <div className="group relative">
              <div
                className="h-8 w-8 rounded-lg shadow-lg ring-1 ring-white/10 transition-transform group-hover:scale-110"
                style={{ backgroundColor: colorPalette.accent }}
              />
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-gray-500 opacity-0 transition-opacity group-hover:opacity-100">
                Accent
              </span>
            </div>

            {/* Neutrals */}
            {colorPalette.neutrals.slice(0, 3).map((neutral, idx) => (
              <div key={idx} className="group relative">
                <div
                  className="h-6 w-6 rounded-md shadow-md ring-1 ring-white/10 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: neutral }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Materials */}
        {materials.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-wider text-gray-400">
              Materials
            </p>
            <div className="flex flex-wrap gap-1.5">
              {materials.slice(0, 4).map((material, idx) => (
                <span
                  key={idx}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-gray-300"
                >
                  {material.name}
                  {material.finish && (
                    <span className="ml-1 text-gray-500">({material.finish})</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Compact version for inline display (e.g., in gallery cards)
 */
export function ImageMetadataBadge({ metadata }: { metadata: ImageMetadata | null | undefined }) {
  if (!metadata) return null;

  return (
    <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-amber-500/30 bg-gray-900/90 px-2 py-1 backdrop-blur-sm">
      <div
        className="h-3 w-3 rounded-full ring-1 ring-white/20"
        style={{ backgroundColor: metadata.colorPalette.primary }}
      />
      <span className="text-[9px] text-amber-400">
        {metadata.materials.length} materials
      </span>
    </div>
  );
}
