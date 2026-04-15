import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, preferences, aiAnalysis, source } = body;

    // Validate required fields
    if (!name || !phone) {
      return NextResponse.json(
        { ok: false, message: "الاسم ورقم الهاتف مطلوبان" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Insert into elite_briefs table
    const { data, error } = await supabase
      .from("elite_briefs")
      .insert({
        name,
        email: email || null,
        phone,
        preferences: preferences || {},
        ai_analysis: aiAnalysis || null,
        source: source || "virtual_designer",
        status: "new",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[Elite Brief API] Supabase error:", error);
      
      // If table doesn't exist, try leads table as fallback
      if (error.message.includes("does not exist")) {
        const { data: leadData, error: leadError } = await supabase
          .from("leads")
          .insert({
            name,
            email: email || null,
            phone,
            message: JSON.stringify({
              preferences,
              aiAnalysis,
              source: source || "virtual_designer",
            }),
            status: "new",
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (leadError) {
          console.error("[Elite Brief API] Leads fallback error:", leadError);
          return NextResponse.json(
            { ok: false, message: "فشل حفظ البيانات" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          ok: true,
          id: leadData.id,
          message: "تم حفظ البيانات بنجاح",
        });
      }

      return NextResponse.json(
        { ok: false, message: "فشل حفظ البيانات" },
        { status: 500 }
      );
    }

    // TODO: Send notification to admin (WhatsApp or email)
    // This can be implemented using the existing notification system

    return NextResponse.json({
      ok: true,
      id: data.id,
      message: "تم حفظ البيانات بنجاح",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[Elite Brief API] Error:", message);

    return NextResponse.json(
      { ok: false, message: "حدث خطأ غير متوقع" },
      { status: 500 }
    );
  }
}
