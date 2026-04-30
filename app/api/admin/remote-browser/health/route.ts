import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { checkRemoteBrowserHealth, getRemoteBrowserConfig } from "@/lib/remote-browser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, ok: false, error: "Unauthorized", checkedAt: new Date().toISOString() },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const config = getRemoteBrowserConfig();
    const health = await checkRemoteBrowserHealth(config);
    return NextResponse.json(
      {
        success: health.ok,
        ok: health.ok,
        checkedAt: health.checkedAt,
        source: config.source,
        ...(health.ok ? {} : { error: health.error || "Browser workspace unavailable" }),
      },
      {
        status: health.ok ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        ok: false,
        error: error instanceof Error ? error.message : "Browser workspace health error",
        checkedAt: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
