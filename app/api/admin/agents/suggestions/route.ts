/**
 * GET  /api/admin/agents/suggestions  — جلب الاقتراحات المعلقة
 * POST /api/admin/agents/suggestions  — تنفيذ أو رفض اقتراح
 *
 * وسيط داخلي يمرر الطلب لـ /api/omnipotent مع الـ INTERNAL_API_KEY
 * مما يتيح استدعاءه من الـ client بأمان بدون كشف المفتاح
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || "";
const BASE_URL     = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function callOmnipotent(body: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/api/omnipotent`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Key": INTERNAL_KEY,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── GET: جلب الاقتراحات المعلقة ──────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    // تحقق بسيط من الجلسة
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const data = await callOmnipotent({ action: "suggestions" });

    return NextResponse.json({
      success: data.success ?? true,
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    });
  } catch (error) {
    console.error("[suggestions GET]", error);
    return NextResponse.json({ success: false, suggestions: [] });
  }
}

// ── POST: تنفيذ أو رفض اقتراح ────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body                      = await request.json();
    const { suggestion_id, action, reason } = body as {
      suggestion_id: string;
      action: "execute" | "reject";
      reason?: string;
    };

    if (!suggestion_id || !action) {
      return NextResponse.json(
        { success: false, error: "suggestion_id و action مطلوبان" },
        { status: 400 }
      );
    }

    const data = await callOmnipotent({
      action:       action === "execute" ? "execute" : "reject",
      suggestionId: suggestion_id,
      userId:       user.email || user.id,
      reason,
    });

    return NextResponse.json({ success: data.success ?? false, ...data });
  } catch (error) {
    console.error("[suggestions POST]", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "خطأ" },
      { status: 500 }
    );
  }
}
