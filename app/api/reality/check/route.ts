import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * GET /api/reality/check?sessionId=xxx
 * يسأله متصفح الزائر كل 3 ثوانٍ للتحقق من وجود أوامر جديدة.
 * يُعيد أحدث mutation غير منفذة ثم يضعها كـ "consumed".
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ mutation: null });

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ mutation: null });

  // جلب أحدث mutation لم يُنفَّذ بعد (في آخر 5 دقائق)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("reality_mutations")
    .select("*")
    .eq("session_id", sessionId)
    .eq("active", true)
    .gte("created_at", fiveMinutesAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return NextResponse.json({ mutation: null });

  // اجعلها غير نشطة (consumed) حتى لا تتكرر
  await supabase
    .from("reality_mutations")
    .update({ active: false })
    .eq("id", data.id);

  return NextResponse.json({ mutation: data });
}
