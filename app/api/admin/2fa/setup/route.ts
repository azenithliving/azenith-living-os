import { NextRequest, NextResponse } from "next/server";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { createClient } from "@/utils/supabase/server";
import { sendSecurityAlert } from "@/lib/telegram-notify";

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

    // التحقق من عدم وجود 2FA مفعل مسبقاً
    const { data: existing2FA } = await supabase
      .from("user_2fa")
      .select("is_enabled")
      .eq("user_id", user.id)
      .single();

    if (existing2FA?.is_enabled) {
      return NextResponse.json(
        { error: "2FA is already enabled. Disable it first to reconfigure." },
        { status: 400 }
      );
    }

    // توليد سر جديد للـ 2FA
    const secret = speakeasy.generateSecret({
      name: "AZENITH_SOVEREIGN",
      length: 32,
    });

    // A backup code is worth the same as the second factor, so it comes from a
    // CSPRNG — `Math.random` output is predictable.
    const BACKUP_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    const backupCodes = Array.from({ length: 10 }, () =>
      Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) =>
        BACKUP_ALPHABET[byte % BACKUP_ALPHABET.length]
      ).join("")
    );

    // Save the secret (not enabled yet). The unique key is `user_id`, not `id`,
    // so without the conflict target this reads as an insert and collides.
    const { error: insertError } = await supabase
      .from("user_2fa")
      .upsert(
        {
          user_id: user.id,
          secret: secret.base32,
          is_enabled: false,
          backup_codes: backupCodes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (insertError) {
      console.error("2FA Setup Error:", insertError);
      return NextResponse.json(
        { error: "Failed to setup 2FA" },
        { status: 500 }
      );
    }

    // توليد QR Code
    const otpauthUrl = secret.otpauth_url || 
      `otpauth://totp/AZENITH_SOVEREIGN:${user.email}?secret=${secret.base32}&issuer=AZENITH_SOVEREIGN`;
    
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // إرسال إشعار أمني
    await sendSecurityAlert(
      `🔐 2FA Setup Initiated\n` +
      `User: ${user.email}\n` +
      `Time: ${new Date().toISOString()}\n` +
      `IP: ${request.headers.get("x-forwarded-for") || "unknown"}`
    );

    return NextResponse.json({
      success: true,
      qrCode: qrCodeDataUrl,
      backupCodes: backupCodes,
      secret: secret.base32, // للاستخدام اليدوي إذا فشل QR
      message: "Scan the QR code with your authenticator app and verify to enable 2FA",
    });

  } catch (error) {
    console.error("2FA Setup Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
