import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * Attaching an order to the human who placed it.
 *
 * The order ledger stores a typed name and no handle, so no machine may decide whose money
 * a row is: measured on the live store, three of five orders carry a name and none of those
 * names matches a profile. The owner links them with his own eyes, and this door writes the
 * one column that decision needs — nothing else, not even `updated_at`, because attaching
 * a receipt is not the customer doing something new.
 *
 * It refuses anything that is not a real identifier on both sides, so a typo can never
 * point an order at a ghost.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const body = (await request.json().catch(() => null)) as { orderId?: unknown; userId?: unknown } | null;
    const orderId = body?.orderId;
    const userId = body?.userId ?? null;

    if (typeof orderId !== "string" || !UUID.test(orderId)) {
      return NextResponse.json({ error: "رقم الأمر مش مفهوم — اكتب من القايمة" }, { status: 400 });
    }
    if (userId !== null && (typeof userId !== "string" || !UUID.test(userId))) {
      return NextResponse.json({ error: "رقم العميل مش مفهوم — اختاره من القايمة" }, { status: 400 });
    }

    const client = getSupabaseAdminClient();
    if (!client) {
      return NextResponse.json({ error: "الدفتر مش متصل دلوقتى" }, { status: 500 });
    }

    const order = await client.from("sales_orders").select("id").eq("id", orderId).maybeSingle();
    if (!order.data) {
      return NextResponse.json({ error: "الأمر ده مش موجود فى الدفتر" }, { status: 404 });
    }

    if (userId) {
      const profile = await client.from("users").select("id").eq("id", userId).maybeSingle();
      if (!profile.data) {
        return NextResponse.json({ error: "العميل ده مش مسجل — ما ينفعش نربط فلوس بحد مش موجود" }, { status: 400 });
      }
    }

    const saved = await client
      .from("sales_orders")
      .update({ user_id: userId })
      .eq("id", orderId)
      .select("id,user_id")
      .single();

    if (saved.error || !saved.data) {
      return NextResponse.json({ error: "الربط ما اتكتبش", detail: saved.error?.message ?? "لا سطر رجع" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, order: saved.data });
  } catch (error) {
    console.error("[Order owner] API Error:", error);
    return NextResponse.json({ error: "حصل خطأ غير متوقع — الأمر ما اتغيّرش" }, { status: 500 });
  }
}
