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
    const { backupCode, confirmDisable = false } = body;

    // جلب بيانات 2FA للمستخدم
    const { data: user2FA, error: fetchError } = await supabase
      .from("user_2fa")
      .select("secret, is_enabled, backup_codes")
      .eq("user_id", user.id)
      .single();

    if (fetchError || !user2FA || !user2FA.is_enabled) {
      return NextResponse.json(
        { error: "2FA is not enabled for this user" },
        { status: 400 }
      );
    }

    // التحقق من صحة رمز الاحتياطي
    if (!backupCode || !user2FA.backup_codes.includes(backupCode.toUpperCase())) {
      // تسجيل محاولة فاشلة
      await supabase.from("failed_login_attempts").insert({
        email: user.email,
        ip_address: request.headers.get("x-forwarded-for") || "unknown",
        failure_reason: "Invalid backup code for 2FA disable",
        user_agent: request.headers.get("user-agent"),
      });

      await sendSecurityAlert(
        `⚠️ INVALID 2FA DISABLE ATTEMPT\n` +
        `User: ${user.email}\n` +
        `Time: ${new Date().toISOString()}\n` +
        `IP: ${request.headers.get("x-forwarded-for") || "unknown"}`
      );

      return NextResponse.json(
        { error: "Invalid backup code. This incident has been logged." },
        { status: 400 }
      );
    }

    if (!confirmDisable) {
      return NextResponse.json({
        requiresConfirmation: true,
        warning: "Disabling 2FA will significantly reduce your account security. Are you sure?",
      });
    }

    // حذف إعدادات 2FA
    const { error: deleteError } = await supabase
      .from("user_2fa")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to disable 2FA" },
        { status: 500 }
      );
    }

    // حذف المفتاح العام المرتبط أيضاً (للأمان)
    await supabase
      .from("user_public_keys")
      .delete()
      .eq("user_id", user.id);

    // حذف الجلسات السيادية
    await supabase
      .from("sovereign_sessions")
      .delete()
      .eq("user_id", user.id);

    // إرسال إشعار أمني عالي الأهمية
    await sendSecurityAlert(
      `🚨 2FA DISABLED - CRITICAL SECURITY ALERT\n` +
      `User: ${user.email}\n` +
      `Time: ${new Date().toISOString()}\n` +
      `IP: ${request.headers.get("x-forwarded-for") || "unknown"}\n\n` +
      `⚠️ WARNING: Account security has been reduced!`
    );

    return NextResponse.json({
      success: true,
      message: "2FA has been disabled. All security keys have been cleared.",
      warning: "Your account is now less secure. Please re-enable 2FA as soon as possible.",
    });

  } catch (error) {
    console.error("2FA Disable Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
