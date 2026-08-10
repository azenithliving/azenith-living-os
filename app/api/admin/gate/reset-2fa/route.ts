import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  normalizeAdminEmail,
  validateAdminGateCredentials,
  getPrimaryAdminLegacy2FASecret,
} from "@/lib/admin-gate";
import { normalizeBase32Secret } from "@/lib/totp-verify";

/**
 * POST /api/admin/gate/reset-2fa
 *
 * Secure one-shot endpoint: validates admin credentials then wipes any
 * stale user_2fa record and re-syncs it from ADMIN_GATE_2FA_SECRET.
 * Call this once when the Google Authenticator code keeps failing in
 * production (caused by a DB secret that diverged from the ENV secret).
 *
 * Body: { email: string; password: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    // 1. Validate admin credentials against ENV — no DB shortcut.
    if (!validateAdminGateCredentials(email, password)) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const envSecret = getPrimaryAdminLegacy2FASecret();
    if (!envSecret) {
      return NextResponse.json(
        { success: false, error: "ADMIN_GATE_2FA_SECRET is not configured in environment" },
        { status: 500 }
      );
    }

    const normalizedEmail = normalizeAdminEmail(email);
    const normalizedSecret = normalizeBase32Secret(envSecret);

    // 2. Resolve admin user ID from Supabase Auth.
    const supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: "Supabase admin client not available" },
        { status: 500 }
      );
    }

    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      return NextResponse.json(
        { success: false, error: "Failed to list users" },
        { status: 500 }
      );
    }

    const adminUser = usersData.users.find(
      (u) => normalizeAdminEmail(u.email || "") === normalizedEmail
    );

    const supabase = await createClient();

    // 3. Delete any existing stale user_2fa record(s) for this admin.
    const deleteByEmail = await supabase
      .from("user_2fa")
      .delete()
      .eq("email", normalizedEmail);

    if (adminUser) {
      await supabase
        .from("user_2fa")
        .delete()
        .eq("user_id", adminUser.id);
    }

    // 4. Insert a clean record synced directly from the ENV secret.
    const upsertPayload: Record<string, unknown> = {
      email: normalizedEmail,
      secret: normalizedSecret,
      is_enabled: true,
      backup_codes: [],
      updated_at: new Date().toISOString(),
    };

    if (adminUser) {
      upsertPayload.user_id = adminUser.id;
    }

    const { error: insertError } = await supabase
      .from("user_2fa")
      .insert(upsertPayload);

    if (insertError) {
      // Fallback to upsert in case of unique constraint conflict.
      const { error: upsertError } = await supabase
        .from("user_2fa")
        .upsert(upsertPayload, { onConflict: "email" });

      if (upsertError) {
        return NextResponse.json(
          { success: false, error: `DB write failed: ${upsertError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message:
        "2FA record has been reset and synced from ADMIN_GATE_2FA_SECRET. " +
        "You can now log in with your Google Authenticator code.",
      email: normalizedEmail,
      secretLength: normalizedSecret.length,
      userId: adminUser?.id ?? null,
      deletedByEmail: !deleteByEmail.error,
    });
  } catch (error) {
    console.error("[gate/reset-2fa]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
