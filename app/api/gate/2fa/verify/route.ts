import { NextRequest, NextResponse } from "next/server";
import speakeasy from "speakeasy";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, secret } = body;

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
