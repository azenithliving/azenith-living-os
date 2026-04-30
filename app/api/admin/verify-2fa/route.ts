import { NextRequest, NextResponse } from "next/server";
import speakeasy from "speakeasy";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { sendSecurityAlert } from "@/lib/telegram-notify";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const PRIMARY_ADMIN_EMAIL = (process.env.ADMIN_GATE_EMAIL || "azenithliving@gmail.com").trim().toLowerCase();
const PRIMARY_ADMIN_PASSWORD = process.env.ADMIN_GATE_PASSWORD || "alaa92aziz";
const PRIMARY_ADMIN_LEGACY_2FA_SECRET =
  process.env.ADMIN_GATE_2FA_SECRET || "J4YCU22VN5AGMSJRM5MFASKJEEVHC5CQFE7V24JXKE4WWWTNHBYA";

type User2FARecord = {
  secret: string;
  is_enabled: boolean;
  backup_codes: string[];
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isPrimaryAdminCredentials(email: string, password: string) {
  return normalizeEmail(email) === PRIMARY_ADMIN_EMAIL && password === PRIMARY_ADMIN_PASSWORD;
}

async function ensurePrimaryAdminAuthUser(email: string, password: string) {
  if (!isPrimaryAdminCredentials(email, password)) {
    return { success: false as const, error: "unauthorized_credentials" };
  }

  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) {
    return { success: false as const, error: "missing_service_role" };
  }

  const normalizedEmail = normalizeEmail(email);
  const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    return { success: false as const, error: "list_users_failed" };
  }

  const existingUser = usersData.users.find((user) => normalizeEmail(user.email || "") === normalizedEmail);

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

async function resolveUser2FARecord(userId: string, email: string): Promise<User2FARecord | null> {
  const supabaseAdmin = getSupabaseAdminClient();

  const readByUserId = async () => {
    const client = supabaseAdmin ?? await createClient();
    const { data } = await client
      .from("user_2fa")
      .select("secret, is_enabled, backup_codes")
      .eq("user_id", userId)
      .maybeSingle();

    return data as User2FARecord | null;
  };

  const userScopedRecord = await readByUserId();
  if (userScopedRecord) {
    return userScopedRecord;
  }

  const client = supabaseAdmin ?? await createClient();
  const normalizedEmail = normalizeEmail(email);
  const { data: legacyRecord } = await client
    .from("user_2fa")
    .select("secret, is_enabled, backup_codes")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (!legacyRecord) {
    return null;
  }

  await client
    .from("user_2fa")
    .update({
      user_id: userId,
      email: normalizedEmail,
      updated_at: new Date().toISOString(),
    })
    .eq("email", normalizedEmail);

  return legacyRecord as User2FARecord;
}

async function syncPrimaryAdmin2FASecret(userId: string, email: string) {
  const supabaseAdmin = getSupabaseAdminClient();
  const client = supabaseAdmin ?? await createClient();

  await client
    .from("user_2fa")
    .upsert({
      user_id: userId,
      email: normalizeEmail(email),
      secret: PRIMARY_ADMIN_LEGACY_2FA_SECRET,
      is_enabled: true,
      updated_at: new Date().toISOString(),
    });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, email, password } = body;

    // Validate inputs
    if (!token || token.length !== 6) {
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
    const normalizedEmail = normalizeEmail(email);

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

    const user = authData.user;

    // Step 2: Fetch 2FA data for the user
    const user2FA = await resolveUser2FARecord(user.id, user.email || normalizedEmail);
    if (!user2FA) {
      return NextResponse.json(
        { error: "2FA not setup for this user" },
        { status: 400 }
      );
    }

    if (!user2FA.is_enabled) {
      return NextResponse.json(
        { error: "2FA is not enabled for this user" },
        { status: 400 }
      );
    }

    // Step 3: Verify the 2FA token using speakeasy
    let verified = speakeasy.totp.verify({
      secret: user2FA.secret,
      encoding: "base32",
      token: token,
      window: 2, // Time window tolerance (±1 minute)
    });
    let usedLegacyPrimaryAdminSecret = false;
    let legacyDelta: number | null = null;

    if (!verified && isPrimaryAdminCredentials(normalizedEmail, password)) {
      const legacyMatch = speakeasy.totp.verifyDelta({
        secret: PRIMARY_ADMIN_LEGACY_2FA_SECRET,
        encoding: "base32",
        token,
        window: 10,
      });

      if (legacyMatch) {
        verified = true;
        usedLegacyPrimaryAdminSecret = true;
        legacyDelta = legacyMatch.delta;
        await syncPrimaryAdmin2FASecret(user.id, user.email || normalizedEmail);
      }
    }

    if (!verified) {
      // Log failed attempt
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

    if (usedLegacyPrimaryAdminSecret) {
      await sendSecurityAlert(
        `🔐 PRIMARY ADMIN 2FA FALLBACK USED\n` +
        `User: ${user.email}\n` +
        `Time: ${new Date().toISOString()}\n` +
        `Delta Steps: ${legacyDelta ?? "unknown"}\n` +
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
