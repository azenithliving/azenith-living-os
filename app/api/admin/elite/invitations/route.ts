import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";
import { generateEliteLoginToken } from "@/lib/elite/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type ClientAccessRecord = {
  id: string;
  phone: string;
  access_status: "pending" | "active" | "suspended" | "expired";
  expires_at: string | null;
  subscription_active: boolean;
  request_id: string | null;
  created_at: string;
  updated_at: string;
};

function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const digits = value.replace(/\D/g, "");
  // E.164 numbers contain at most 15 digits.  We store only the digits so
  // WhatsApp links and database comparisons have a single canonical form.
  if (digits.length < 8 || digits.length > 15) return null;

  return digits;
}

function serviceUnavailable() {
  return NextResponse.json(
    { success: false, error: "خدمة دعوات النخبة غير مهيأة في هذا البيئة." },
    { status: 503 }
  );
}

/** List the real Elite access records available to an authenticated admin. */
export async function GET() {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return serviceUnavailable();

  const { data, error } = await supabase
    .from("client_access")
    .select("id, phone, access_status, expires_at, subscription_active, request_id, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[Elite invitations] Could not load access records:", error);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل سجلات وصول النخبة." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: (data ?? []) as ClientAccessRecord[] });
}

/**
 * Create an approved client-access record or issue a one-time invitation URL.
 * Delivery remains a human action until an actual WhatsApp/email provider is
 * configured; this endpoint never claims to have sent a message.
 */
export async function POST(request: NextRequest) {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return serviceUnavailable();

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid body");
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "بيانات الطلب غير صالحة." }, { status: 400 });
  }

  if (body.action === "create") {
    const phone = normalizePhone(body.phone);
    const accessStatus = body.access_status === "active" ? "active" : "pending";

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "أدخل رقم هاتف صالحًا بصيغة دولية." },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("client_access")
      .select("id")
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("[Elite invitations] Could not check existing access:", existingError);
      return NextResponse.json({ success: false, error: "تعذر التحقق من سجل العميل." }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json(
        { success: false, error: "يوجد سجل وصول لهذا الرقم بالفعل. أصدر الدعوة من السجل الموجود." },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from("client_access")
      .insert({
        phone,
        access_status: accessStatus,
        subscription_active: false,
      })
      .select("id, phone, access_status, expires_at, subscription_active, request_id, created_at, updated_at")
      .single();

    if (error || !data) {
      console.error("[Elite invitations] Could not create access record:", error);
      return NextResponse.json({ success: false, error: "تعذر إنشاء سجل وصول النخبة." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data as ClientAccessRecord }, { status: 201 });
  }

  if (body.action === "issue") {
    const clientAccessId = typeof body.client_access_id === "string" ? body.client_access_id : "";
    if (!clientAccessId) {
      return NextResponse.json({ success: false, error: "معرف سجل العميل مطلوب." }, { status: 400 });
    }

    try {
      const { token, expiresAt } = await generateEliteLoginToken(clientAccessId);
      const invitationUrl = new URL("/elite", request.url);
      invitationUrl.searchParams.set("token", token);

      return NextResponse.json({
        success: true,
        invitationUrl: invitationUrl.toString(),
        expiresAt: expiresAt.toISOString(),
        delivery: "manual",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر إصدار الدعوة.";
      const status = message.includes("not found") || message.includes("not eligible") ? 400 : 500;
      return NextResponse.json({ success: false, error: message }, { status });
    }
  }

  return NextResponse.json({ success: false, error: "الإجراء المطلوب غير مدعوم." }, { status: 400 });
}
