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

    // Two drawers, and three answers each: it answered and found nothing, it answered and found
    // something, or it refused. The third is not a «no» — measured 2026-11-06 on the published site,
    // this door reported `hasPublicKey:false` while the record had never heard of the table at all,
    // because the refusal was read into a variable and dropped.
    const { data: user2FA, error: fetchError } = await supabase
      .from("user_2fa")
      .select("is_enabled, created_at, updated_at")
      .eq("user_id", user.id)
      .single();

    const { data: publicKey, error: keyError } = await supabase
      .from("user_public_keys")
      .select("created_at")
      .eq("user_id", user.id)
      .single();

    if (fetchError) console.error("[2FA Status] code drawer refused:", fetchError);
    if (keyError) console.error("[2FA Status] keys drawer refused:", keyError);

    const twoFactorState = fetchError ? "not-measured" : user2FA?.is_enabled ? "on" : "off";
    const publicKeyState = keyError ? "not-measured" : publicKey ? "enrolled" : "none";

    const body: Record<string, unknown> = {
      twoFactorState,
      publicKeyState,
      setupDate: user2FA?.created_at ?? null,
      lastUpdated: user2FA?.updated_at ?? null,
      user: {
        id: user.id,
        email: user.email,
      },
    };

    if (twoFactorState === "not-measured") {
      body.twoFactorNote = "المخزن ما ردّش على دفتر التحقق بالكود — فالحالة دي ما اتقارش، مش «مقفول»";
    } else {
      body.enabled = twoFactorState === "on";
    }

    if (publicKeyState === "not-measured") {
      body.publicKeyNote = "المخزن ما ردّش على دفتر مفاتيح الدخول — يعني المكتب ما اتركّبش، مش إن مفيش مفتاح";
    } else {
      body.hasPublicKey = publicKeyState === "enrolled";
      body.publicKeyDate = publicKey?.created_at ?? null;
    }

    return NextResponse.json(body);

  } catch (error) {
    console.error("2FA Status Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
