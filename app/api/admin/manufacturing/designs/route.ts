import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { supabaseServer } from "@/lib/dal/unified-supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const { data: designs, error } = await supabaseServer
      .from("design_versions")
      .select("id, version_number, status, created_at, sales_order_item_id, sales_order_items(description, room_name, item_type)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Failed to load design versions:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const formatted = (designs || []).map((d: any) => {
      const item = Array.isArray(d.sales_order_items)
        ? d.sales_order_items[0]
        : d.sales_order_items;
      const itemName = item?.description || item?.room_name || item?.item_type;
      const title = itemName
        ? `${itemName} (إصدار ${d.version_number})`
        : `نسخة تصميم #${d.id.slice(0, 8)} (إصدار ${d.version_number})`;

      return {
        id: d.id,
        title,
        version_number: d.version_number,
        status: d.status,
        created_at: d.created_at,
        sales_order_item_id: d.sales_order_item_id,
      };
    });

    return NextResponse.json({ success: true, data: formatted });
  } catch (error) {
    console.error("Design versions route error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load design versions" },
      { status: 500 }
    );
  }
}
