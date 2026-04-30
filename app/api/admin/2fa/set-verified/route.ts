import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { verified } = body;

    if (verified !== true) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    // Set a cookie to mark 2FA as verified for this session
    // Expires after 8 hours (matching the sovereign_sessions expiry)
    const cookieStore = await cookies();
    cookieStore.set("admin_2fa_verified", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 60 * 60, // 8 hours in seconds
      path: "/",
    });

    return NextResponse.json({
      success: true,
      message: "2FA verification status saved",
    });

  } catch (error) {
    console.error("Set 2FA Verified Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
