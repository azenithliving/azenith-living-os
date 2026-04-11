import "server-only";

import { askOpenRouter } from "@/lib/ai-orchestrator";
import { executeWithTimeout, fireAndForget, createBackgroundTask } from "@/lib/background-processor";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

// Default StyleDNA for immediate response
const DEFAULT_STYLE_DNA: StyleDNA = {
  dominantStyles: ["modern-luxury"],
  colorPalette: ["neutral", "gold-accents"],
  materials: ["marble", "wood"],
  moodKeywords: ["elegant", "sophisticated"],
  complexity: "balanced",
};

/**
 * Azenith Semantic PDF Inspiration Engine
 * Analyzes Style DNA and generates personalized concept PDFs
 */

export type StyleDNA = {
  dominantStyles: string[];
  colorPalette: string[];
  materials: string[];
  moodKeywords: string[];
  complexity: "minimal" | "balanced" | "elaborate";
};

export type DesignConcept = {
  id: string;
  title: string;
  description: string;
  styleMatch: number;
  imageUrl: string;
  tags: string[];
};

export type LeadDossier = {
  scope: string;
  budget: string;
  timeline: string;
  blueprintAvailable: boolean;
  specialRequests: string;
  styleDNA: StyleDNA;
  viewedImages: string[];
  userId: string;
  fullName: string;
  phone: string;
  email?: string;
};

/**
 * Core AI analysis function - internal use only
 * Performs the actual AI API call for Style DNA analysis
 */
async function performStyleDNAAnalysis(imageUrls: string[]): Promise<StyleDNA> {
  const prompt = `Analyze these interior design images and extract the "Style DNA":

Viewed Images: ${imageUrls.slice(0, 5).join(", ")}

Provide a JSON analysis with:
- dominantStyles: Array of 3-5 design styles (e.g., "modern-luxury", "art-deco", "minimalist")
- colorPalette: Array of 4-6 dominant colors (e.g., "warm-beige", "matte-black", "brushed-gold")
- materials: Array of 4-6 materials (e.g., "carrara-marble", "walnut-wood", "velvet")
- moodKeywords: Array of 5-7 descriptive words (e.g., "serene", "opulent", "airy")
- complexity: "minimal" | "balanced" | "elaborate"

Return ONLY valid JSON, no markdown formatting.`;

  const result = await askOpenRouter(prompt, undefined, {
    model: "anthropic/claude-3.5-sonnet",
    temperature: 0.3,
    maxTokens: 1024,
  });

  if (!result.success) {
    throw new Error(result.error || "AI analysis failed");
  }

  const cleaned = result.content.replace(/```json\n?|```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned);

  return {
    dominantStyles: parsed.dominantStyles || DEFAULT_STYLE_DNA.dominantStyles,
    colorPalette: parsed.colorPalette || DEFAULT_STYLE_DNA.colorPalette,
    materials: parsed.materials || DEFAULT_STYLE_DNA.materials,
    moodKeywords: parsed.moodKeywords || DEFAULT_STYLE_DNA.moodKeywords,
    complexity: parsed.complexity || DEFAULT_STYLE_DNA.complexity,
  };
}

/**
 * Analyze Style DNA from viewed images using Claude 3.5
 * SYNCHRONOUS VERSION - Blocks until complete (may take 5-10s)
 * Use for background processing only
 */
export async function analyzeStyleDNA(imageUrls: string[]): Promise<StyleDNA> {
  if (imageUrls.length === 0) {
    return { ...DEFAULT_STYLE_DNA };
  }

  try {
    return await performStyleDNAAnalysis(imageUrls);
  } catch (error) {
    console.error("[StyleDNA] Analysis failed:", error);
    return { ...DEFAULT_STYLE_DNA };
  }
}

/**
 * Analyze Style DNA with 2-second timeout
 * NON-BLOCKING VERSION - Returns immediately with default or processing status
 * If AI takes >2s, returns default and processes in background
 */
export async function analyzeStyleDNAFast(
  imageUrls: string[],
  options?: {
    userId?: string;
    tenantId?: string;
    onComplete?: (result: StyleDNA) => void;
  }
): Promise<{ styleDNA: StyleDNA; status: "complete" | "processing" }> {
  if (imageUrls.length === 0) {
    return { styleDNA: { ...DEFAULT_STYLE_DNA }, status: "complete" };
  }

  // Try to get result within 2 seconds
  const { result, timedOut, error } = await executeWithTimeout(
    () => performStyleDNAAnalysis(imageUrls),
    2000 // 2 second timeout
  );

  // If completed within timeout, return the result
  if (!timedOut && result) {
    return { styleDNA: result, status: "complete" };
  }

  // If timed out or errored, trigger background processing and return default
  if (timedOut) {
    console.log("[StyleDNA] Analysis timed out (>2s), processing in background...");

    // Fire-and-forget background processing
    fireAndForget(async () => {
      try {
        const backgroundResult = await performStyleDNAAnalysis(imageUrls);

        // Store result for later retrieval
        const supabase = getSupabaseAdminClient();
        if (supabase && options?.userId) {
          await supabase.from("events").insert({
            id: crypto.randomUUID(),
            company_id: options.tenantId || "system",
            user_id: options.userId,
            type: "style_dna_completed",
            value: "completed",
            metadata: {
              styleDNA: backgroundResult,
              imageCount: imageUrls.length,
            },
          });
        }

        // Call completion callback if provided
        if (options?.onComplete) {
          options.onComplete(backgroundResult);
        }

        console.log("[StyleDNA] Background analysis completed");
      } catch (bgError) {
        console.error("[StyleDNA] Background analysis failed:", bgError);
      }
    });
  }

  // Return default DNA immediately (non-blocking)
  return { styleDNA: { ...DEFAULT_STYLE_DNA }, status: "processing" };
}

/**
 * Query database for top 5 relevant design concepts matching Style DNA
 */
export async function findSimilarDesigns(
  styleDNA: StyleDNA,
  scope: string,
  excludeImageIds: string[]
): Promise<DesignConcept[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase not initialized');

  // Build search terms from Style DNA
  const searchTerms = [
    ...styleDNA.dominantStyles,
    ...styleDNA.moodKeywords,
    scope.toLowerCase(),
  ].join("|");

  // Query for designs matching the style DNA
  const { data, error } = await supabase
    .from("media_items")
    .select("id, title, description, url, tags, style, room_type")
    .neq("id", excludeImageIds)
    .or(`style.ilike.%${searchTerms}%,tags.ilike.%${searchTerms}%`)
    .eq("room_type", scope.toLowerCase())
    .limit(10);

  if (error || !data) {
    console.error("[FindDesigns] Query failed:", error);
    return [];
  }

  // Score and rank designs by Style DNA match
  const scored = data.map((item: { id: string; title: string | null; description: string | null; url: string; tags: string[] | null; style: string | null }) => {
    let score = 0;
    const itemTags = (item.tags || []).map((t: string) => t.toLowerCase());
    const itemStyle = (item.style || "").toLowerCase();

    // Score based on style matches
    styleDNA.dominantStyles.forEach((style) => {
      if (itemStyle.includes(style.toLowerCase())) score += 10;
      if (itemTags.some((tag: string) => tag.includes(style.toLowerCase()))) score += 5;
    });

    // Score based on mood keywords
    styleDNA.moodKeywords.forEach((mood) => {
      if (itemTags.some((tag: string) => tag.includes(mood.toLowerCase()))) score += 3;
    });

    return {
      id: item.id,
      title: item.title || "Design Concept",
      description: item.description || "",
      styleMatch: score,
      imageUrl: item.url,
      tags: item.tags || [],
    };
  });

  // Return top 5 by score
  return scored
    .sort((a: DesignConcept, b: DesignConcept) => b.styleMatch - a.styleMatch)
    .slice(0, 5);
}

/**
 * Generate PDF content using Claude 3.5
 */
export async function generatePDFContent(
  dossier: LeadDossier,
  concepts: DesignConcept[]
): Promise<string> {
  const prompt = `Create a luxury interior design proposal titled "Azenith Design Concepts: Personalized for Your Vision"

CLIENT BRIEF:
- Scope: ${dossier.scope}
- Budget: ${dossier.budget} EGP
- Timeline: ${dossier.timeline}
- Blueprint Available: ${dossier.blueprintAvailable ? "Yes" : "No"}
- Special Requests: ${dossier.specialRequests || "None specified"}

STYLE DNA ANALYSIS:
- Dominant Styles: ${dossier.styleDNA.dominantStyles.join(", ")}
- Color Palette: ${dossier.styleDNA.colorPalette.join(", ")}
- Materials: ${dossier.styleDNA.materials.join(", ")}
- Mood: ${dossier.styleDNA.moodKeywords.join(", ")}
- Complexity: ${dossier.styleDNA.complexity}

RECOMMENDED CONCEPTS:
${concepts.map((c, i) => `${i + 1}. ${c.title} - ${c.description} (${c.styleMatch}% match)`).join("\n")}

Generate professional HTML content for a PDF document:
1. Cover page with title and client name
2. Executive summary of the brief
3. Style DNA visualization section
4. 5 concept recommendations with descriptions
5. Next steps and consultation invitation

Use elegant typography, gold accents, and professional luxury aesthetic. Include inline styles for PDF generation.

Return ONLY the HTML content, no markdown.`;

  const result = await askOpenRouter(prompt, undefined, {
    model: "anthropic/claude-3.5-sonnet",
    temperature: 0.4,
    maxTokens: 4096,
  });

  if (!result.success) {
    console.error("[PDF] Generation failed:", result.error);
    return generateFallbackPDF(dossier, concepts);
  }

  return result.content.replace(/```html\n?|```\n?/g, "").trim();
}

/**
 * Generate fallback PDF content if AI fails
 */
function generateFallbackPDF(dossier: LeadDossier, concepts: DesignConcept[]): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Azenith Design Concepts</title>
  <style>
    body { font-family: 'Georgia', serif; margin: 0; padding: 40px; color: #1a1a1a; }
    .header { text-align: center; border-bottom: 3px solid #c9a961; padding-bottom: 30px; margin-bottom: 40px; }
    .logo { font-size: 28px; letter-spacing: 8px; color: #c9a961; margin-bottom: 10px; }
    .title { font-size: 42px; font-weight: 300; margin: 0; color: #1a1a1a; }
    .subtitle { font-size: 18px; color: #666; margin-top: 10px; }
    .section { margin: 40px 0; }
    .section-title { font-size: 24px; color: #c9a961; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px; margin-bottom: 20px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .info-item { background: #f9f9f9; padding: 20px; border-radius: 8px; }
    .label { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #999; margin-bottom: 8px; }
    .value { font-size: 18px; font-weight: 500; }
    .concept { margin: 30px 0; padding: 25px; background: #fafafa; border-left: 4px solid #c9a961; }
    .concept-title { font-size: 20px; margin-bottom: 10px; }
    .match-badge { display: inline-block; background: #c9a961; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-left: 10px; }
    .footer { margin-top: 60px; text-align: center; color: #999; font-size: 14px; border-top: 1px solid #e0e0e0; padding-top: 30px; }
    .dna-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .dna-item { padding: 15px; background: #f5f5f5; border-radius: 6px; }
    .dna-label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px; }
    .dna-value { font-size: 16px; margin-top: 5px; color: #333; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">AZENITH</div>
    <h1 class="title">Design Concepts</h1>
    <p class="subtitle">Personalized for Your Vision</p>
  </div>

  <div class="section">
    <h2 class="section-title">Client Brief</h2>
    <div class="info-grid">
      <div class="info-item">
        <div class="label">Project Scope</div>
        <div class="value">${dossier.scope}</div>
      </div>
      <div class="info-item">
        <div class="label">Investment Range</div>
        <div class="value">${dossier.budget} EGP</div>
      </div>
      <div class="info-item">
        <div class="label">Timeline</div>
        <div class="value">${dossier.timeline}</div>
      </div>
      <div class="info-item">
        <div class="label">Blueprint</div>
        <div class="value">${dossier.blueprintAvailable ? "Available" : "To be created"}</div>
      </div>
    </div>
    ${dossier.specialRequests ? `
    <div style="margin-top: 20px; padding: 20px; background: #f9f9f9; border-radius: 8px;">
      <div class="label">Special Requests</div>
      <div style="margin-top: 8px; font-size: 16px; line-height: 1.6;">${dossier.specialRequests}</div>
    </div>
    ` : ""}
  </div>

  <div class="section">
    <h2 class="section-title">Style DNA Analysis</h2>
    <div class="dna-grid">
      <div class="dna-item">
        <div class="dna-label">Dominant Styles</div>
        <div class="dna-value">${dossier.styleDNA.dominantStyles.join(", ")}</div>
      </div>
      <div class="dna-item">
        <div class="dna-label">Color Palette</div>
        <div class="dna-value">${dossier.styleDNA.colorPalette.join(", ")}</div>
      </div>
      <div class="dna-item">
        <div class="dna-label">Materials</div>
        <div class="dna-value">${dossier.styleDNA.materials.join(", ")}</div>
      </div>
      <div class="dna-item">
        <div class="dna-label">Mood</div>
        <div class="dna-value">${dossier.styleDNA.moodKeywords.join(", ")}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Recommended Concepts</h2>
    ${concepts.map((c, i) => `
    <div class="concept">
      <div class="concept-title">${i + 1}. ${c.title} <span class="match-badge">${c.styleMatch}% Match</span></div>
      <p>${c.description}</p>
    </div>
    `).join("")}
  </div>

  <div class="footer">
    <p>Azenith Living | Premium Interior Design</p>
    <p>This document was generated by our AI Design Intelligence system</p>
  </div>
</body>
</html>
  `;
}

/**
 * Main function to generate personalized PDF for a lead
 */
export async function generateLeadPDF(
  dossier: LeadDossier
): Promise<{ success: boolean; html: string; concepts: DesignConcept[]; error?: string }> {
  try {
    // Find similar designs based on Style DNA
    const concepts = await findSimilarDesigns(
      dossier.styleDNA,
      dossier.scope,
      dossier.viewedImages
    );

    // Generate PDF content
    const html = await generatePDFContent(dossier, concepts);

    return {
      success: true,
      html,
      concepts,
    };
  } catch (error) {
    console.error("[GenerateLeadPDF] Failed:", error);
    return {
      success: false,
      html: "",
      concepts: [],
      error: error instanceof Error ? error.message : "PDF generation failed",
    };
  }
}
