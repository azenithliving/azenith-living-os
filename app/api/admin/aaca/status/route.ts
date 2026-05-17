import { NextResponse } from "next/server";
import { checkAacaHealth } from "@/lib/aaca-client";

/**
 * Server-side AACA health (avoids browser CORS / wrong localhost port).
 */
export async function GET() {
  try {
    const health = await checkAacaHealth();
    return NextResponse.json({
      success: true,
      status: health.status === "READY" ? "READY" : "OFFLINE",
      mode: health.mode,
      label:
        health.mode === "cloud"
          ? "سحابي — جاهز على الموقع"
          : health.mode === "remote"
            ? "سيرفر وكلاء خارجي"
            : "محلي",
      aaca: health,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      status: "OFFLINE",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
