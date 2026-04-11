import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

// Public API to fetch room sections with CMS images
export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error('Supabase not initialized');
    
    // Get the first company (master tenant)
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .limit(1)
      .single();

    if (!company) {
      return NextResponse.json({ sections: [] });
    }

    // Fetch all active room sections with their images
    const { data: sections, error } = await supabase
      .from("room_sections")
      .select("slug, name, name_ar, description, icon, display_order, metadata")
      .eq("company_id", company.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching room sections:", error);
      return NextResponse.json(
        { error: "Failed to fetch room sections" },
        { status: 500 }
      );
    }

    // Transform sections to include CMS image URLs from metadata
    const transformedSections = sections?.map((section) => {
      const metadata = (section.metadata as Record<string, unknown>) || {};
      return {
        slug: section.slug,
        name: section.name,
        nameAr: section.name_ar,
        description: section.description,
        icon: section.icon,
        displayOrder: section.display_order,
        // CMS image URL from metadata.image_url or metadata.featured_image
        cmsImageUrl: metadata.image_url || metadata.featured_image || null,
        // Gallery images array if available
        galleryImages: metadata.gallery_images || [],
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
