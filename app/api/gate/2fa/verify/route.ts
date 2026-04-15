import { NextRequest, NextResponse } from "next/server";
import speakeasy from "speakeasy";

const ADMIN_EMAIL = "azenithliving@gmail.com";
const ADMIN_PASSWORD = "alaa92aziz";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, token, secret } = body;

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
