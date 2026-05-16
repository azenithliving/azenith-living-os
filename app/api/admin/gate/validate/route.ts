import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  normalizeAdminEmail,
  validateAdminGateCredentials,
  isAdminGateConfigured,
} from "@/lib/admin-gate";

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

    const supabase = await createClient();
    const normalizedEmail = normalizeAdminEmail(email);

    let { error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (authError && isAdminGateConfigured()) {
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

    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[gate/validate]", error);
    return NextResponse.json(
      { success: false, error: "خطأ داخلي" },
      { status: 500 }
    );
  }
}
