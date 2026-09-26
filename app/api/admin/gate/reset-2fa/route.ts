import { NextRequest, NextResponse } from "next/server";
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

    // The record is keyed by the auth account, so a reset without one has
    // nothing to write. Saying so beats inserting a row no login can read.
    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: "No auth account for this email yet — sign in through the gate once first" },
        { status: 409 }
      );
    }

    // This runs before any session exists, so only the service-role client can
    // write the row — an anonymous one is refused by the policies and a reset
    // that reports success while writing nothing is worse than an error.
    const supabase = supabaseAdmin;

    // 3. Drop the stale record, then re-enrol it from the configured key.
    await supabase.from("user_2fa").delete().eq("user_id", adminUser.id);

    const { error: upsertError } = await supabase
      .from("user_2fa")
      .upsert(
        {
          user_id: adminUser.id,
          secret: normalizedSecret,
          is_enabled: true,
          backup_codes: [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      return NextResponse.json(
        { success: false, error: `DB write failed: ${upsertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "2FA record has been reset and synced from ADMIN_GATE_2FA_SECRET. " +
        "You can now log in with your Google Authenticator code.",
      email: normalizedEmail,
      userId: adminUser.id,
    });
  } catch (error) {
    console.error("[gate/reset-2fa]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
