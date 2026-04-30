import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // التحقق من المصادقة
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // جلب حالة 2FA
    const { data: user2FA, error: fetchError } = await supabase
      .from("user_2fa")
      .select("is_enabled, created_at, updated_at")
      .eq("user_id", user.id)
      .single();

    // جلب حالة المفتاح العام
    const { data: publicKey, error: keyError } = await supabase
      .from("user_public_keys")
      .select("created_at")
      .eq("user_id", user.id)
      .single();

    return NextResponse.json({
      enabled: user2FA?.is_enabled || false,
      setupDate: user2FA?.created_at,
      lastUpdated: user2FA?.updated_at,
      hasPublicKey: !!publicKey,
      publicKeyDate: publicKey?.created_at,
      user: {
        id: user.id,
        email: user.email,
      },
    });

  } catch (error) {
    console.error("2FA Status Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
