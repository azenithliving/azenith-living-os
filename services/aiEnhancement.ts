/**
 * AI Enhancement Service
 * Isolated service for AI color & material analysis
 * Does NOT modify useSessionStore or behavioral tracking
 * Strict try-catch wrappers with immediate fallback
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  neutrals: string[];
}

export interface MaterialInfo {
  name: string;
  type: "wood" | "metal" | "stone" | "fabric" | "glass" | "other";
  finish?: string;
}

export interface ImageMetadata {
  colorPalette: ColorPalette;
  materials: MaterialInfo[];
  styleConfidence: number;
  analyzedAt: string;
}

/**
 * Analyze image for color palette and materials
 * Strict try-catch with immediate fallback to null
 */
export async function analyzeImageMetadata(
  imageUrl: string,
  roomType: string,
  style: string
): Promise<ImageMetadata | null> {
  // Safety check: No API key = immediate null
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    const prompt = `Analyze this luxury ${style} ${roomType} interior image.

Return ONLY a JSON object with:
1. Color palette (primary, secondary, accent colors, neutrals)
2. Materials visible (wood types, metals, stones, fabrics)
3. Style confidence score (0-1)

Format:
{
  "colorPalette": {
    "primary": "#hexcode",
    "secondary": "#hexcode", 
    "accent": "#hexcode",
    "neutrals": ["#hexcode", "#hexcode"]
  },
  "materials": [
    {"name": "Oak wood", "type": "wood", "finish": "matte"},
    {"name": "Brass", "type": "metal", "finish": "polished"}
  ],
  "styleConfidence": 0.95,
  "analyzedAt": "${new Date().toISOString()}"
}

No markdown, no explanation, JSON only.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: "image/jpeg", data: await fetchImageAsBase64(imageUrl) } }
    ]);

    const response = result.response.text().trim();

    // Extract JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!parsed.colorPalette || !parsed.materials) return null;

    return {
      colorPalette: parsed.colorPalette,
      materials: parsed.materials,
      styleConfidence: parsed.styleConfidence || 0,
      analyzedAt: parsed.analyzedAt || new Date().toISOString()
    };

  } catch (error) {
    // STRICT FALLBACK: Log and return null immediately
    console.error("[AI Enhancement] Analysis failed, returning null:", error);
    return null;
  }
}

/**
 * Batch analyze multiple images
 * Returns metadata only for successful analyses
 */
export async function batchAnalyzeImages(
  images: { id: string; url: string }[],
  roomType: string,
  style: string
): Promise<Map<string, ImageMetadata>> {
  const results = new Map<string, ImageMetadata>();

  // Process sequentially to avoid rate limits
  for (const image of images) {
    try {
      const metadata = await analyzeImageMetadata(image.url, roomType, style);
      if (metadata) {
        results.set(image.id, metadata);
      }
      // Small delay between calls
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      // Skip failed images silently
      console.warn(`[AI Enhancement] Failed to analyze image ${image.id}`);
    }
  }

  return results;
}

/**
 * Fetch image as base64 for Gemini Vision
 */
async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return base64;
  } catch (error) {
    console.error("[AI Enhancement] Failed to fetch image:", error);
    throw error;
  }
}

/**
 * Safe wrapper for any AI enhancement operation
 * Guarantees no exceptions escape and fallback is always returned
 */
export async function safeAIEnhancement<T>(
  operation: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error("[AI Enhancement] Operation failed, using fallback:", error);
    return fallback;
  }
}
