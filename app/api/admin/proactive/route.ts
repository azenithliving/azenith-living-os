import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAdminProactiveSnapshot } from "@/lib/admin-proactive-snapshot";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await getAdminProactiveSnapshot(user.id);
  return NextResponse.json({ success: true, ...snapshot });
}
