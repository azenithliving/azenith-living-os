/**
 * Natural Language Understanding Engine
 * Makes the agent understand natural Arabic commands like a human
 */

import { routeRequest, getBestModelForTask } from "@/lib/openrouter-service";
import type { IntentName } from "./agent-core";

export interface ParsedIntent {
  name: IntentName;
  confidence: number;
  params: Record<string, unknown>;
  missingParams: string[];
  clarifyingQuestion?: string;
  suggestions: string[];
}

export interface NLUContext {
  recentMessages: string[];
  lastIntent?: IntentName;
  lastParams?: Record<string, unknown>;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
}

/**
 * Parse natural language command using LLM
 */
export async function parseNaturalLanguage(
  message: string,
  context: NLUContext
): Promise<ParsedIntent | null> {
  const prompt = buildNLUPrompt(message, context);

  try {
    const response = await routeRequest({
      modelPreference: getBestModelForTask("intent_detection"),
      prompt,
      systemPrompt: `أنت محلل نوايا ذكي. حلل رسالة المستخدم وحدد:
1. نواياه الحقيقية
2. المعاملات المطلوبة
3. ما هي المعاملات الناقصة
4. ما هو السؤال التوضيحي المناسب

أجب بـ JSON فقط بهذا الشكل:
{
  "intent": "اسم_النية",
  "confidence": 0.9,
  "params": { "param1": "value1" },
  "missingParams": ["param2"],
  "clarifyingQuestion": "سؤال توضيحي للمستخدم",
  "suggestions": ["اقتراح1", "اقتراح2"]
}`,
      temperature: 0.2,
      maxTokens: 800,
    });

    if (!response.success || !response.content) {
      return null;
    }

    return extractIntentFromResponse(response.content);
  } catch (error) {
    console.error("NLU parsing error:", error);
    return null;
  }
}

/**
 * Ask clarifying question when intent is vague
 */
export function generateClarifyingQuestion(
  partialIntent: ParsedIntent,
  originalMessage: string
): string {
  const questions: Record<string, string> = {
    product_create: "عايز تضيف منتج جديد؟ قولي اسمه وسعره",
    product_update: "عايز تحدث منتج معين؟ قولي اسم المنتج",
    product_delete: "عايز تمسح منتج؟ قولي اسمه",
    product_list: "عايز تشوف كل المنتجات؟",
    inventory_update: "عايز تعدل المخزون؟ قولي اسم المنتج والكمية",
    inventory_check: "عايز تفحص المخزون المنخفض؟",
    category_create: "عايز تضيف تصنيف جديد؟",
    seo_audit: "عايز تحليل SEO لأي موقع؟",
    section_create: "عايز تضيف قسم جديد؟ قولي اسمه",
    speed_optimization: "عايز تحليل سرعة الموقع؟",
    backup: "عايز تعمل نسخة احتياطية؟",
    revenue_analysis: "عايز تحليل الإيرادات؟",
    plan: "عايز تخطط لمشروع معين؟ قولي التفاصيل",
  };

  return (
    partialIntent.clarifyingQuestion ||
    questions[partialIntent.name] ||
    "ممكن توضح أكتر عايز تعمل إيه بالظبط؟"
  );
}

/**
 * Extract missing parameters from context or ask user
 */
export async function extractMissingParams(
  intent: IntentName,
  message: string,
  context: NLUContext
): Promise<{ extracted: Record<string, unknown>; stillMissing: string[] }> {
  const requiredParams = getRequiredParams(intent);
  const extracted: Record<string, unknown> = {};
  const stillMissing: string[] = [];

  for (const param of requiredParams) {
    const value = await extractParamFromMessage(param, message, context);
    if (value !== undefined && value !== null) {
      extracted[param] = value;
    } else {
      stillMissing.push(param);
    }
  }

  return { extracted, stillMissing };
}

/**
 * Build context-aware conversation
 */
function buildNLUPrompt(message: string, context: NLUContext): string {
  const recentContext = context.recentMessages.slice(-3).join("\n");

  return `
الرسائل السابقة:
${recentContext}

رسالة المستخدم الحالية: "${message}"

حلل النية وحدد:
1. نواياه (اختر واحدة): product_list, product_create, product_update, product_delete, product_get, category_list, category_create, inventory_update, inventory_check, seo_audit, section_create, backup, speed_optimization, revenue_analysis, plan, status, metrics, anomalies, opportunities
2. المعاملات اللي لقيتها في الرسالة
3. المعاملات الناقصة
4. سؤال توضيحي مناسب

أجب بـ JSON فقط.`;
}

/**
 * Extract intent from LLM response
 */
function extractIntentFromResponse(text: string): ParsedIntent | null {
  try {
    // Find JSON in response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      name: parsed.intent || "general_chat",
      confidence: parsed.confidence || 0.5,
      params: parsed.params || {},
      missingParams: parsed.missingParams || [],
      clarifyingQuestion: parsed.clarifyingQuestion,
      suggestions: parsed.suggestions || [],
    };
  } catch {
    return null;
  }
}

/**
 * Get required parameters for each intent
 */
function getRequiredParams(intent: IntentName): string[] {
  const required: Record<string, string[]> = {
    product_create: ["name", "basePrice"],
    product_update: ["productId"],
    product_delete: ["productId"],
    product_get: ["productId"],
    inventory_update: ["productId", "quantityChange"],
    category_create: ["name"],
    section_create: ["name"],
    seo_audit: ["url"],
    plan: ["objective"],
  };

  return required[intent] || [];
}

/**
 * Extract specific parameter from message using LLM
 */
async function extractParamFromMessage(
  param: string,
  message: string,
  context: NLUContext
): Promise<unknown> {
  const extractors: Record<string, () => Promise<unknown> | unknown> = {
    name: () => extractName(message),
    basePrice: () => extractPrice(message),
    productId: () => extractProductId(message, context),
    quantityChange: () => extractQuantity(message),
    categoryId: () => extractCategoryId(message, context),
    url: () => extractUrl(message),
  };

  const extractor = extractors[param];
  if (extractor) {
    return await extractor();
  }

  return undefined;
}

/**
 * Extract name from message (text in quotes or after keywords)
 */
function extractName(message: string): string | undefined {
  // Try quoted text first
  const quoted = message.match(/["']([^"']+)["']/);
  if (quoted) return quoted[1];

  // Try after keywords
  const patterns = [
    /(?:منتج|اسم|سموه)\s+(?:جديد|اسمه|اسم)\s*["']?([^"'\d]+?)(?:\s+\d|$|\s+بسعر)/i,
    /(?:تصنيف|فئة|قسم)\s+(?:جديد|اسمه|اسم)\s*["']?([^"'\d]+?)(?:\s|$)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1].trim();
  }

  return undefined;
}

/**
 * Extract price from message
 */
function extractPrice(message: string): number | undefined {
  const patterns = [
    /(?:بسعر|سعر|ب|price)\s+(\d+)/i,
    /(\d+)\s*(?:جنيه|جنيها|ريال|دولار|EGP|SAR|USD)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return parseInt(match[1]);
  }

  // Find any number after name
  const nameMatch = message.match(/["']([^"']+)["'].*?\D(\d{3,})/);
  if (nameMatch) return parseInt(nameMatch[2]);

  return undefined;
}

/**
 * Extract product ID from message or context
 */
function extractProductId(
  message: string,
  context: NLUContext
): string | undefined {
  // Try UUID pattern
  const uuidMatch = message.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  if (uuidMatch) return uuidMatch[0];

  // Try product name from context
  if (context.lastParams?.name) {
    return context.lastParams.name as string;
  }

  return undefined;
}

/**
 * Extract quantity change from message
 */
function extractQuantity(message: string): number | undefined {
  const patterns = [
    /(?:كمية|quantity|عدد|زيادة|نقص)\s+(\d+)/i,
    /(\d+)\s*(?:قطعة|وحدة|items?|units?)/i,
    /(?:ب|by)\s*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return parseInt(match[1]);
  }

  // Check for increase/decrease keywords
  const increaseMatch = message.match(/(?:زيادة|إضافة|زود)\s+(\d+)/i);
  if (increaseMatch) return parseInt(increaseMatch[1]);

  const decreaseMatch = message.match(/(?:نقص|خصم|إزالة)\s+(\d+)/i);
  if (decreaseMatch) return -parseInt(decreaseMatch[1]);

  return undefined;
}

/**
 * Extract category ID from message
 */
function extractCategoryId(
  message: string,
  context: NLUContext
): string | undefined {
  // Similar to product ID extraction
  const uuidMatch = message.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  if (uuidMatch) return uuidMatch[0];

  return undefined;
}

/**
 * Extract URL from message
 */
function extractUrl(message: string): string | undefined {
  const patterns = [
    /(https?:\/\/[^\s]+)/i,
    /(?:للموقع|للرابط|لـ|for)\s+(?:الموقع\s+)?([^\s]+\.[^\s]+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      let url = match[1];
      if (!url.startsWith("http")) {
        url = "https://" + url;
      }
      return url;
    }
  }

  return undefined;
}

/**
 * Handle follow-up commands based on conversation context
 */
export function handleFollowUp(
  message: string,
  context: NLUContext
): { isFollowUp: boolean; intent?: IntentName; params?: Record<string, unknown> } {
  const lower = message.toLowerCase();

  // Check for affirmative responses
  if (/^(نعم|أيوة|موافق|تمام|yes|ok|okay)$/.test(lower)) {
    if (context.lastIntent) {
      return {
        isFollowUp: true,
        intent: context.lastIntent,
        params: context.lastParams || {},
      };
    }
  }

  // Check for "the one we talked about" references
  if (/(ده|اللي|الذي|المشار إليه|the one)/.test(lower) && context.lastParams) {
    return {
      isFollowUp: true,
      intent: context.lastIntent || "general_chat",
      params: context.lastParams,
    };
  }

  // Check for number-only responses (could be price/quantity)
  if (/^\d+$/.test(lower) && context.lastIntent) {
    const num = parseInt(lower);
    const newParams = { ...context.lastParams };

    // Infer what this number represents
    if (context.lastIntent === "product_create" && !newParams.basePrice) {
      newParams.basePrice = num;
      return { isFollowUp: true, intent: "product_create", params: newParams };
    }
    if (context.lastIntent === "inventory_update" && !newParams.quantityChange) {
      newParams.quantityChange = num;
      return { isFollowUp: true, intent: "inventory_update", params: newParams };
    }
  }

  return { isFollowUp: false };
}
