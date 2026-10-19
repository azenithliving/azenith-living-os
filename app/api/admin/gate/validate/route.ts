import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  normalizeAdminEmail,
  validateAdminGateCredentials,
  isAdminGateConfigured,
  adminGateRequires2FA,
} from "@/lib/admin-gate";
import { sendSecurityAlert } from "@/lib/telegram-notify";
import { telegramAlert, telegramTime } from "@/lib/telegram-copy";

async function ensurePrimaryAdminAuthUser(email: string, password: string) {
  if (!validateAdminGateCredentials(email, password)) {
    return { success: false as const };
  }

  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) return { success: false as const };

  const normalizedEmail = normalizeAdminEmail(email);
  const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) return { success: false as const };

  const existingUser = usersData.users.find(
    (user) => normalizeAdminEmail(user.email || "") === normalizedEmail
  );

  if (!existingUser) {
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { role: "master_admin", is_primary_admin: true },
    });
    return { success: !createError };
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
    password,
    email_confirm: true,
  });
  return { success: !updateError };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "البريد الإلكتروني وكلمة المرور مطلوبان" },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeAdminEmail(email);

    // This is an administration gate, not a general account-login endpoint.
    // Never allow another authenticated Supabase user to pass it merely by
    // having their own password.
    if (!isAdminGateConfigured() || !validateAdminGateCredentials(normalizedEmail, password)) {
      return NextResponse.json(
        { success: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    let { error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (authError) {
      const provisioned = await ensurePrimaryAdminAuthUser(normalizedEmail, password);
      if (provisioned.success) {
        const retry = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        authError = retry.error;
      }
    }

    if (authError) {
      return NextResponse.json(
        { success: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }

    // Owner's word 2026-10-19: his phone was lost and the verification code locked him out of his own
    // dashboard, so he ordered the second step off. When the store says so, this door leaves the
    // session standing instead of signing out — records how the door was really opened, and tells him
    // on Telegram, because a factor that is off should never be quiet about being off.
    if (!(await adminGateRequires2FA())) {
      const { data: me } = await supabase.auth.getUser();
      const adminClient = getSupabaseAdminClient();
      if (me?.user?.id && adminClient) {
        await adminClient.from("sovereign_sessions").insert({
          user_id: me.user.id,
          session_token: crypto.randomUUID(),
          is_2fa_verified: false,
          ip_address: request.headers.get("x-forwarded-for") || "unknown",
          user_agent: request.headers.get("user-agent"),
          expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        });
      }
      await sendSecurityAlert(
        telegramAlert("🔓", "دخول المدير بكلمة السر فقط — كود التحقق مقفول بأمره", [
          ["المستخدم", normalizedEmail],
          ["الوقت", telegramTime()],
          ["العنوان", request.headers.get("x-forwarded-for") || "غير معروف"],
        ])
      );
      console.log("[gate] الدخول اكتمل بكلمة السر وحدها — كود التحقق مقفول في إعدادات المتجر");
      return NextResponse.json({ success: true, signedIn: true });
    }

    await supabase.auth.signOut();

    return NextResponse.json({ success: true, signedIn: false });
  } catch (error) {
    console.error("[gate/validate]", error);
    return NextResponse.json(
      { success: false, error: "خطأ داخلي" },
      { status: 500 }
    );
  }
}
