import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export interface SiteConfigData {
  heroTitle: string;
  heroSubtitle: string;
  heroBackground: string;
  budgetOptions: string[];
  styleOptions: string[];
  serviceOptions: string[];
}

const defaultConfig: SiteConfigData = {
  heroTitle: "ابدأ رحلة التصميم الذكي.",
  heroSubtitle: "أربع اختيارات فقط تكفي لبناء ملف العميل، تقدير مبدئي، ورسالة واتساب جاهزة للفريق التجاري.",
  heroBackground: "/videos/hero-bg.mp4",
  budgetOptions: [
    "2,500 - 5,500 EGP",
    "5,500 - 12,000 EGP",
    "12,000 - 25,000 EGP",
    "25,000+ EGP"
  ],
  styleOptions: [
    "مودرن دافئ",
    "هادئ فاخر",
    "عملي مع لمسة فندقية",
    "صناعي ناعم"
  ],
  serviceOptions: [
    "تصميم فقط",
    "تصميم وتجهيز",
    "تصميم وتنفيذ",
    "تجديد لمساحة قائمة"
  ]
};

export async function getSiteConfig(): Promise<SiteConfigData> {
  try {
    const supabase = getSupabaseAdminClient();
    
    if (!supabase) {
      console.warn("[site-config] Supabase not available, returning default config");
      return defaultConfig;
    }
    
    // Get the first company (master tenant)
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .limit(1)
      .single();

    if (!company) {
      return defaultConfig;
    }

    // Fetch all active site config
    const { data: configs } = await supabase
      .from("site_config")
      .select("section_key, content")
      .eq("company_id", company.id)
      .eq("is_active", true);

    if (!configs || configs.length === 0) {
      return defaultConfig;
    }

    // Build config from database
    const dbConfig: Partial<SiteConfigData> = {};
    
    for (const item of configs) {
      switch (item.section_key) {
        case "hero":
          if (item.content) {
            dbConfig.heroTitle = item.content.title || defaultConfig.heroTitle;
            dbConfig.heroSubtitle = item.content.subtitle || defaultConfig.heroSubtitle;
            dbConfig.heroBackground = item.content.background || defaultConfig.heroBackground;
          }
          break;
        case "budget_options":
          if (Array.isArray(item.content)) {
            dbConfig.budgetOptions = item.content;
          }
          break;
        case "style_options":
          if (Array.isArray(item.content)) {
            dbConfig.styleOptions = item.content;
          }
          break;
        case "service_options":
          if (Array.isArray(item.content)) {
            dbConfig.serviceOptions = item.content;
          }
          break;
      }
    }

    return { ...defaultConfig, ...dbConfig };
  } catch (error) {
    console.error("Error fetching site config:", error);
    return defaultConfig;
  }
}

// Re-export the static content that doesn't come from CMS
export { roomDefinitions, seoDefinitions, packageLadder, trustPoints, TONE_MAP, executionTimeline, aboutData, getRoomDefinition, getSeoDefinition } from "./site-content";
