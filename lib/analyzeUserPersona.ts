"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { UserProfile, UserPersona, BehavioralReport } from "@/stores/useSessionStore";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface SessionProfile {
  userProfile: UserProfile;
  userPersona: UserPersona;
  behavioralReport: BehavioralReport | null;
  leadScore: number;
  roomIntent: string[];
  intent: string;
  styleSwitches: number;
}

interface AIAnalysisResult {
  preferredStyle: string;
  estimatedBudget: string;
  intent: string;
  focusedFurniture: string[];
  summary: string;
  arabicSummary: string;
}

/**
 * Analyze user behavioral data using Gemini API
 * Called when user triggers "WhatsApp Contact" or "Form Submit"
 */
export async function analyzeUserPersona(
  sessionProfile: SessionProfile,
  userPhone?: string
): Promise<AIAnalysisResult | null> {
  // Check if Gemini API key is configured
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[AI Analysis] Gemini API key not configured");
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    // Build comprehensive prompt with all behavioral data
    const prompt = buildAnalysisPrompt(sessionProfile, userPhone);

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse the AI response
    return parseAIResponse(text, sessionProfile);
  } catch (error) {
    console.error("[AI Analysis] Failed to analyze user persona:", error);
    return null;
  }
}

/**
 * Build the analysis prompt for Gemini
 */
function buildAnalysisPrompt(
  sessionProfile: SessionProfile,
  userPhone?: string
): string {
  const { userProfile, userPersona, behavioralReport, leadScore, roomIntent, intent, styleSwitches } = sessionProfile;

  const dataSummary = `
## User Behavioral Data Summary

**Basic Profile:**
- Phone: ${userPhone || "Not provided"}
- Preferred Style: ${userPersona.preferredStyle || "Unknown"}
- Interest Level: ${userPersona.interestLevel}
- Certainty: ${userPersona.certainty}
- Focus Quality: ${userPersona.focusQuality || "Unknown"}

**Intent Data:**
- Lead Score: ${leadScore}/100
- Intent Classification: ${intent}
- Style Switches: ${styleSwitches} (indicates comparison behavior)

**Room Engagement:**
- Rooms Viewed: ${roomIntent.length} (${roomIntent.join(", ") || "None tracked"})

**Behavioral Report:**
${behavioralReport ? `
- Total Focus Time: ${Math.floor(behavioralReport.totalFocusTime / 60000)} minutes
- Weighted Engagement Score: ${behavioralReport.weightedScore}
- Top Interest: ${behavioralReport.topInterest || "Unknown"}
- Certainty Level: ${behavioralReport.certainty}
- Style Affinity: ${Object.entries(behavioralReport.styleAffinity).map(([k, v]) => `${k}(${v})`).join(", ") || "None"}
- Room Engagement Time: ${Object.entries(behavioralReport.roomEngagement).map(([k, v]) => `${k}: ${v}s`).join(", ") || "None"}

**Behavior Summary:**
${behavioralReport.behaviorSummary}
` : "No detailed behavioral report available"}

**Style Preferences from Profile:**
${userProfile.stylePreferences ? Object.entries(userProfile.stylePreferences).map(([style, data]: [string, unknown]) => {
  const pref = data as { roomCount: number; totalTimeSpent: number; lastViewedAt: number };
  return `- ${style}: ${pref.roomCount} rooms viewed`;
}).join("\n") : "No style preferences tracked"}
`;

  return `${dataSummary}

## Instructions

You are an expert luxury real estate sales analyst. Analyze this visitor's behavioral data and provide insights in ARABIC.

Please analyze and provide:

1. **Preferred Style** (المفضل): Based on room engagement patterns, which interior design style resonates most with this visitor?

2. **Estimated Budget/Intent Level** (الميزانية/النية): 
   - If lead score > 70: "High intent - likely premium budget"
   - If lead score 30-70: "Moderate intent - exploring options"
   - If lead score < 30: "Early research phase"

3. **Focused Furniture/Rooms** (الاهتمامات): Which specific rooms or furniture types did they spend the most time viewing?

4. **Psychological Profile** (الملف النفسي): One paragraph describing their personality type, decision-making style, and what motivates them.

5. **Sales Recommendation** (التوصية): How should the sales team approach this lead?

Format your response in this JSON structure:
{
  "preferredStyle": "...",
  "estimatedBudget": "...",
  "intent": "...",
  "focusedFurniture": ["room1", "room2"],
  "summary": "English summary for admin dashboard",
  "arabicSummary": "الملخص بالعربي للوحة التحكم"
}

Ensure the Arabic summary is professional and suitable for display in an admin dashboard next to the client's phone number.`;
}

/**
 * Parse AI response into structured format
 */
function parseAIResponse(
  text: string,
  sessionProfile: SessionProfile
): AIAnalysisResult {
  // Default fallback values
  const fallback: AIAnalysisResult = {
    preferredStyle: sessionProfile.userPersona.preferredStyle || "Modern",
    estimatedBudget: sessionProfile.leadScore > 50 ? "Premium" : "Standard",
    intent: sessionProfile.userPersona.interestLevel,
    focusedFurniture: sessionProfile.roomIntent.slice(0, 3),
    summary: generateFallbackSummary(sessionProfile),
    arabicSummary: generateFallbackArabicSummary(sessionProfile),
  };

  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        preferredStyle: parsed.preferredStyle || fallback.preferredStyle,
        estimatedBudget: parsed.estimatedBudget || fallback.estimatedBudget,
        intent: parsed.intent || fallback.intent,
        focusedFurniture: parsed.focusedFurniture || fallback.focusedFurniture,
        summary: parsed.summary || fallback.summary,
        arabicSummary: parsed.arabicSummary || fallback.arabicSummary,
      };
    }
  } catch (e) {
    console.warn("[AI Analysis] Failed to parse AI response as JSON:", e);
  }

  // Fallback: Extract insights from plain text
  return extractInsightsFromText(text, fallback);
}

/**
 * Extract insights from plain text response
 */
function extractInsightsFromText(
  text: string,
  fallback: AIAnalysisResult
): AIAnalysisResult {
  const result = { ...fallback };

  // Try to find preferred style
  const styleMatch = text.match(/(?:style|نمط|أسلوب)[\s\:]*(\w+)/i);
  if (styleMatch) {
    result.preferredStyle = styleMatch[1];
  }

  // Try to find budget
  const budgetMatch = text.match(/(?:budget|ميزانية|سعر)[\s\:]*([^\n]+)/i);
  if (budgetMatch) {
    result.estimatedBudget = budgetMatch[1].trim();
  }

  // Extract any Arabic text for the summary
  const arabicMatch = text.match(/[\u0600-\u06FF][^\n]+/g);
  if (arabicMatch && arabicMatch.length > 0) {
    result.arabicSummary = arabicMatch.slice(0, 2).join(". ");
  }

  return result;
}

/**
 * Generate fallback summary when AI fails
 */
function generateFallbackSummary(sessionProfile: SessionProfile): string {
  const { userPersona, leadScore, roomIntent, behavioralReport } = sessionProfile;
  
  return `Lead with ${userPersona.interestLevel} interest (Score: ${leadScore}). ` +
    `Viewed ${roomIntent.length} rooms. ` +
    `Top focus: ${behavioralReport?.topInterest || "Unknown"}. ` +
    `Certainty: ${userPersona.certainty}.`;
}

/**
 * Generate fallback Arabic summary
 */
function generateFallbackArabicSummary(sessionProfile: SessionProfile): string {
  const { userPersona, leadScore, roomIntent } = sessionProfile;
  
  const interestLevel = userPersona.interestLevel === "Strong" 
    ? "اهتمام قوي" 
    : userPersona.interestLevel === "Moderate" 
      ? "اهتمام متوسط" 
      : "اهتمام مبدئي";
  
  return `عميل ب${interestLevel} (النتيجة: ${leadScore}). ` +
    `شاهد ${roomIntent.length} غرف. ` +
    `مستوى اليقين: ${userPersona.certainty === "High" ? "عالي" : userPersona.certainty === "Medium" ? "متوسط" : "منخفض"}.`;
}

/**
 * Store AI analysis result in database for admin dashboard
 */
export async function storeAIAnalysis(
  userId: string,
  analysis: AIAnalysisResult,
  triggerEvent: "whatsapp_contact" | "form_submit"
): Promise<void> {
  // This would typically save to a database table
  // For now, we'll store in localStorage via a client-side action
  console.log(`[AI Analysis] Stored analysis for user ${userId}:`, {
    trigger: triggerEvent,
    analysis,
    timestamp: new Date().toISOString(),
  });
}

export type { SessionProfile, AIAnalysisResult };
