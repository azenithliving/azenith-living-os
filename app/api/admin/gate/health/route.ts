import { NextResponse } from "next/server";
import { isAdminGateConfigured } from "@/lib/admin-gate";

/** Public-safe check that production env vars exist (no secret values). */
export async function GET() {
  return NextResponse.json({
    ok: isAdminGateConfigured(),
    emailConfigured: Boolean(process.env.ADMIN_GATE_EMAIL?.trim()),
    passwordConfigured: Boolean(process.env.ADMIN_GATE_PASSWORD?.trim()),
    totpConfigured: Boolean(process.env.ADMIN_GATE_2FA_SECRET?.trim()),
    timestamp: new Date().toISOString(),
  });
}
