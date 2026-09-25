import { NextResponse } from "next/server";
import { belongsToStore } from "@/lib/company-scope";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

// Public API to fetch room sections with CMS images
export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error('Supabase not initialized');

    // The store is one business; its sections were historically stamped with
    // more than one company id. Scoping through belongsToStore keeps this
    // route correct both before and after the ids are consolidated, instead of
    // pinning the public homepage to one hard-coded value.
    const canonical = await resolveAdminCompanyId();

    const { data: sections, error } = await supabase
      .from("room_sections")
      .select("id, company_id, slug, name, name_ar, description, icon, display_order, is_active, image_url, metadata")
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
    const transformedSections = (sections || []).filter((section) => belongsToStore(section.company_id, canonical)).map((section) => {
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
    });

    return NextResponse.json({ sections: transformedSections });
  } catch (error) {
    console.error("Error in room-sections API:", error);
    return NextResponse.json(
      { error: "Failed to load room sections" },
      { status: 500 }
    );
  }
}
