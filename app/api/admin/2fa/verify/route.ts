import { NextRequest, NextResponse } from "next/server";
import speakeasy from "speakeasy";
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

    const body = await request.json();
    const { token, isLoginVerification = false } = body;

    if (!token || token.length !== 6) {
      return NextResponse.json(
        { error: "Invalid token format. Must be 6 digits." },
        { status: 400 }
      );
    }

    // جلب بيانات 2FA للمستخدم
    const { data: user2FA, error: fetchError } = await supabase
      .from("user_2fa")
      .select("secret, is_enabled, backup_codes")
      .eq("user_id", user.id)
      .single();

    if (fetchError || !user2FA) {
      return NextResponse.json(
        { error: "2FA not setup for this user" },
        { status: 400 }
      );
    }

    // التحقق من الرمز باستخدام speakeasy
    const verified = speakeasy.totp.verify({
      secret: user2FA.secret,
      encoding: "base32",
      token: token,
      window: 2, // نافذة زمنية متساهلة (±1 دقيقة)
    });

    if (!verified) {
      // تسجيل محاولة فاشلة
      await supabase.from("failed_login_attempts").insert({
        email: user.email,
        ip_address: request.headers.get("x-forwarded-for") || "unknown",
        failure_reason: "Invalid 2FA token",
        user_agent: request.headers.get("user-agent"),
      });

      return NextResponse.json(
        { error: "Invalid 2FA token. Please try again." },
        { status: 400 }
      );
    }

    // إذا كانت عملية تفعيل أولية
    if (!user2FA.is_enabled && !isLoginVerification) {
      // تفعيل 2FA
      const { error: updateError } = await supabase
        .from("user_2fa")
        .update({
          is_enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to enable 2FA" },
          { status: 500 }
        );
      }

      // إرسال إشعار أمني
      await sendSecurityAlert(
        `✅ 2FA ENABLED SUCCESSFULLY\n` +
        `User: ${user.email}\n` +
        `Time: ${new Date().toISOString()}\n` +
        `IP: ${request.headers.get("x-forwarded-for") || "unknown"}`
      );

      return NextResponse.json({
        success: true,
        message: "2FA enabled successfully!",
        enabled: true,
      });
    }

    // إذا كانت عملية تحقق من الدخول
    if (isLoginVerification) {
      // إنشاء جلسة سيادية مُعززة
      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 8); // صلاحية 8 ساعات

      await supabase.from("sovereign_sessions").insert({
        user_id: user.id,
        session_token: sessionToken,
        is_2fa_verified: true,
        ip_address: request.headers.get("x-forwarded-for") || "unknown",
        user_agent: request.headers.get("user-agent"),
        expires_at: expiresAt.toISOString(),
      });

      // إرسال إشعار أمني
      await sendSecurityAlert(
        `🔓 ADMIN LOGIN WITH 2FA\n` +
        `User: ${user.email}\n` +
        `Time: ${new Date().toISOString()}\n` +
        `IP: ${request.headers.get("x-forwarded-for") || "unknown"}`
      );

      return NextResponse.json({
        success: true,
        message: "2FA verified successfully!",
        sessionToken: sessionToken,
        expiresAt: expiresAt.toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: "Token verified",
    });

  } catch (error) {
    console.error("2FA Verify Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
