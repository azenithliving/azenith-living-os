import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { sendSecurityAlert } from "@/lib/telegram-notify";

/**
 * Store public key for digital signature verification
 * Can only be done once per user after 2FA is enabled
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // التحقق من المصادقة
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Please login first" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { publicKey, keyType = "Ed25519" } = body;

    if (!publicKey || typeof publicKey !== "string") {
      return NextResponse.json(
        { error: "Public key is required" },
        { status: 400 }
      );
    }

    // التحقق من أن 2FA مفعل
    const { data: user2FA, error: faError } = await supabase
      .from("user_2fa")
      .select("is_enabled")
      .eq("user_id", user.id)
      .single();

    if (faError || !user2FA?.is_enabled) {
      return NextResponse.json(
        { error: "2FA must be enabled before setting up digital signatures" },
        { status: 400 }
      );
    }

    // التحقق من عدم وجود مفتاح عام مسبقاً (يمكن فقط مرة واحدة)
    const { data: existingKey } = await supabase
      .from("user_public_keys")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (existingKey) {
      return NextResponse.json(
        { 
          error: "Public key already exists. Contact system administrator to reset.",
          code: "KEY_EXISTS"
        },
        { status: 409 }
      );
    }

    // التحقق من صيغة المفتاح (Base64)
    try {
      atob(publicKey);
    } catch {
      return NextResponse.json(
        { error: "Invalid public key format. Must be Base64 encoded." },
        { status: 400 }
      );
    }

    // حفظ المفتاح العام
    const { error: insertError } = await supabase
      .from("user_public_keys")
      .insert({
        user_id: user.id,
        public_key: publicKey,
        key_type: keyType,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Public key storage error:", insertError);
      return NextResponse.json(
        { error: "Failed to store public key" },
        { status: 500 }
      );
    }

    // إرسال إشعار أمني
    await sendSecurityAlert(
      `🔐 DIGITAL SIGNATURE KEY REGISTERED\n` +
      `User: ${user.email}\n` +
      `Key Type: ${keyType}\n` +
      `Time: ${new Date().toISOString()}\n` +
      `IP: ${request.headers.get("x-forwarded-for") || "unknown"}\n\n` +
      `✅ All commands will now require digital signatures.`
    );

    return NextResponse.json({
      success: true,
      message: "Public key registered successfully. Digital signatures are now required for all commands.",
      keyType,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Public Key Registration Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Get user's public key (for verification purposes)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: publicKeyData, error } = await supabase
      .from("user_public_keys")
      .select("public_key, key_type, created_at")
      .eq("user_id", user.id)
      .single();

    if (error || !publicKeyData) {
      return NextResponse.json(
        { hasKey: false },
        { status: 200 }
      );
    }

    return NextResponse.json({
      hasKey: true,
      publicKey: publicKeyData.public_key,
      keyType: publicKeyData.key_type,
      createdAt: publicKeyData.created_at,
    });

  } catch (error) {
    console.error("Get Public Key Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
