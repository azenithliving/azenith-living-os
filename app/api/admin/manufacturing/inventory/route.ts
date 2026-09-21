/**
 * Inventory operations for the manufacturing dashboard.
 * Every mutation is authenticated, scoped to the resolved company, and is
 * recorded in the stock ledger when that ledger is available.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { supabaseServer } from "@/lib/dal/unified-supabase";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stockStatus(item: JsonRecord) {
  const current = asNumber(item.current_quantity);
  const minimum = asNumber(item.min_stock_level);
  const reorderPoint = asNumber(item.reorder_point, minimum);

  if (current <= minimum) return "low" as const;
  if (current <= reorderPoint) return "reorder" as const;
  return "ok" as const;
}

type PresentedInventoryItem = JsonRecord & {
  item_type: string;
  unit_of_measure: string;
  stock_status: "ok" | "reorder" | "low";
  reorder_needed: boolean;
};

function presentItem(item: JsonRecord): PresentedInventoryItem {
  const status = stockStatus(item);
  return {
    ...item,
    item_type: asNonEmptyString(item.category) ?? asNonEmptyString(item.item_type) ?? "غير مصنف",
    unit_of_measure: asNonEmptyString(item.unit) ?? asNonEmptyString(item.unit_of_measure) ?? "وحدة",
    stock_status: status,
    reorder_needed: status !== "ok",
  };
}

function supplierFrom(value: unknown) {
  const source = asRecord(value);
  if (!source) return null;
  const name = asNonEmptyString(source.name);
  if (!name) return null;
  return {
    name,
    contact: asNonEmptyString(source.contact),
    leadTimeDays: Math.max(0, asNumber(source.lead_time_days, 0)),
  };
}

async function getScopedItem(companyId: string, itemId: string) {
  const { data, error } = await supabaseServer
    .from("inventory_items")
    .select("*")
    .eq("id", itemId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  return data ? asRecord(data) : null;
}

export async function GET(request: NextRequest) {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const companyId = await resolveAdminCompanyId();
    const lowStock = searchParams.get("low_stock") === "true";
    const category = searchParams.get("category")?.trim().toLowerCase();
    const search = searchParams.get("search")?.trim().toLowerCase();

    if (!companyId) {
      return NextResponse.json({
        success: true,
        data: [],
        warnings: ["No company record is available for inventory."],
      });
    }

    const { data, error } = await supabaseServer
      .from("inventory_items")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name");

    if (error) throw error;

    const items = (Array.isArray(data) ? data : [])
      .map((item) => presentItem(asRecord(item) ?? {}))
      .filter((item) => {
        const name = asNonEmptyString(item.name)?.toLowerCase() ?? "";
        const sku = asNonEmptyString(item.sku)?.toLowerCase() ?? "";
        const itemCategory = asNonEmptyString(item.category)?.toLowerCase()
          ?? asNonEmptyString(item.item_type)?.toLowerCase()
          ?? "";
        const matchesSearch = !search || name.includes(search) || sku.includes(search);
        const matchesCategory = !category || itemCategory === category;
        const matchesLowStock = !lowStock || item.stock_status === "low";
        return matchesSearch && matchesCategory && matchesLowStock;
      });

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error("Inventory GET error:", error);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل بيانات المخزون." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const action = asNonEmptyString(body.action);
    const companyId = await resolveAdminCompanyId();

    if (!companyId || !action) {
      return NextResponse.json(
        { success: false, error: "A configured company and action are required." },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();

    if (action === "create") {
      const name = asNonEmptyString(body.name);
      const unit = asNonEmptyString(body.unit);
      const sku = asNonEmptyString(body.sku);
      const category = asNonEmptyString(body.category);
      const currentQuantity = asNumber(body.current_quantity);
      const minimum = asNumber(body.min_stock_level);
      const reorderQuantity = asNumber(body.reorder_quantity);
      const unitCost = asNumber(body.unit_cost, NaN);
      const supplierName = asNonEmptyString(body.supplier_name);
      const supplierContact = asNonEmptyString(body.supplier_contact);

      if (!name || !unit || currentQuantity < 0 || minimum < 0 || reorderQuantity < 0) {
        return NextResponse.json(
          { success: false, error: "أدخل الاسم والوحدة وكميات صحيحة غير سالبة." },
          { status: 400 }
        );
      }

      if (Number.isNaN(unitCost) || unitCost < 0) {
        return NextResponse.json(
          { success: false, error: "أدخل سعر وحدة صحيحًا وغير سالب." },
          { status: 400 }
        );
      }

      const { data, error } = await supabaseServer
        .from("inventory_items")
        .insert({
          company_id: companyId,
          sku,
          name,
          category,
          unit,
          current_quantity: currentQuantity,
          min_stock_level: minimum,
          reorder_point: Math.max(minimum, asNumber(body.reorder_point, minimum)),
          reorder_quantity: reorderQuantity,
          unit_cost: unitCost,
          supplier_info: supplierName
            ? { name: supplierName, contact: supplierContact, lead_time_days: asNumber(body.lead_time_days) }
            : null,
          is_active: true,
          created_at: timestamp,
          updated_at: timestamp,
        })
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data: presentItem(asRecord(data) ?? {}) });
    }

    const inventoryItemId = asNonEmptyString(body.inventory_item_id);
    if (!inventoryItemId) {
      return NextResponse.json(
        { success: false, error: "inventory_item_id is required." },
        { status: 400 }
      );
    }

    const item = await getScopedItem(companyId, inventoryItemId);
    if (!item) {
      return NextResponse.json({ success: false, error: "الصنف غير موجود ضمن الشركة الحالية." }, { status: 404 });
    }

    if (action === "reorder") {
      const supplier = supplierFrom(item.supplier_info);
      const reorderQuantity = asNumber(item.reorder_quantity);
      const unitCost = asNumber(item.unit_cost, NaN);

      if (!supplier || reorderQuantity <= 0 || Number.isNaN(unitCost)) {
        return NextResponse.json(
          { success: false, error: "أضف مورّدًا وكمية إعادة الطلب وسعر الوحدة قبل إنشاء أمر شراء." },
          { status: 422 }
        );
      }

      const expectedDelivery = new Date(
        Date.now() + supplier.leadTimeDays * 24 * 60 * 60 * 1000
      ).toISOString();
      const totalAmount = Number((reorderQuantity * unitCost).toFixed(2));
      const { data: purchaseOrder, error: purchaseOrderError } = await supabaseServer
        .from("purchase_orders")
        .insert({
          company_id: companyId,
          supplier_name: supplier.name,
          supplier_contact: supplier.contact,
          status: "draft",
          total_amount: totalAmount,
          expected_delivery_date: expectedDelivery,
          created_by: user.id,
        })
        .select("id, status, total_amount, expected_delivery_date")
        .single();

      if (purchaseOrderError || !purchaseOrder) {
        throw purchaseOrderError ?? new Error("Could not create purchase order");
      }

      const { error: lineError } = await supabaseServer.from("purchase_order_items").insert({
        purchase_order_id: purchaseOrder.id,
        inventory_item_id: inventoryItemId,
        item_name: asNonEmptyString(item.name) ?? "مادة مخزون",
        quantity: reorderQuantity,
        unit: asNonEmptyString(item.unit) ?? asNonEmptyString(item.unit_of_measure),
        unit_price: unitCost,
        total_price: totalAmount,
      });

      if (lineError) throw lineError;
      return NextResponse.json({ success: true, data: { purchase_order: purchaseOrder } });
    }

    if (!(["stock_in", "stock_out", "adjust"] as string[]).includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
    }

    const suppliedQuantity = asNumber(body.quantity, NaN);
    if (Number.isNaN(suppliedQuantity) || suppliedQuantity < 0) {
      return NextResponse.json(
        { success: false, error: "الكمية يجب أن تكون رقمًا غير سالب." },
        { status: 400 }
      );
    }

    const currentQuantity = asNumber(item.current_quantity);
    const newQuantity = action === "stock_in"
      ? currentQuantity + suppliedQuantity
      : action === "stock_out"
        ? currentQuantity - suppliedQuantity
        : suppliedQuantity;

    if (newQuantity < 0) {
      return NextResponse.json({ success: false, error: "لا توجد كمية كافية في المخزون." }, { status: 400 });
    }

    const { error: updateError } = await supabaseServer
      .from("inventory_items")
      .update({ current_quantity: newQuantity, updated_at: timestamp })
      .eq("id", inventoryItemId)
      .eq("company_id", companyId);

    if (updateError) throw updateError;

    const quantityDelta = newQuantity - currentQuantity;
    const unitCost = asNumber(body.unit_cost, asNumber(item.unit_cost, NaN));
    const { error: movementError } = await supabaseServer.from("inventory_movements").insert({
      inventory_item_id: inventoryItemId,
      movement_type: action === "stock_in" ? "purchase" : action === "stock_out" ? "consumption" : "adjustment",
      quantity: quantityDelta,
      unit_cost: Number.isNaN(unitCost) ? null : unitCost,
      total_cost: Number.isNaN(unitCost) ? null : Math.abs(quantityDelta * unitCost),
      reference_type: asNonEmptyString(body.reference_type) ?? "adjustment",
      reference_id: asNonEmptyString(body.reference_id),
      notes: asNonEmptyString(body.notes),
      created_by: user.id,
      created_at: timestamp,
    });

    if (movementError) {
      // Do not claim success when the audit trail could not be written.
      await supabaseServer
        .from("inventory_items")
        .update({ current_quantity: currentQuantity, updated_at: timestamp })
        .eq("id", inventoryItemId)
        .eq("company_id", companyId);
      throw movementError;
    }

    return NextResponse.json({ success: true, data: { new_quantity: newQuantity } });
  } catch (error) {
    console.error("Inventory POST error:", error);
    return NextResponse.json(
      { success: false, error: "تعذر تنفيذ عملية المخزون." },
      { status: 500 }
    );
  }
}
