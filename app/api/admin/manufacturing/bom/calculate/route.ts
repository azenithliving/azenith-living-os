/**
 * Calculate a bill of materials from the quantities recorded on a design.
 *
 * This endpoint deliberately does not invent wood, hardware, labour, prices,
 * or weights. A BOM is useful only when every figure can be traced to a
 * design specification or an inventory record.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { supabaseServer } from "@/lib/dal/unified-supabase";

type JsonRecord = Record<string, unknown>;

type DesignMaterial = {
  name: string;
  quantity: number;
  unit?: string;
  wastePercentage: number;
};

type CalculatedBomItem = {
  inventory_item_id: string | null;
  item_name: string;
  quantity: number;
  unit: string | null;
  unit_cost: number | null;
  total_cost: number | null;
  waste_amount: number;
  waste_percentage: number;
  availability: "available" | "insufficient" | "not_registered";
  available_quantity: number | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readMaterialList(specifications: JsonRecord): DesignMaterial[] {
  const rawMaterials = specifications.bom_items
    ?? specifications.materials
    ?? specifications.materials_selected;

  if (!Array.isArray(rawMaterials)) return [];

  return rawMaterials.flatMap((value) => {
    if (!isRecord(value)) return [];

    const name = value.material_name ?? value.name ?? value.material;
    const quantity = asFiniteNumber(value.quantity);
    const wastePercentage = asFiniteNumber(
      value.wastage_percent ?? value.waste_percentage ?? value.wastePercent
    ) ?? 0;

    if (
      typeof name !== "string"
      || !name.trim()
      || quantity === null
      || quantity <= 0
      || wastePercentage < 0
    ) {
      return [];
    }

    return [{
      name: name.trim(),
      quantity,
      unit: typeof value.unit === "string" ? value.unit : undefined,
      wastePercentage,
    }];
  });
}

async function calculateBom(
  companyId: string,
  materials: DesignMaterial[],
  orderQuantity: number,
  includeWaste: boolean
) {
  const items: CalculatedBomItem[] = [];
  let pricedMaterialsCost = 0;
  let hasUnpricedItem = false;

  for (const material of materials) {
    const appliedWaste = includeWaste ? material.wastePercentage : 0;
    const requiredQuantity = material.quantity * orderQuantity * (1 + appliedWaste / 100);

    const { data: matches, error } = await supabaseServer
      .from("inventory_items")
      .select("id, name, current_quantity, unit, unit_of_measure, unit_cost")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .ilike("name", `%${material.name}%`)
      .limit(1);

    if (error) throw error;

    const inventory = Array.isArray(matches) ? matches[0] : null;
    const unitCost = asFiniteNumber(inventory?.unit_cost);
    const totalCost = unitCost === null ? null : unitCost * requiredQuantity;
    const availableQuantity = asFiniteNumber(inventory?.current_quantity);

    if (totalCost === null) hasUnpricedItem = true;
    else pricedMaterialsCost += totalCost;

    items.push({
      inventory_item_id: typeof inventory?.id === "string" ? inventory.id : null,
      item_name: material.name,
      quantity: Number(requiredQuantity.toFixed(3)),
      unit: material.unit
        ?? (typeof inventory?.unit === "string" ? inventory.unit : null)
        ?? (typeof inventory?.unit_of_measure === "string" ? inventory.unit_of_measure : null),
      unit_cost: unitCost,
      total_cost: totalCost === null ? null : Number(totalCost.toFixed(2)),
      waste_amount: Number((requiredQuantity - material.quantity * orderQuantity).toFixed(3)),
      waste_percentage: appliedWaste,
      availability: !inventory
        ? "not_registered"
        : availableQuantity !== null && availableQuantity >= requiredQuantity
          ? "available"
          : "insufficient",
      available_quantity: availableQuantity,
    });
  }

  return {
    items,
    total_materials_cost: hasUnpricedItem ? null : Number(pricedMaterialsCost.toFixed(2)),
    priced_materials_cost: Number(pricedMaterialsCost.toFixed(2)),
    unpriced_items_count: items.filter((item) => item.total_cost === null).length,
    total_weight: null,
    estimated_labor_hours: null,
    waste_included: includeWaste,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const body = await request.json();
    const designVersionId = typeof body.design_version_id === "string"
      ? body.design_version_id
      : null;
    const requestedSalesOrderItemId = typeof body.sales_order_item_id === "string"
      ? body.sales_order_item_id
      : null;
    const quantity = asFiniteNumber(body.quantity) ?? 1;
    const includeWaste = body.include_waste !== false;

    if (!designVersionId) {
      return NextResponse.json(
        { success: false, error: "اختر معرّف نسخة تصميم لحساب قائمة المواد." },
        { status: 400 }
      );
    }

    if (quantity <= 0 || quantity > 10000) {
      return NextResponse.json(
        { success: false, error: "الكمية يجب أن تكون رقمًا موجبًا ومقبولًا." },
        { status: 400 }
      );
    }

    const companyId = await resolveAdminCompanyId();
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "لا توجد شركة مهيأة لحساب قائمة المواد." },
        { status: 422 }
      );
    }

    const { data: design, error: designError } = await supabaseServer
      .from("design_versions")
      .select("id, sales_order_item_id, specifications, design_data")
      .eq("id", designVersionId)
      .maybeSingle();

    if (designError) throw designError;
    if (!design) {
      return NextResponse.json({ success: false, error: "نسخة التصميم غير موجودة." }, { status: 404 });
    }

    const salesOrderItemId = typeof design.sales_order_item_id === "string"
      ? design.sales_order_item_id
      : null;
    if (requestedSalesOrderItemId && requestedSalesOrderItemId !== salesOrderItemId) {
      return NextResponse.json(
        { success: false, error: "عنصر أمر البيع لا يطابق نسخة التصميم المحددة." },
        { status: 400 }
      );
    }

    const specifications = isRecord(design.specifications)
      ? design.specifications
      : isRecord(design.design_data)
        ? design.design_data
        : null;
    const materials = specifications ? readMaterialList(specifications) : [];

    if (materials.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "لا تحتوي نسخة التصميم على مواد ذات كميات مسجلة. أضف bom_items أو materials بصيغة الاسم والكمية أولاً.",
        },
        { status: 422 }
      );
    }

    const calculatedBom = await calculateBom(companyId, materials, quantity, includeWaste);

    if (body.save === true) {
      if (!salesOrderItemId) {
        return NextResponse.json(
          { success: false, error: "لا يمكن حفظ قائمة المواد قبل ربط التصميم بعنصر أمر بيع." },
          { status: 422 }
        );
      }

      if (calculatedBom.unpriced_items_count > 0 || calculatedBom.total_materials_cost === null) {
        return NextResponse.json(
          { success: false, error: "أضف أسعار المواد الناقصة في المخزون قبل حفظ قائمة المواد." },
          { status: 422 }
        );
      }

      const { data: header, error: headerError } = await supabaseServer
        .from("bom_headers")
        .insert({
          design_version_id: designVersionId,
          version_number: 1,
          total_material_cost: calculatedBom.total_materials_cost,
          total_cost: calculatedBom.total_materials_cost,
          notes: `Calculated for ${quantity} unit(s) from design ${designVersionId}.`,
        })
        .select("id")
        .single();

      if (headerError || !header) throw headerError ?? new Error("Could not create BOM header");

      const { error: itemsError } = await supabaseServer.from("bom_items").insert(
        calculatedBom.items.map((item) => ({
          bom_header_id: header.id,
          material_name: item.item_name,
          quantity: item.quantity,
          unit: item.unit,
          unit_cost: item.unit_cost,
          total_cost: item.total_cost,
          wastage_percent: item.waste_percentage,
        }))
      );

      if (itemsError) throw itemsError;
    }

    return NextResponse.json({
      success: true,
      data: {
        ...calculatedBom,
        design_version_id: designVersionId,
        sales_order_item_id: salesOrderItemId,
      },
      message: body.save === true ? "تم حفظ قائمة المواد." : undefined,
    });
  } catch (error) {
    console.error("BOM calculation error:", error);
    return NextResponse.json(
      { success: false, error: "تعذر حساب قائمة المواد من البيانات المسجلة." },
      { status: 500 }
    );
  }
}
