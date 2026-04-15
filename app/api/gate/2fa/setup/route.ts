import { NextRequest, NextResponse } from "next/server";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { createClient } from "@/utils/supabase/server";

const ADMIN_EMAIL = "azenithliving@gmail.com";
const ADMIN_PASSWORD = "alaa92aziz";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Verify credentials
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Check if user already has 2FA enabled in Supabase
    const supabase = await createClient();
    const { data: user2fa, error: fetchError } = await supabase
      .from("user_2fa")
      .select("secret, is_enabled")
      .eq("email", email)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = no rows, other errors are actual errors
      console.error("Error fetching 2FA:", fetchError);
      return NextResponse.json(
        { error: "Failed to check 2FA status" },
        { status: 500 }
      );
    }

    // If 2FA is already enabled, return existing secret (don't show QR)
    if (user2fa?.is_enabled) {
      return NextResponse.json({
        success: true,
        isEnabled: true,
        secret: user2fa.secret,
        qrCode: null, // Don't show QR for existing 2FA
      });
    }

    // Generate new 2FA secret for first-time setup
    const secret = speakeasy.generateSecret({
      name: "AZENITH Admin",
      length: 32,
    });

    // Generate QR code
    const otpauthUrl = secret.otpauth_url!;
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store or update the secret in Supabase (but not enabled yet)
    const { error: upsertError } = await supabase
      .from("user_2fa")
      .upsert({
        email,
        secret: secret.base32,
        is_enabled: false,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.error("Error storing 2FA secret:", upsertError);
      return NextResponse.json(
        { error: "Failed to store 2FA secret" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      isEnabled: false,
      secret: secret.base32,
      qrCode: qrCodeDataUrl,
    });
  } catch (error) {
    console.error("2FA setup error:", error);
    return NextResponse.json(
      { error: "Failed to setup 2FA" },
      { status: 500 }
    );
  }
}
