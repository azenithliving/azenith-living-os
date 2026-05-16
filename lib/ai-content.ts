import "server-only";

import { askGroq } from "@/lib/ai-orchestrator";

export interface AIContentRequest {
  type: "page_title" | "page_description" | "cta_text" | "product_description";
  context: {
    roomType?: string;
    style?: string;
    budget?: string;
    brandName: string;
  };
  tone?: "professional" | "friendly" | "luxury" | "energetic";
  language?: "ar" | "en";
}

export interface AIContentResponse {
  content: string;
  alternatives?: string[];
  tokensUsed?: number;
  source?: "ai" | "template";
}

function buildTemplateContent(request: AIContentRequest): string {
  const { type, context, language = "ar" } = request;

  if (language === "ar") {
    switch (type) {
      case "page_title":
        return `تصميم ${context.roomType || "مساحتك"} بأسلوب ${context.style || "عصري"}`;
      case "page_description":
        return `اكتشف تصاميم فريدة ومخصصة لـ ${context.roomType || "مساحتك"}. نوفر حلول تصميم داخلي احترافية بميزانية ${context.budget || "مخصصة"}. فريقنا في ${context.brandName} جاهز لتحقيق رؤيتك.`;
      case "cta_text":
        return "ابدأ تصميمك الآن واحصل على عرض مجاني";
      case "product_description":
        return `خدمة تصميم داخلي شاملة تجمع بين الأناقة والوظيفية. متخصصون في ${context.roomType || "التصميم الداخلي"} بأسلوب ${context.style || "عصري"}. جودة عالية، أسعار منافسة.`;
    }
  }

  switch (type) {
    case "page_title":
      return `Design Your ${context.roomType || "Space"} in ${context.style || "Modern"} Style`;
    case "page_description":
      return `Discover unique designs for your ${context.roomType || "space"}. ${context.brandName} delivers professional interior solutions within your budget.`;
    case "cta_text":
      return "Start Your Design Today — Get a Free Quote";
    case "product_description":
      return `Full interior design service in ${context.style || "modern"} style for ${context.roomType || "your space"}.`;
  }
}

function buildPrompt(request: AIContentRequest): string {
  const { type, context, tone = "luxury", language = "ar" } = request;
  const langLabel = language === "ar" ? "Arabic" : "English";

  return `You are a luxury interior design copywriter for "${context.brandName}".
Write ${type.replace("_", " ")} in ${langLabel}.
Tone: ${tone}.
Room: ${context.roomType || "general space"}.
Style: ${context.style || "modern"}.
Budget: ${context.budget || "flexible"}.
Output ONLY the final copy text, no quotes or markdown.`;
}

export async function generateAIContent(request: AIContentRequest): Promise<AIContentResponse> {
  const template = buildTemplateContent(request);

  try {
    const ai = await askGroq(buildPrompt(request), {
      temperature: 0.8,
      maxTokens: 512,
    });

    if (ai.success && ai.content.trim()) {
      const content = ai.content.trim();
      return {
        content,
        alternatives: [template],
        tokensUsed: Math.ceil(content.length / 4),
        source: "ai",
      };
    }
  } catch (error) {
    console.error("[AI Content] Groq generation failed:", error);
  }

  return {
    content: template,
    alternatives: [template],
    tokensUsed: Math.ceil(template.length / 4),
    source: "template",
  };
}

export async function improveContent(
  content: string,
  improvement: "seo" | "clarity" | "persuasion",
  language: "ar" | "en" = "ar"
): Promise<AIContentResponse> {
  const prompt = `Improve this ${language === "ar" ? "Arabic" : "English"} interior design copy for ${improvement}.
Return ONLY the improved text.

Original:
${content}`;

  try {
    const ai = await askGroq(prompt, { temperature: 0.6, maxTokens: 800 });
    if (ai.success && ai.content.trim()) {
      return {
        content: ai.content.trim(),
        tokensUsed: Math.ceil(ai.content.length / 4),
        source: "ai",
      };
    }
  } catch (error) {
    console.error("[AI Content] improve failed:", error);
  }

  let improvedContent = content;
  if (language === "ar") {
    switch (improvement) {
      case "seo":
        improvedContent = `${content} — تصميم داخلي فاخر، ديكور مخصص، وحلول تنفيذ متكاملة.`;
        break;
      case "clarity":
        improvedContent = content.split(" ").slice(0, Math.ceil(content.split(" ").length * 0.85)).join(" ");
        break;
      case "persuasion":
        improvedContent = `${content} انضم لمئات العملاء الراضين.`;
        break;
    }
  }

  return {
    content: improvedContent,
    tokensUsed: Math.ceil(improvedContent.length / 4),
    source: "template",
  };
}

export async function generateSEOContent(roomType: string, style: string, location?: string): Promise<{
  title: string;
  description: string;
  keywords: string[];
}> {
  const prompt = `Generate SEO metadata in Arabic for luxury interior design.
Room: ${roomType}. Style: ${style}. Location: ${location || "Egypt"}.
Return JSON only: {"title":"","description":"","keywords":[]}`;

  try {
    const ai = await askGroq(prompt, { temperature: 0.5, maxTokens: 400, jsonMode: true });
    if (ai.success && ai.content.trim()) {
      const parsed = JSON.parse(ai.content) as { title?: string; description?: string; keywords?: string[] };
      if (parsed.title && parsed.description && Array.isArray(parsed.keywords)) {
        return {
          title: parsed.title,
          description: parsed.description,
          keywords: parsed.keywords,
        };
      }
    }
  } catch (error) {
    console.error("[AI Content] SEO generation failed:", error);
  }

  const keywords = [
    `تصميم ${roomType}`,
    `${style} تصميم`,
    `تصميم داخلي ${roomType}`,
    location ? `تصميم ${roomType} في ${location}` : null,
    `أفضل ${roomType} تصاميم`,
  ].filter(Boolean) as string[];

  return {
    title: `تصميم ${roomType} ${style} - حلول تصميم احترافية`,
    description: `احصل على تصميم ${roomType} متقن بأسلوب ${style}. فريقنا المتخصص يقدم حلولاً مبتكرة وبجودة عالية.`,
    keywords,
  };
}
