import { NextResponse } from "next/server";
import { DEFAULT_COMPANY_ID } from "@/lib/company-resolver";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

// Public API to fetch room sections with CMS images
export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error('Supabase not initialized');
    
    const masterCompanyId = process.env.MASTER_COMPANY_ID || DEFAULT_COMPANY_ID;

    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("id", masterCompanyId)
      .maybeSingle();

    const companyId = company?.id ?? masterCompanyId;

    const { data: sections, error } = await supabase
      .from("room_sections")
      .select("id, company_id, slug, name, name_ar, description, icon, display_order, is_active, image_url, metadata")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching room sections:", error);
      return NextResponse.json(
        { error: "Failed to fetch room sections" },
        { status: 500 }
      );
    }

    // Transform sections - metadata field not available in DB
    const transformedSections = sections?.map((section) => {
      return {
        slug: section.slug,
        name: section.name,
        nameAr: section.name_ar,
        description: section.description,
        icon: section.icon,
        displayOrder: section.display_order,
        cmsImageUrl: section.image_url ?? null,
        galleryImages: Array.isArray(section.metadata?.gallery)
          ? section.metadata.gallery
          : [],
      };
    }) || [];

    return NextResponse.json({ sections: transformedSections });
  } catch (error) {
    console.error("Error in room-sections API:", error);
    return NextResponse.json(
      { error: "Failed to load room sections" },
      { status: 500 }
    );
  }
}
