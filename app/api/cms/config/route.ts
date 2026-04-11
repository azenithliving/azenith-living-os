import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSessionInfo } from "@/lib/auth/session";

// GET - Load site config
export async function GET() {
  try {
    // Verify admin access
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo?.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error('Supabase not initialized');
    
    // Get the first company (master tenant)
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .limit(1)
      .single();

    if (!company) {
      return NextResponse.json({ config: null });
    }

    // Fetch all site config for this company
    const { data: configs } = await supabase
      .from("site_config")
      .select("section_key, content")
      .eq("company_id", company.id)
      .eq("is_active", true);

    if (!configs || configs.length === 0) {
      return NextResponse.json({ config: null });
    }

    // Merge all configs into a single object
    const mergedConfig = configs.reduce((acc, item) => {
      acc[item.section_key] = item.content;
      return acc;
    }, {} as Record<string, unknown>);

    return NextResponse.json({ config: mergedConfig });
  } catch (error) {
    console.error("Error loading config:", error);
    return NextResponse.json(
      { error: "Failed to load configuration" },
      { status: 500 }
    );
  }
}

// POST - Save site config
export async function POST(request: Request) {
  try {
    // Verify admin access
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo?.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error('Supabase not initialized');

    // Get the first company (master tenant)
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .limit(1)
      .single();

    if (!company) {
      return NextResponse.json({ error: "No company found" }, { status: 404 });
    }

    const companyId = company.id;

    // Split config into sections and save each
    const sections = [
      { key: "hero", content: { title: body.heroTitle, subtitle: body.heroSubtitle, background: body.heroBackground } },
      { key: "budget_options", content: body.budgetOptions },
      { key: "style_options", content: body.styleOptions },
      { key: "service_options", content: body.serviceOptions }
    ];

    for (const section of sections) {
      // Check if config exists
      const { data: existing } = await supabase
        .from("site_config")
        .select("id")
        .eq("company_id", companyId)
        .eq("section_key", section.key)
        .single();

      if (existing) {
        // Update existing
        await supabase
          .from("site_config")
          .update({
            content: section.content,
            published_at: new Date().toISOString()
          })
          .eq("id", existing.id);
      } else {
        // Insert new
        await supabase.from("site_config").insert({
          company_id: companyId,
          section_key: section.key,
          content: section.content,
          is_active: true
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving config:", error);
    return NextResponse.json(
      { error: "Failed to save configuration" },
      { status: 500 }
    );
  }
}
