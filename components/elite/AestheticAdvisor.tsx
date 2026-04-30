"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { askOpenRouter } from "@/lib/ai-orchestrator";

/**
 * Aesthetic Advisor Component
 * Post-submission visual inspiration using Claude 3.5 Vision
 * STRICT: No materials, countries, or fixed prices mentioned
 * Focus: Visual Harmony, Space Optimization, Design Styles only
 */

export type AestheticAdvice = {
  visualHarmony: string;
  spaceOptimization: string;
  designStyleDirection: string;
  inspirationalSummary: string;
};

export type UploadedImage = {
  id: string;
  url: string;
  file: File;
};

interface AestheticAdvisorProps {
  scope: string;
  onComplete: (advice: AestheticAdvice | null) => void;
  onRequestSurvey: () => void;
  className?: string;
}

const MAX_IMAGES = 3;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 5;

export function AestheticAdvisor({
  scope,
  onComplete,
  onRequestSurvey,
  className = "",
}: AestheticAdvisorProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [advice, setAdvice] = useState<AestheticAdvice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    const newImages: UploadedImage[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Invalid format (JPG, PNG, WebP only)`);
        return;
      }

      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        errors.push(`${file.name}: File too large (max ${MAX_SIZE_MB}MB)`);
        return;
      }

      if (images.length + newImages.length >= MAX_IMAGES) {
        errors.push(`Maximum ${MAX_IMAGES} images allowed`);
        return;
      }

      const url = URL.createObjectURL(file);
      newImages.push({ id: crypto.randomUUID(), url, file });
    });

    if (errors.length > 0) {
      setError(errors.join("\n"));
      setTimeout(() => setError(null), 5000);
    }

    if (newImages.length > 0) {
      setImages((prev) => [...prev, ...newImages]);
    }
  }, [images]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const image = prev.find((i) => i.id === id);
      if (image) URL.revokeObjectURL(image.url);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const analyzeImages = async () => {
    if (images.length === 0) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      // Convert images to base64 for analysis
      const base64Images = await Promise.all(
        images.map(async (img) => {
          const buffer = await img.file.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
          return `data:${img.file.type};base64,${base64}`;
        })
      );

      const prompt = `You are an Aesthetic Advisor for Azenith Living, a luxury interior design consultancy in Egypt.

PROJECT SCOPE: ${scope}

Analyze the uploaded space/room images and provide VISUAL INSPIRATION ONLY.

STRICT PROHIBITIONS - DO NOT MENTION:
- Specific material types (types of wood, marble varieties, stone types)
- Countries of origin for materials or products
- Brand names or manufacturers
- Fixed prices, specific costs, or price guarantees
- Product model numbers or SKUs
- Specific furniture dimensions unless discussing proportional relationships

FOCUS AREAS - PROVIDE INSPIRATION ON:
1. Visual Harmony - Color relationships, balance, rhythm, focal points
2. Space Optimization - Flow, spatial relationships, proportional balance
3. Design Style Direction - Aesthetic movements, visual language, emotional tone

OUTPUT FORMAT (JSON):
{
  "visualHarmony": "2-3 sentences about color relationships, visual balance, and compositional flow",
  "spaceOptimization": "2-3 sentences about spatial flow, functional layout, and proportional harmony",
  "designStyleDirection": "2-3 sentences suggesting aesthetic direction and visual language",
  "inspirationalSummary": "One inspiring paragraph that motivates the user to Request a Human Technical Survey"
}

Tone: Advisory, inspiring, sophisticated. Lead naturally toward professional consultation.

Return ONLY valid JSON, no markdown.`;

      const result = await askOpenRouter(prompt, base64Images[0], {
        model: "anthropic/claude-3.5-sonnet",
        temperature: 0.4,
        maxTokens: 1024,
      });

      if (!result.success) {
        throw new Error(result.error || "Analysis failed");
      }

      const cleaned = result.content.replace(/```json\n?|```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);

      const aestheticAdvice: AestheticAdvice = {
        visualHarmony: parsed.visualHarmony || "",
        spaceOptimization: parsed.spaceOptimization || "",
        designStyleDirection: parsed.designStyleDirection || "",
        inspirationalSummary: parsed.inspirationalSummary || "",
      };

      setAdvice(aestheticAdvice);
      onComplete(aestheticAdvice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze images");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const skipAdvisor = () => {
    onComplete(null);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <AnimatePresence mode="wait">
        {!advice ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="text-center">
              <p className="text-sm uppercase tracking-[0.28em] text-amber-400/70">
                Aesthetic Vision
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                Visual Inspiration Analysis
              </h3>
              <p className="mt-2 text-sm text-white/60">
                Upload photos of your space for personalized design direction
              </p>
            </div>

            {/* Upload Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                dragActive
                  ? "border-amber-400 bg-amber-500/10"
                  : "border-white/20 bg-white/[0.02] hover:border-white/40"
              }`}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <div className="pointer-events-none space-y-3">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-3xl">
                  📸
                </div>
                <p className="text-white">Drop images here or click to browse</p>
                <p className="text-xs text-white/40">
                  JPG, PNG, WebP up to {MAX_SIZE_MB}MB each
                </p>
              </div>
            </div>

            {/* Image Previews */}
            {images.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-3 gap-3"
              >
                {images.map((img) => (
                  <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden">
                    <img
                      src={img.url}
                      alt="Upload preview"
                      className="h-full w-full object-cover"
                    />
                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl bg-red-500/10 p-4 text-sm text-red-300"
              >
                {error}
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={skipAdvisor}
                className="flex-1 rounded-xl border border-white/20 bg-white/[0.05] px-6 py-3 text-white transition-colors hover:bg-white/10"
              >
                Skip This Step
              </button>
              <button
                onClick={analyzeImages}
                disabled={images.length === 0 || isAnalyzing}
                className={`flex-1 rounded-xl px-6 py-3 font-medium transition-all ${
                  images.length > 0 && !isAnalyzing
                    ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black hover:from-amber-400 hover:to-yellow-300"
                    : "cursor-not-allowed bg-white/10 text-white/40"
                }`}
              >
                {isAnalyzing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Analyzing...
                  </span>
                ) : (
                  `Analyze ${images.length > 0 ? `(${images.length})` : ""}`
                )}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="advice"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Results Header */}
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-300 text-3xl">
                ✨
              </div>
              <h3 className="text-2xl font-semibold text-white">
                Your Visual Direction
              </h3>
            </div>

            {/* Advice Cards */}
            <div className="space-y-4">
              {/* Visual Harmony */}
              <div className="rounded-xl border border-purple-400/30 bg-purple-500/10 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xl">🎨</span>
                  <h4 className="font-semibold text-purple-300">Visual Harmony</h4>
                </div>
                <p className="text-sm leading-relaxed text-white/80">
                  {advice.visualHarmony}
                </p>
              </div>

              {/* Space Optimization */}
              <div className="rounded-xl border border-blue-400/30 bg-blue-500/10 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xl">📐</span>
                  <h4 className="font-semibold text-blue-300">Space Optimization</h4>
                </div>
                <p className="text-sm leading-relaxed text-white/80">
                  {advice.spaceOptimization}
                </p>
              </div>

              {/* Design Style Direction */}
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xl">💫</span>
                  <h4 className="font-semibold text-amber-300">Design Style Direction</h4>
                </div>
                <p className="text-sm leading-relaxed text-white/80">
                  {advice.designStyleDirection}
                </p>
              </div>
            </div>

            {/* Inspirational Summary */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm italic leading-relaxed text-white/90">
                "{advice.inspirationalSummary}"
              </p>
            </div>

            {/* Disclaimer */}
            <p className="text-center text-xs text-white/40">
              This is visual inspiration only. Specific materials, costs, and technical 
              specifications require an on-site technical survey.
            </p>

            {/* CTA */}
            <button
              onClick={onRequestSurvey}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 px-6 py-4 font-semibold text-black transition-all hover:from-amber-400 hover:to-yellow-300"
            >
              Request Human Technical Survey
            </button>

            <button
              onClick={() => setAdvice(null)}
              className="w-full rounded-xl border border-white/20 bg-white/[0.05] px-6 py-3 text-sm text-white transition-colors hover:bg-white/10"
            >
              Analyze Different Images
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AestheticAdvisor;
