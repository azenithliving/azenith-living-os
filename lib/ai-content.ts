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
}

// Mock AI responses - in production, this would call OpenAI API
// UPGRADE PATH: To enable real AI content generation:
// 1. Add OPENAI_API_KEY to environment variables
// 2. Install openai package: npm install openai
// 3. Replace mock implementation below with openai.ChatCompletion.create() call
// 4. Current interface remains the same - zero breaking changes for UI
export async function generateAIContent(request: AIContentRequest): Promise<AIContentResponse> {
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    let content = "";
    // tone parameter reserved for future AI integration
    const { type, context, language = "ar" } = request;

    if (language === "ar") {
      switch (type) {
        case "page_title":
          content = `تصميم ${context.roomType || "مساحتك"} بأسلوب ${context.style || "عصري"}`;
          break;
        case "page_description":
          content = `اكتشف تصاميم فريدة ومخصصة لـ ${context.roomType || "مساحتك"}. نوفر حلول تصميم داخلي احترافية بميزانية ${context.budget || "مخصصة"}. فريقنا في ${context.brandName} جاهز لتحقيق رؤيتك.`;
          break;
        case "cta_text":
          content = "ابدأ تصميمك الآن واحصل على عرض مجاني";
          break;
        case "product_description":
          content = `خدمة تصميم داخلي شاملة تجمع بين الأناقة والوظيفية. متخصصون في ${context.roomType || "التصميم الداخلي"} بأسلوب ${context.style || "عصري"}. جودة عالية، أسعار منافسة.`;
          break;
      }
    } else {
      switch (type) {
        case "page_title":
          content = `Design Your ${context.roomType || "Space"} in ${context.style || "Modern"} Style`;
          break;
        case "page_description":
          content = `Discover unique and personalized designs for your ${context.roomType || "space"}. We provide professional interior design solutions within your budget. ${context.brandName} team is ready to bring your vision to life.`;
          break;
        case "cta_text":
          content = "Start Your Design Today - Get Free Quote";
          break;
        case "product_description":
          content = `Comprehensive interior design service combining elegance and functionality. Specialists in ${context.roomType || "interior design"} with ${context.style || "modern"} style. High quality, competitive prices.`;
          break;
      }
    }

    return {
      content,
      alternatives: [content], // In production, generate multiple alternatives
      tokensUsed: Math.ceil(content.length / 4) // Rough estimate
    };
  } catch (error) {
    console.error("AI content generation error:", error);
    throw error;
  }
}

export async function improveContent(
  content: string,
  improvement: "seo" | "clarity" | "persuasion"
): Promise<AIContentResponse> {
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 300));

    let improvedContent = content;

    switch (improvement) {
      case "seo":
        improvedContent = `${content} - اكتشف أفضل خيارات التصميم الداخلي المتاحة، مع تقديم حلول مخصصة لكل احتياجاتك.`;
        break;
      case "clarity":
        improvedContent = content.split(" ").slice(0, Math.ceil(content.split(" ").length * 0.8)).join(" ") + "...";
        break;
      case "persuasion":
        improvedContent = `${content} انضم لمئات العملاء الراضين الذين اختاروا خدماتنا.`;
        break;
    }

    return {
      content: improvedContent,
      tokensUsed: Math.ceil(improvedContent.length / 4)
    };
  } catch (error) {
    console.error("Content improvement error:", error);
    throw error;
  }
}

export async function generateSEOContent(roomType: string, style: string, location?: string): Promise<{
  title: string;
  description: string;
  keywords: string[];
}> {
  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    const keywords = [
      `تصميم ${roomType}`,
      `${style} تصميم`,
      `تصميم داخلي ${roomType}`,
      location ? `تصميم ${roomType} في ${location}` : null,
      `أفضل ${roomType} تصاميم`
    ].filter(Boolean) as string[];

    return {
      title: `تصميم ${roomType} ${style} - حلول تصميم احترافية`,
      description: `احصل على تصميم ${roomType} متقن بأسلوب ${style}. فريقنا المتخصص يقدم حلولاً مبتكرة وبجودة عالية.`,
      keywords
    };
  } catch (error) {
    console.error("SEO content generation error:", error);
    throw error;
  }
}