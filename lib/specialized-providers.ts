/**
 * Specialized Provider Integrations
 * Each provider has a dedicated use case with graceful degradation
 * If no keys available → returns null → caller uses fallback
 */

import { getKeyStats } from "@/lib/api-keys-service";
import {
  askCerebrasMessages,
  askCohereMessages,
  askTogetherMessages,
  askGoogleMessages,
  askGroqMessages,
} from "@/lib/ai-orchestrator";

/**
 * CEREBRAS - Ultra-fast response engine
 * Use case: Quick, short responses (< 150 tokens) for simple queries
 * Fallback: Returns null → caller uses Groq/default
 */
export async function tryFastResponse(
  prompt: string
): Promise<string | null> {
  try {
    const stats = await getKeyStats("cerebras");
    if (stats.active === 0) {
      console.log("[Cerebras] No active keys, skipping fast response");
      return null;
    }

    console.log("[Cerebras] Attempting ultra-fast response...");
    const result = await askCerebrasMessages(
      [{ role: "user", content: prompt }],
      { 
        maxTokens: 150, 
        model: "llama3.1-8b",
        temperature: 0.7 
      }
    );

    if (result.success && result.content) {
      console.log("[Cerebras] ✅ Fast response delivered");
      return result.content;
    }

    return null;
  } catch (error: any) {
    console.error("[Cerebras] Error:", error.message);
    return null;
  }
}

/**
 * COHERE - Intent classification and lead scoring
 * Use case: Analyze conversation to detect buyer intent and urgency
 * Fallback: Returns null → system continues without enhanced scoring
 */
export async function classifyIntent(
  conversation: string
): Promise<{
  intent: "buyer" | "browser" | "price_checker" | "curious" | "serious";
  confidence: number;
  urgency: "low" | "medium" | "high";
  suggestedAction: string;
} | null> {
  try {
    const stats = await getKeyStats("cohere");
    if (stats.active === 0) {
      console.log("[Cohere] No active keys, skipping intent classification");
      return null;
    }

    const prompt = `أنت محلل نوايا عملاء محترف. حلل المحادثة التالية واستخرج:
1. النية الحقيقية (buyer/browser/price_checker/curious/serious)
2. مستوى الثقة (0-100)
3. درجة الإلحاح (low/medium/high)
4. الإجراء المقترح

المحادثة:
${conversation.slice(-2000)}

أجب بصيغة JSON فقط:
{
  "intent": "buyer",
  "confidence": 85,
  "urgency": "high",
  "suggestedAction": "عرض خصم فوري"
}`;

    console.log("[Cohere] Analyzing customer intent...");
    const result = await askCohereMessages(
      [{ role: "user", content: prompt }],
      { maxTokens: 200, temperature: 0.3 }
    );

    if (result.success && result.content) {
      try {
        const parsed = JSON.parse(
          result.content.match(/\{[\s\S]*\}/)?.[0] || "{}"
        );
        console.log("[Cohere] ✅ Intent classified:", parsed.intent);
        return {
          intent: parsed.intent || "curious",
          confidence: parsed.confidence || 50,
          urgency: parsed.urgency || "medium",
          suggestedAction: parsed.suggestedAction || "متابعة عادية",
        };
      } catch {
        return null;
      }
    }

    return null;
  } catch (error: any) {
    console.error("[Cohere] Error:", error.message);
    return null;
  }
}

/**
 * TOGETHER AI - Long-form content generation
 * Use case: Generate detailed reports, proposals, or long documents (2000+ tokens)
 * Fallback: Uses Groq with reduced maxTokens
 */
export async function generateLongReport(
  prompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  try {
    const stats = await getKeyStats("together");
    if (stats.active === 0) {
      console.log("[Together] No active keys, falling back to Groq");
      const fallback = await askGroqMessages(
        [{ role: "user", content: prompt }],
        { maxTokens: 2048, temperature: options?.temperature || 0.7 }
      );
      return fallback.content || "";
    }

    console.log("[Together] Generating long-form content...");
    const result = await askTogetherMessages(
      [{ role: "user", content: prompt }],
      {
        maxTokens: options?.maxTokens || 4000,
        temperature: options?.temperature || 0.7,
        model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
      }
    );

    if (result.success && result.content) {
      console.log("[Together] ✅ Long report generated");
      return result.content;
    }

    // Fallback to Groq
    console.log("[Together] Failed, falling back to Groq");
    const fallback = await askGroqMessages(
      [{ role: "user", content: prompt }],
      { maxTokens: 2048, temperature: options?.temperature || 0.7 }
    );
    return fallback.content || "";
    
  } catch (error: any) {
    console.error("[Together] Error:", error.message);
    // Final fallback
    const fallback = await askGroqMessages(
      [{ role: "user", content: prompt }],
      { maxTokens: 2048 }
    );
    return fallback.content || "";
  }
}

/**
 * GOOGLE GEMINI - Vision analysis for interior spaces
 * Use case: Analyze uploaded space images to extract style, colors, dimensions
 * Fallback: Returns null → Style DNA continues without image analysis
 */
export async function analyzeSpaceImage(
  imageUrl: string,
  analysisType: "style" | "colors" | "dimensions" | "full" = "full"
): Promise<{
  dominantColors?: string[];
  existingStyle?: string;
  spaceSize?: "small" | "medium" | "large";
  suggestions?: string[];
  lighting?: "natural" | "artificial" | "mixed";
  furniture?: string[];
} | null> {
  try {
    const stats = await getKeyStats("google");
    if (stats.active === 0) {
      console.log("[Google Vision] No active keys, skipping image analysis");
      return null;
    }

    const prompts = {
      style: "حدد النمط المعماري والتصميمي الحالي للمساحة",
      colors: "استخرج الألوان السائدة في المساحة",
      dimensions: "قدر حجم المساحة (صغير/متوسط/كبير)",
      full: `حلل هذه المساحة الداخلية بالتفصيل واستخرج:
1. الألوان السائدة
2. النمط الحالي
3. حجم المساحة
4. نوع الإضاءة
5. الأثاث الموجود
6. اقتراحات التحسين

أجب بصيغة JSON فقط.`,
    };

    console.log(`[Google Vision] Analyzing space image (${analysisType})...`);
    const result = await askGoogleMessages(
      [
        {
          role: "user",
          content: `${prompts[analysisType]}\n\nImage: ${imageUrl}`,
        },
      ],
      { 
        maxTokens: 500,
        model: "gemini-1.5-flash",
        temperature: 0.3 
      }
    );

    if (result.success && result.content) {
      try {
        const parsed = JSON.parse(
          result.content.match(/\{[\s\S]*\}/)?.[0] || "{}"
        );
        console.log("[Google Vision] ✅ Image analyzed successfully");
        return {
          dominantColors: parsed.dominantColors || parsed.colors || [],
          existingStyle: parsed.existingStyle || parsed.style || "غير محدد",
          spaceSize: parsed.spaceSize || parsed.size || "medium",
          suggestions: parsed.suggestions || [],
          lighting: parsed.lighting || "mixed",
          furniture: parsed.furniture || [],
        };
      } catch {
        console.log("[Google Vision] JSON parse failed, returning raw analysis");
        return {
          existingStyle: result.content.slice(0, 100),
          suggestions: [result.content],
        };
      }
    }

    return null;
  } catch (error: any) {
    console.error("[Google Vision] Error:", error.message);
    return null;
  }
}

/**
 * Health check for specialized providers
 */
export async function getSpecializedProvidersHealth() {
  const [cerebras, cohere, together, google] = await Promise.all([
    getKeyStats("cerebras"),
    getKeyStats("cohere"),
    getKeyStats("together"),
    getKeyStats("google"),
  ]);

  return {
    cerebras: {
      available: cerebras.active > 0,
      keys: cerebras.total,
      active: cerebras.active,
      feature: "Ultra-fast responses",
    },
    cohere: {
      available: cohere.active > 0,
      keys: cohere.total,
      active: cohere.active,
      feature: "Intent classification",
    },
    together: {
      available: together.active > 0,
      keys: together.total,
      active: together.active,
      feature: "Long-form generation",
    },
    google: {
      available: google.active > 0,
      keys: google.total,
      active: google.active,
      feature: "Vision analysis",
    },
  };
}
