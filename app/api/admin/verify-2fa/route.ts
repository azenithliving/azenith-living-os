import { NextRequest, NextResponse } from "next/server";
import speakeasy from "speakeasy";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { sendSecurityAlert } from "@/lib/telegram-notify";

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

    // Step 1: Sign in with email and password
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const user = authData.user;

    // Step 2: Fetch 2FA data for the user
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

    if (!user2FA.is_enabled) {
      return NextResponse.json(
        { error: "2FA is not enabled for this user" },
        { status: 400 }
      );
    }

    // Step 3: Verify the 2FA token using speakeasy
    const verified = speakeasy.totp.verify({
      secret: user2FA.secret,
      encoding: "base32",
      token: token,
      window: 2, // Time window tolerance (±1 minute)
    });

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
