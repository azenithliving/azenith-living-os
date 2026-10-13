/**
 * app/api/admin/numbers — the owner's own numbers, saved in one place.
 *
 * He asked (2026-10-13) to change the store's number from the dashboard and to keep more than one,
 * with all of them applying to the whole site. This door is the only writer of that list: it accepts
 * the whole list at once, refuses anything that is not a dialable number, refuses an empty list, and
 * keeps exactly one primary — the number a customer's button opens.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiAccess, AdminApiAuthError } from "@/lib/admin-api-auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getStoreNumbers, normalizeWhatsApp, NUMBERS_KEY, type StoreNumber } from "@/lib/store-numbers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function refuseAuth(error: unknown) {
  if (error instanceof AdminApiAuthError) {
    return NextResponse.json({ success: false, error: "لازم تكون داخل بحسابك عشان تعدّل الأرقام" }, { status: error.status });
  }
  throw error;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
  } catch (error) {
    return refuseAuth(error);
  }
  const numbers = await getStoreNumbers();
  return NextResponse.json({ success: true, numbers, readback: numbers.length });
}

/** The list arrives whole: one save, one read-back, no half-written contact card. */
export async function POST(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
  } catch (error) {
    return refuseAuth(error);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "طلب غير مفهوم" }, { status: 400 });
  }

  const incoming = Array.isArray(body.numbers) ? (body.numbers as Record<string, unknown>[]) : [];
  const cleaned: StoreNumber[] = [];
  for (const item of incoming) {
    const value = normalizeWhatsApp(item?.value);
    if (!value) continue;
    if (cleaned.some((n) => n.value === value)) continue;
    const label = typeof item.label === "string" && item.label.trim() ? item.label.trim().slice(0, 40) : "رقم المتجر";
    cleaned.push({ value, label, primary: item.primary === true });
  }

  if (cleaned.length === 0) {
    return NextResponse.json({ success: false, error: "مفيش رقم صحيح في القائمة — رقم واحد على الأقل لازم يفضل" }, { status: 400 });
  }
  if (!cleaned.some((n) => n.primary)) cleaned[0].primary = true;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ success: false, error: "المتجر غير متصل دلوقتي" }, { status: 503 });

  const { error } = await supabase.from("site_settings").upsert(
    { key: NUMBERS_KEY, value: cleaned },
    { onConflict: "key" }
  );
  if (error) {
    return NextResponse.json({ success: false, error: "الأرقام ما اتسجلّتش — السجل رفض" }, { status: 500 });
  }

  const stored = await getStoreNumbers();
  return NextResponse.json({ success: true, numbers: stored, wrote: cleaned.length, stored: stored.length });
}
