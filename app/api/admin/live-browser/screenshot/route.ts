import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { captureAdminLiveBrowserScreenshot } from "@/lib/admin-live-browser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  return { user };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  try {
    const image = await captureAdminLiveBrowserScreenshot();
    return new NextResponse(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Live browser screenshot failed",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
