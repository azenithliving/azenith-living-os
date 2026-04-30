/**
 * Neural Analytics: Gemini-powered user insight generation
 * Analyzes user interactions to reveal hidden tastes and personality
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { PsychologicalProfile } from "@/stores/useSessionStore";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

export interface UserInsight {
  summary: string;
  personalityTraits: string[];
  designPreferences: {
    materials: string[];
    colors: string[];
    rooms: string[];
  };
  confidence: number;
}

/**
 * Generate psychological insight from user interactions
 * Uses Gemini to analyze the psychological profile and provide a summary
 */
export async function generateUserInsight(
  profile: PsychologicalProfile
): Promise<UserInsight> {
  try {
    // Build interaction summary for Gemini
    const interactionSummary = profile.interactedImages.map((img) => ({
      imageId: img.id,
      type: img.interactionType,
      timestamp: new Date(img.timestamp).toISOString(),
      colors: img.metadata?.colorPalette || [],
      materials: img.metadata?.materials || [],
      roomType: img.metadata?.roomType || "unknown",
    }));

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `Act as a high-end Interior Design Psychologist. Analyze these user interactions and provide a 2-paragraph summary of their hidden tastes, personality, and what they are truly looking for in their dream home.

User Interaction Data:
${JSON.stringify(interactionSummary, null, 2)}

Psychological Profile Summary:
- Total Engagement Score: ${profile.interactionScores.total}
- Hover Interactions (Interest): ${profile.interactionScores.hoverScore}
- Modal Views (Engagement): ${profile.interactionScores.modalScore}
- Downloads (Commitment): ${profile.interactionScores.downloadScore}
- Preferred Materials: ${profile.preferredMaterials.join(", ") || "Analyzing..."}
- Color Preferences: ${profile.colorPsychology.dominant.join(", ") || "Analyzing..."}
- Spatial Focus: Kitchens(${profile.spatialFocus.kitchens}), Bedrooms(${profile.spatialFocus.bedrooms}), Living Rooms(${profile.spatialFocus.livingRooms})

Provide your analysis in 2 paragraphs:
1. First paragraph: Their personality type, emotional needs, and lifestyle indicators
2. Second paragraph: Specific design recommendations and what their dream home looks like

Be insightful, professional, and slightly poetic. Use Arabic if the user seems Arabic-speaking based on interaction context.`;

    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    return {
      summary,
      personalityTraits: extractTraits(summary),
      designPreferences: {
        materials: profile.preferredMaterials,
        colors: profile.colorPsychology.dominant,
        rooms: getTopRooms(profile.spatialFocus),
      },
      confidence: Math.min(profile.interactionScores.total / 50, 0.95),
    };
  } catch (error) {
    console.error("[Neural Analytics] Failed to generate insight:", error);
    return {
      summary: "We're still learning about your unique style. Continue exploring to reveal your design DNA.",
      personalityTraits: ["Exploring"],
      designPreferences: {
        materials: [],
        colors: [],
        rooms: [],
      },
      confidence: 0.1,
    };
  }
}

// Helper: Extract personality traits from summary
function extractTraits(summary: string): string[] {
  const traitKeywords = [
    "minimalist", "luxurious", "cozy", "modern", "traditional",
    "artistic", "organized", "practical", "dreamer", "sophisticated",
    "warm", "elegant", "bold", "refined", "natural"
  ];
  
  const found = traitKeywords.filter(trait => 
    summary.toLowerCase().includes(trait)
  );
  
  return found.length > 0 ? found : ["Discovering"];
}

// Helper: Get top room preferences
function getTopRooms(spatialFocus: PsychologicalProfile["spatialFocus"]): string[] {
  const rooms = [
    { name: "Kitchens", score: spatialFocus.kitchens },
    { name: "Bedrooms", score: spatialFocus.bedrooms },
    { name: "Living Rooms", score: spatialFocus.livingRooms },
    { name: "Bathrooms", score: spatialFocus.bathrooms },
    { name: "Dressing Rooms", score: spatialFocus.dressingRooms },
  ];
  
  return rooms
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(r => r.name);
}
