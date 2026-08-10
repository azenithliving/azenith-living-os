import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export interface AdminAuthResult {
  user: { id: string; email?: string } | null;
  unauthorized: NextResponse | null;
}

/**
 * Shared auth guard for admin-only API routes.
 * Uses the same SSR cookie client as the /admin layout, so a request that
 * reaches an admin page will always pass, while anonymous callers get 401.
 */
export async function requireAdminApi(): Promise<AdminAuthResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        user: null,
        unauthorized: NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        ),
      };
    }

    return {
      user: { id: user.id, email: user.email ?? undefined },
      unauthorized: null,
    };
  } catch (error) {
    console.error("[AdminApiGuard] Auth check failed:", error);
    return {
      user: null,
      unauthorized: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }
}
