import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  closeAdminLiveBrowser,
  getAdminLiveBrowserStatus,
} from "@/lib/admin-live-browser";

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
    const status = await getAdminLiveBrowserStatus();
    return NextResponse.json(
      { success: true, browser: status },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Live browser failed",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE() {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  await closeAdminLiveBrowser();
  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
