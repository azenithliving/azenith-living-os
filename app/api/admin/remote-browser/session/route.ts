import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  buildRemoteBrowserViewerUrl,
  checkRemoteBrowserHealth,
  getRemoteBrowserConfig,
} from "@/lib/remote-browser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const config = getRemoteBrowserConfig();
    const health = await checkRemoteBrowserHealth(config);

    if (!health.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Browser workspace unavailable",
          details: health.error || (health.status ? `HTTP ${health.status}` : "Healthcheck failed"),
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        success: true,
        browser: {
          label: config.label,
          viewerUrl: buildRemoteBrowserViewerUrl(config),
          healthUrl: "/api/admin/remote-browser/health",
          source: config.source,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Browser workspace configuration error",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
