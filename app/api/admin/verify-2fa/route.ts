import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { sendSecurityAlert } from "@/lib/telegram-notify";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getPrimaryAdminLegacy2FASecret,
  normalizeAdminEmail,
  validateAdminGateCredentials,
} from "@/lib/admin-gate";
import {
  collectUniqueTotpSecrets,
  normalizeBase32Secret,
  normalizeTotpToken,
  verifyTotpAgainstSecrets,
} from "@/lib/totp-verify";

type User2FARecord = {
  secret: string;
  is_enabled: boolean;
  backup_codes: string[];
};

function isPrimaryAdminCredentials(email: string, password: string) {
  return validateAdminGateCredentials(email, password);
}

async function ensurePrimaryAdminAuthUser(email: string, password: string) {
  if (!isPrimaryAdminCredentials(email, password)) {
    return { success: false as const, error: "unauthorized_credentials" };
  }

  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) {
    return { success: false as const, error: "missing_service_role" };
  }

  const normalizedEmail = normalizeAdminEmail(email);
  const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    return { success: false as const, error: "list_users_failed" };
  }

  const existingUser = usersData.users.find((user) => normalizeAdminEmail(user.email || "") === normalizedEmail);

  if (!existingUser) {
    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        role: "master_admin",
        is_primary_admin: true,
      },
    });

    if (createError || !createdUser.user) {
      return { success: false as const, error: "create_user_failed" };
    }

    return { success: true as const, userId: createdUser.user.id };
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
    password,
    email_confirm: true,
    user_metadata: {
      ...(existingUser.user_metadata && typeof existingUser.user_metadata === "object" ? existingUser.user_metadata : {}),
      role: "master_admin",
      is_primary_admin: true,
    },
  });

  if (updateError) {
    return { success: false as const, error: "update_user_failed" };
  }

  return { success: true as const, userId: existingUser.id };
}

async function resolveUser2FARecord(userId: string): Promise<User2FARecord | null> {
  const supabaseAdmin = getSupabaseAdminClient();
  const client = supabaseAdmin ?? (await createClient());

  const { data } = await client
    .from("user_2fa")
    .select("secret, is_enabled, backup_codes")
    .eq("user_id", userId)
    .maybeSingle();

  return data as User2FARecord | null;
}

async function syncPrimaryAdmin2FASecret(userId: string, secret?: string) {
  const envSecret = secret || getPrimaryAdminLegacy2FASecret();
  if (!envSecret) return;

  const supabaseAdmin = getSupabaseAdminClient();
  const client = supabaseAdmin ?? (await createClient());

  // `user_id` is unique while `id` is the primary key, so an upsert has to be
  // told which key it resolves — otherwise it is an insert that collides.
  await client.from("user_2fa").upsert(
    {
      user_id: userId,
      secret: normalizeBase32Secret(envSecret),
      is_enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

async function ensurePrimaryAdmin2FARecord(userId: string): Promise<User2FARecord | null> {
  const envSecret = getPrimaryAdminLegacy2FASecret();
  if (!envSecret) return null;
  await syncPrimaryAdmin2FASecret(userId, envSecret);
  return {
    secret: normalizeBase32Secret(envSecret),
    is_enabled: true,
    backup_codes: [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    const token = normalizeTotpToken(String(body.token ?? ""));

    if (token.length !== 6) {
      return NextResponse.json(
        { error: "Invalid token format. Must be 6 digits." },
        { status: 400 }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const normalizedEmail = normalizeAdminEmail(email);

    // 2FA completion is restricted to the same configured administrative
    // account as the first login step; an arbitrary Supabase account cannot
    // turn its own TOTP configuration into admin access.
    if (!isPrimaryAdminCredentials(normalizedEmail, String(password))) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Step 1: Sign in with email and password
    let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (authError || !authData.user) {
      const provisionResult = await ensurePrimaryAdminAuthUser(normalizedEmail, password);
      if (provisionResult.success) {
        const retry = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        authData = retry.data;
        authError = retry.error;
      }

      if (authError || !authData?.user) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }
    }

    // Signing in above already wrote a Supabase session into the response
    // cookies, and the guard authorizes an admin from that session alone — it
    // never reads `admin_2fa_verified`. So every path below that refuses the
    // second factor has to take the session back, or a correct password is a
    // complete login with the TOTP step answered "no".
    const revokeUnverifiedSession = async () => {
      try {
        await supabase.auth.signOut();
      } catch {
        /* the refusal below is what matters */
      }
    };

    const user = authData.user;
    const isPrimaryAdmin = isPrimaryAdminCredentials(normalizedEmail, password);

    // Step 2: Fetch 2FA data — provision from env for primary admin if missing
    let user2FA = await resolveUser2FARecord(user.id);
    if (!user2FA && isPrimaryAdmin) {
      user2FA = await ensurePrimaryAdmin2FARecord(user.id);
    }

    if (!user2FA) {
      await revokeUnverifiedSession();
      return NextResponse.json(
        { error: "2FA not setup for this user" },
        { status: 400 }
      );
    }

    if (!user2FA.is_enabled && isPrimaryAdmin && getPrimaryAdminLegacy2FASecret()) {
      await syncPrimaryAdmin2FASecret(user.id);
      user2FA = { ...user2FA, is_enabled: true };
    }

    if (!user2FA.is_enabled) {
      await revokeUnverifiedSession();
      return NextResponse.json(
        { error: "2FA is not enabled for this user" },
        { status: 400 }
      );
    }

    // Step 3: Verify TOTP — env secret first for primary admin, then DB secret
    const envSecret = isPrimaryAdmin ? getPrimaryAdminLegacy2FASecret() : null;
    const dbSecret = user2FA.secret?.trim() ? user2FA.secret : null;
    const secretsToTry = isPrimaryAdmin
      ? collectUniqueTotpSecrets(envSecret, dbSecret)
      : collectUniqueTotpSecrets(dbSecret);
    // Which sources a refusal actually checked is the difference between "the
    // owner typed a wrong code" and "the server cannot see the enrolled key" —
    // and the second one used to be indistinguishable from the first. Names,
    // never values.
    const sourcesTried = [
      ...(envSecret && collectUniqueTotpSecrets(envSecret).length ? ["env"] : []),
      ...(dbSecret && collectUniqueTotpSecrets(dbSecret).length ? ["db"] : []),
    ];

    const { verified, matchedSecret } = verifyTotpAgainstSecrets(token, secretsToTry, 6);
    const usedEnvSecret =
      Boolean(envSecret) &&
      Boolean(matchedSecret) &&
      matchedSecret === normalizeBase32Secret(envSecret!);

    if (verified && isPrimaryAdmin && usedEnvSecret && dbSecret !== matchedSecret) {
      await syncPrimaryAdmin2FASecret(user.id, matchedSecret!);
    }

    if (!verified) {
      // Refusing the code must not leave a session standing: sign out first, then
      // answer — in that order, because the cookies are written on the way out.
      await revokeUnverifiedSession();

      // Log failed attempt — with what the server could actually see. A refusal
      // that records only "wrong code" cannot be told apart from "the enrolled
      // key never reached the check", and that difference is the whole gate.
      await supabase.from("failed_login_attempts").insert({
        email: user.email,
        ip_address: request.headers.get("x-forwarded-for") || "unknown",
        failure_reason: `Invalid 2FA token (sources tried: ${sourcesTried.length ? sourcesTried.join("+") : "none"})`,
        user_agent: request.headers.get("user-agent"),
      });

      return NextResponse.json(
        { error: "Invalid 2FA token. Please try again." },
        { status: 400 }
      );
    }

    if (verified && usedEnvSecret && dbSecret && dbSecret !== matchedSecret) {
      await sendSecurityAlert(
        `🔐 PRIMARY ADMIN 2FA SYNCED FROM ENV\n` +
          `User: ${user.email}\n` +
          `Time: ${new Date().toISOString()}\n` +
          `IP: ${request.headers.get("x-forwarded-for") || "unknown"}`
      );
    }

    // Step 4: Create sovereign session
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8); // 8 hours validity

    await supabase.from("sovereign_sessions").insert({
      user_id: user.id,
      session_token: sessionToken,
      is_2fa_verified: true,
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
      user_agent: request.headers.get("user-agent"),
      expires_at: expiresAt.toISOString(),
    });

    // Step 5: Set admin_2fa_verified cookie
    const cookieStore = await cookies();
    cookieStore.set("admin_2fa_verified", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 60 * 60, // 8 hours in seconds
      path: "/",
    });

    // Send security alert
    await sendSecurityAlert(
      `🔓 ADMIN LOGIN WITH 2FA\n` +
      `User: ${user.email}\n` +
      `Time: ${new Date().toISOString()}\n` +
      `IP: ${request.headers.get("x-forwarded-for") || "unknown"}`
    );

    // Return success - the Supabase session is now established via cookies
    return NextResponse.json({
      success: true,
      message: "Login and 2FA verification successful",
      sessionToken: sessionToken,
      expiresAt: expiresAt.toISOString(),
    });

  } catch (error) {
    console.error("Verify 2FA Login Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
