import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

// Public API to load site config - no auth required
export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    
    // Get the first company (master tenant)
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .limit(1)
      .single();

    if (!company) {
      return NextResponse.json({ config: null });
    }

    // Fetch all active site config for this company
    const { data: configs } = await supabase
      .from("site_config")
      .select("section_key, content")
      .eq("company_id", company.id)
      .eq("is_active", true);

    if (!configs || configs.length === 0) {
      return NextResponse.json({ config: null });
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

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Error loading public config:", error);
    return NextResponse.json(
      { error: "Failed to load configuration" },
      { status: 500 }
    );
  }
}
