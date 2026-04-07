import { NextRequest, NextResponse } from "next/server";

import {
  verifyRecoveryCode,
  getRemainingRecoveryCodes,
  initializeVault,
} from "@/lib/auth/vault";
import { createSession } from "@/lib/auth/session";

/**
 * POST /api/auth/recovery - Verify recovery code
 * Body: { email: string, code: string, trustedDevice: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, trustedDevice = false } = body;

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and recovery code required" },
        { status: 400 }
      );
    }

    // Normalize code: uppercase and remove spaces
    const normalizedCode = code.toUpperCase().replace(/\s/g, "");

    // Validate format: XXXX-XXXX-XXXX
    const codeFormat = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!codeFormat.test(normalizedCode)) {
      return NextResponse.json(
        { error: "Invalid recovery code format. Expected: XXXX-XXXX-XXXX" },
        { status: 400 }
      );
    }

    // TODO: Get adminId from email lookup in Supabase Auth
    // For now, we need the adminId to verify the code
    const adminId = await getAdminIdByEmail(email);

    if (!adminId) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Check if vault exists, if not initialize it
    const { hasVault } = await import("@/lib/auth/vault");
    const vaultExists = await hasVault(adminId);

    if (!vaultExists) {
      // First time login - initialize vault with recovery codes
      const { recoveryCodes } = await initializeVault(adminId);
      console.log(`[Recovery] Vault initialized for ${email}`);

      // Check if provided code matches one of the generated codes
      const generatedCodes = recoveryCodes;
      const isNewCode = generatedCodes.some(
        (c: string) => c.replace(/-/g, "") === normalizedCode.replace(/-/g, "")
      );

      if (!isNewCode) {
        return NextResponse.json(
          { error: "Invalid recovery code" },
          { status: 401 }
        );
      }
    } else {
      // Existing vault - verify the recovery code
      const isValid = await verifyRecoveryCode(adminId, normalizedCode);

      if (!isValid) {
        console.log(`[Recovery] Failed attempt for ${email}`);
        return NextResponse.json(
          { error: "Invalid or already used recovery code" },
          { status: 401 }
        );
      }
    }

    // Get remaining codes
    const remaining = await getRemainingRecoveryCodes(adminId);

    // Create session
    const userAgent = request.headers.get("user-agent") || "";
    const ip = request.headers.get("x-forwarded-for") || "unknown";

    const session = await createSession(adminId, email, trustedDevice, userAgent, ip);

    console.log(`[Recovery] ✅ RECOVERY LOGIN SUCCESSFUL for ${email}`);
    console.log(`[Recovery] 👤 Admin ID: ${adminId.slice(0, 8)}...`);
    console.log(`[Recovery] 📱 Device: ${trustedDevice ? "TRUSTED" : "SINGLE SESSION"}`);
    console.log(`[Recovery] ⏱️  Expires: ${session.expiresAt}`);
    console.log(`[Recovery] 📋 Remaining codes: ${remaining}`);

    return NextResponse.json({
      success: true,
      message: "Recovery authentication successful",
      remainingCodes: remaining,
      warning: remaining <= 3 ? "Low recovery codes remaining. Generate new ones soon." : undefined,
      trustedDevice,
    });
  } catch (error) {
    console.error("[Recovery] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/recovery/status - Check recovery codes status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const adminId = await getAdminIdByEmail(email);

    if (!adminId) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const remaining = await getRemainingRecoveryCodes(adminId);

    return NextResponse.json({
      success: true,
      remainingCodes: remaining,
      hasVault: remaining > 0,
    });
  } catch (error) {
    console.error("[Recovery] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get adminId from email via Supabase Auth
 */
async function getAdminIdByEmail(email: string): Promise<string | null> {
  // TODO: Implement proper lookup via Supabase Auth
  // This should query the auth.users table or your user mapping table

  // Placeholder: For testing, return a consistent ID based on email hash
  const { createHash } = await import("crypto");
  const hash = createHash("sha256").update(email).digest("hex").slice(0, 32);
  return `admin-${hash}`;
}
