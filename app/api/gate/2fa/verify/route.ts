import { NextRequest, NextResponse } from "next/server";
import speakeasy from "speakeasy";
import { createClient } from "@/utils/supabase/server";

const ADMIN_EMAIL = "azenithliving@gmail.com";
const ADMIN_PASSWORD = "alaa92aziz";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, token, secret, isFirstSetup } = body;

    // Verify credentials
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Verify 2FA token
    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 2, // Allow 1 step before/after for time drift
    });

    if (!verified) {
      return NextResponse.json(
        { error: "Invalid 2FA code" },
        { status: 401 }
      );
    }

    // If this is first setup, enable 2FA in Supabase
    if (isFirstSetup) {
      const supabase = await createClient();
      const { error: updateError } = await supabase
        .from("user_2fa")
        .update({
          is_enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq("email", email);

      if (updateError) {
        console.error("Error enabling 2FA:", updateError);
        return NextResponse.json(
          { error: "Failed to enable 2FA" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "2FA verified successfully",
    });
  } catch (error) {
    console.error("2FA verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify 2FA" },
      { status: 500 }
    );
  }
}
