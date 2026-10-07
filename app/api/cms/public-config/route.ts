import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { readHoursSentence } from "@/lib/consultant/store-facts";

// Public API to load site config - no auth required
export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error('Supabase not initialized');

    // The hours are the owner's own sentence, not a number this door invents: the surfaces that
    // compute a schedule read it here, so a screen and the advisor cannot answer two different times.
    // It rides every success path — a store with no site rows yet still has to know when it opens.
    const workingHours = await readHoursSentence();

    // Get the first company (master tenant)
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .limit(1)
      .single();

    if (!company) {
      console.warn("[PublicConfig] مفيش شركة مسجلة — بيوصل الميعاد بس من غير إعدادات موقع");
      return NextResponse.json({ config: { workingHours } });
    }

    // Fetch all active site config for this company
    const { data: configs } = await supabase
      .from("site_config")
      .select("section_key, content")
      .eq("company_id", company.id)
      .eq("is_active", true);

    if (!configs || configs.length === 0) {
      return NextResponse.json({ config: { workingHours } });
    }

    // Build flat config object
    const config: Record<string, unknown> = {};
    
    for (const item of configs) {
      switch (item.section_key) {
        case "hero":
          if (item.content && typeof item.content === "object") {
            config.heroTitle = item.content.title;
            config.heroSubtitle = item.content.subtitle;
            config.heroBackground = item.content.background;
          }
          break;
        case "budget_options":
          if (Array.isArray(item.content)) {
            config.budgetOptions = item.content;
          }
          break;
        case "style_options":
          if (Array.isArray(item.content)) {
            config.styleOptions = item.content;
          }
          break;
        case "service_options":
          if (Array.isArray(item.content)) {
            config.serviceOptions = item.content;
          }
          break;
      }
    }

    // The hours are the owner's sentence, not a number this door invents: the surfaces that compute
    // a schedule read it here so they can never disagree with what the advisor answers.
    config.workingHours = workingHours;

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Error loading public config:", error);
    return NextResponse.json(
      { error: "Failed to load configuration" },
      { status: 500 }
    );
  }
}
