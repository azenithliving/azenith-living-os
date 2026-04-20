import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * GET /api/admin/fate/latest
 * يُعيد آخر "أمر قدر" نشط في آخر 10 دقائق (Global - ليس لجلسة بعينها).
 * يستخدمه ConsultantWidget لبناء رسالة ترحيبية استباقية ومخصصة.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ action: null });
    }

    // جلب أحدث أمر قدر في آخر 10 دقائق
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("reality_mutations")
      .select("action, created_at")
      .eq("active", true)
      .gte("created_at", tenMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json({ action: null });
    }

    return NextResponse.json({ action: data.action });
  } catch {
    return NextResponse.json({ action: null });
  }
}
