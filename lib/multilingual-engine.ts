"use client";

import { useState } from "react";
import { askOpenRouter } from "@/lib/ai-orchestrator";

/**
 * Multilingual Sovereign Engine
 * Context-aware translation for High-Society Egyptian (AR) and International Luxury (EN)
 */

export type Language = "ar" | "en";

export interface TranslationContext {
  language: Language;
  scope?: string;
  tier?: string;
  userType?: "client" | "admin";
}

// Core UI translations
const UI_TRANSLATIONS: Record<Language, Record<string, string>> = {
  ar: {
    // Header & Navigation
    "nav.home": "الرئيسية",
    "nav.rooms": "المساحات",
    "nav.gallery": "معرض الأعمال",
    "nav.about": "من نحن",
    "nav.contact": "تواصل معنا",
    "nav.eliteBrief": "استشارة تصميم",

    // Elite Form
    "elite.title": "صمم رؤيتك",
    "elite.subtitle": "أكمل نموذج المشروع وسنقوم بإعداد تصميم مخصص لك",
    "elite.scope.title": "اختر نطاق المشروع",
    "elite.scope.kitchen": "المطبخ",
    "elite.scope.bedroom": "غرفة النوم",
    "elite.scope.dressing": "غرفة الملابس",
    "elite.scope.fullUnit": "الوحدة بالكامل",
    "elite.budget.title": "النطاق الاستثماري",
    "elite.timeline.title": "الجدول الزمني",
    "elite.blueprint.title": "هل لديك مخططات؟",
    "elite.blueprint.yes": "نعم، المخططات متوفرة",
    "elite.blueprint.no": "لا، أحتاج استشارة",
    "elite.requests.title": "طلبات خاصة",
    "elite.requests.placeholder": "أخبرنا بتفضيلاتك الخاصة للتصميم...",
    "elite.contact.title": "معلومات التواصل",
    "elite.contact.name": "الاسم الكامل",
    "elite.contact.phone": "رقم الهاتف",
    "elite.contact.email": "البريد الإلكتروني (اختياري)",
    "elite.submit": "إرسال الطلب",
    "elite.success.title": "تم إرسال طلبك بنجاح",
    "elite.success.message": "فريقنا يقوم بتحليل DNA الأسلوب وإعداد باقة التصاميم المخصصة لك",

    // Investment Tiers
    "investment.title": "النطاقات الاستثمارية التقديرية",
    "investment.essential": "أساسي",
    "investment.refined": "راقٍ",
    "investment.bespoke": "حصري",
    "investment.disclaimer": "هذه تقديرات فقط. التكلفة النهائية تعتمد على المواصفات التقنية النهائية",

    // Aesthetic Advisor
    "advisor.title": "المستشار الجمالي",
    "advisor.subtitle": "حمل صور المساحة للحصول على إلهام بصري مخصص",
    "advisor.upload": "اسحب الصور هنا أو انقر للاستعراض",
    "advisor.analyze": "تحليل الصور",
    "advisor.skip": "تخطي هذه الخطوة",
    "advisor.visualHarmony": "التوازن البصري",
    "advisor.space": "تحسين المساحة",
    "advisor.style": "توجيه الأسلوب",
    "advisor.survey": "طلب معاينة تقنية",

    // Office Hours
    "hours.open": "فريق الاستشارات متاح حتى الساعة 6 مساءً",
    "hours.closed": "فريق الاستشارات يستعد للإبداع. نراجع طلبك عند الساعة 10 صباحاً",
    "hours.friday": "يوم الجمعة إجازة. نعود للعمل السبت الساعة 10 صباحاً",

    // Diamond Lead
    "diamond.detected": "تم اكتشاف عميل مميز",
    "diamond.priority": "أولوية عالية",
    "diamond.score": "الدرجة",

    // Common
    "common.continue": "متابعة",
    "common.back": "رجوع",
    "common.close": "إغلاق",
    "common.loading": "جاري التحميل...",
    "common.error": "حدث خطأ",
    "common.success": "تم بنجاح",
  },
  en: {
    // Header & Navigation
    "nav.home": "Home",
    "nav.rooms": "Spaces",
    "nav.gallery": "Portfolio",
    "nav.about": "About",
    "nav.contact": "Contact",
    "nav.eliteBrief": "Design Consultation",

    // Elite Form
    "elite.title": "Design Your Vision",
    "elite.subtitle": "Complete the project brief and we'll craft a personalized design concept",
    "elite.scope.title": "Select Project Scope",
    "elite.scope.kitchen": "Kitchen",
    "elite.scope.bedroom": "Bedroom",
    "elite.scope.dressing": "Dressing Room",
    "elite.scope.fullUnit": "Full Unit",
    "elite.budget.title": "Investment Range",
    "elite.timeline.title": "Project Timeline",
    "elite.blueprint.title": "Do you have architectural plans?",
    "elite.blueprint.yes": "Yes, plans available",
    "elite.blueprint.no": "No, need consultation",
    "elite.requests.title": "Special Requests",
    "elite.requests.placeholder": "Tell us about your specific design preferences...",
    "elite.contact.title": "Contact Information",
    "elite.contact.name": "Full Name",
    "elite.contact.phone": "Phone Number",
    "elite.contact.email": "Email (optional)",
    "elite.submit": "Submit Brief",
    "elite.success.title": "Brief Submitted Successfully",
    "elite.success.message": "Our team is analyzing your Style DNA and preparing your personalized concept portfolio",

    // Investment Tiers
    "investment.title": "Estimated Investment Ranges",
    "investment.essential": "Essential",
    "investment.refined": "Refined",
    "investment.bespoke": "Bespoke",
    "investment.disclaimer": "These are estimates only. Final investment depends on technical specifications",

    // Aesthetic Advisor
    "advisor.title": "Aesthetic Advisor",
    "advisor.subtitle": "Upload space photos for personalized visual inspiration",
    "advisor.upload": "Drop images here or click to browse",
    "advisor.analyze": "Analyze Images",
    "advisor.skip": "Skip This Step",
    "advisor.visualHarmony": "Visual Harmony",
    "advisor.space": "Space Optimization",
    "advisor.style": "Style Direction",
    "advisor.survey": "Request Technical Survey",

    // Office Hours
    "hours.open": "Our consultants are available until 6 PM",
    "hours.closed": "Our consultants are preparing masterpieces. We review your brief at 10 AM",
    "hours.friday": "Friday is a holiday. We return Saturday at 10 AM",

    // Diamond Lead
    "diamond.detected": "Diamond Lead Detected",
    "diamond.priority": "High Priority",
    "diamond.score": "Score",

    // Common
    "common.continue": "Continue",
    "common.back": "Back",
    "common.close": "Close",
    "common.loading": "Loading...",
    "common.error": "An error occurred",
    "common.success": "Success",
  },
};

/**
 * Get UI translation
 */
export function getTranslation(key: string, lang: Language = "en"): string {
  return UI_TRANSLATIONS[lang][key] || UI_TRANSLATIONS["en"][key] || key;
}

/**
 * Context-aware luxury translation using Claude
 * - Arabic: High-Society Egyptian Business Tone
 * - English: International Luxury
 */
export async function translateWithContext(
  text: string,
  targetLang: Language,
  context?: Partial<TranslationContext>
): Promise<string> {
  if (!text.trim()) return "";

  const prompt = targetLang === "ar"
    ? `Translate the following text to Arabic with High-Society Egyptian Business Tone.

Context: ${context?.scope || "luxury interior design consultation"} for ${context?.tier || "high-end"} client.

TONE REQUIREMENTS:
- Sophisticated, refined, prestigious
- Use formal Arabic (فصحى) with occasional elegant Egyptian expressions
- Convey exclusivity and elite status
- Warm yet professional - like a luxury concierge
- Avoid overly technical terms unless necessary
- Maintain respectful distance while being inviting

TEXT TO TRANSLATE:
"${text}"

Return ONLY the Arabic translation, no explanations.`
    : `Translate the following text to English with International Luxury Tone.

Context: ${context?.scope || "luxury interior design consultation"} for ${context?.tier || "high-end"} client.

TONE REQUIREMENTS:
- Refined, cosmopolitan, sophisticated
- International luxury brand voice (like Four Seasons, Bvlgari Hotel)
- Elegant but accessible - not pretentious
- Professional yet warm
- Use evocative language that appeals to discerning clientele
- Focus on experience, craftsmanship, and vision

TEXT TO TRANSLATE:
"${text}"

Return ONLY the English translation, no explanations.`;

  const result = await askOpenRouter(prompt, undefined, {
    model: "anthropic/claude-3.5-sonnet",
    temperature: 0.3,
    maxTokens: 1024,
  });

  if (!result.success) {
    console.error("[MultilingualEngine] Translation failed:", result.error);
    return text; // Fallback to original
  }

  return result.content.trim();
}

/**
 * Auto-translate admin summary from English to Arabic
 * For WhatsApp/Dashboard admin notifications
 */
export async function translateForAdmin(
  englishText: string,
  metadata?: { scope?: string; tier?: string; clientName?: string }
): Promise<{ original: string; arabic: string; summary: string }> {
  const prompt = `You are an assistant for Azenith Living, a luxury interior design firm in Egypt.

The admin team prefers Arabic notifications but also needs the original English for reference.

INPUT (Client message in English):
"${englishText}"

Context:
- Client: ${metadata?.clientName || "Anonymous"}
- Project: ${metadata?.scope || "Interior Design"}
- Tier: ${metadata?.tier || "Standard"}

OUTPUT FORMAT (JSON):
{
  "original": "Exact original English text",
  "arabic": "Professional Arabic translation using High-Society Egyptian business tone",
  "summary": "One-line Arabic summary for quick WhatsApp/dashboard notification"
}

Tone for Arabic:
- Professional, sophisticated, respectful
- Formal Arabic with elegant business expressions
- Concise yet complete
- Maintain the essence of luxury service

Return ONLY valid JSON.`;

  const result = await askOpenRouter(prompt, undefined, {
    model: "anthropic/claude-3.5-sonnet",
    temperature: 0.3,
    maxTokens: 1024,
  });

  if (!result.success) {
    return {
      original: englishText,
      arabic: englishText,
      summary: englishText.substring(0, 100) + "...",
    };
  }

  try {
    const cleaned = result.content.replace(/```json\n?|```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      original: parsed.original || englishText,
      arabic: parsed.arabic || englishText,
      summary: parsed.summary || parsed.arabic?.substring(0, 100) + "...",
    };
  } catch {
    return {
      original: englishText,
      arabic: result.content,
      summary: result.content.substring(0, 100) + "...",
    };
  }
}

/**
 * Language detection helper
 */
export function detectLanguage(text: string): Language {
  // Simple heuristic: check for Arabic characters
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  return arabicPattern.test(text) ? "ar" : "en";
}

/**
 * Format numbers for locale
 */
export function formatNumber(num: number, lang: Language): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US").format(num);
}

/**
 * Format currency for Egyptian market
 */
export function formatCurrency(amount: number, lang: Language): string {
  if (lang === "ar") {
    return `${formatNumber(amount, "ar")} ج.م`;
  }
  return `EGP ${formatNumber(amount, "en")}`;
}

/**
 * React hook for translations
 */
export function useMultilingualEngine(initialLang: Language = "en") {
  const [language, setLanguage] = useState<Language>(initialLang);

  const t = (key: string) => getTranslation(key, language);
  
  const translate = async (text: string, context?: Partial<TranslationContext>) => {
    return translateWithContext(text, language, context);
  };

  return {
    language,
    setLanguage,
    t,
    translate,
    isRTL: language === "ar",
  };
}
