import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { runAdminLiveBrowserAction } from "@/lib/admin-live-browser";

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

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "goto") {
      const url = typeof body.url === "string" ? body.url : "";
      if (!url.trim()) throw new Error("اكتب رابطاً للانتقال إليه.");
      const status = await runAdminLiveBrowserAction({ action, url });
      return NextResponse.json({ success: true, browser: status });
    }

    if (action === "click") {
      const x = Number(body.x);
      const y = Number(body.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error("إحداثيات الضغط غير صحيحة.");
      }
      const status = await runAdminLiveBrowserAction({ action, x, y });
      return NextResponse.json({ success: true, browser: status });
    }

    if (action === "type") {
      const text = typeof body.text === "string" ? body.text : "";
      if (!text) throw new Error("لا يوجد نص للكتابة.");
      const status = await runAdminLiveBrowserAction({ action, text });
      return NextResponse.json({ success: true, browser: status });
    }

    if (action === "press") {
      const key = typeof body.key === "string" ? body.key : "";
      if (!key) throw new Error("لا يوجد زر للضغط.");
      const status = await runAdminLiveBrowserAction({ action, key });
      return NextResponse.json({ success: true, browser: status });
    }

    if (action === "scroll") {
      const deltaX = Number(body.deltaX || 0);
      const deltaY = Number(body.deltaY || 0);
      const status = await runAdminLiveBrowserAction({ action, deltaX, deltaY });
      return NextResponse.json({ success: true, browser: status });
    }

    if (action === "newTab") {
      const url = typeof body.url === "string" ? body.url : undefined;
      const status = await runAdminLiveBrowserAction({ action, url });
      return NextResponse.json({ success: true, browser: status });
    }

    if (action === "setDevice") {
      const mode = body.mode === "mobile" ? "mobile" : "desktop";
      const status = await runAdminLiveBrowserAction({ action, mode });
      return NextResponse.json({ success: true, browser: status });
    }

    if (action === "setNetwork") {
      const rawMode = typeof body.mode === "string" ? body.mode : "direct";
      const mode = rawMode === "tor" || rawMode === "custom" ? rawMode : "direct";
      const status = await runAdminLiveBrowserAction({ action, mode });
      return NextResponse.json({ success: true, browser: status });
    }

    if (action === "switchTab" || action === "closeTab") {
      const index = Number(body.index);
      if (!Number.isInteger(index) || index < 0) {
        throw new Error("رقم التبويب غير صحيح.");
      }
      const status = await runAdminLiveBrowserAction({ action, index });
      return NextResponse.json({ success: true, browser: status });
    }

    if (action === "reload" || action === "back" || action === "forward") {
      const status = await runAdminLiveBrowserAction({ action });
      return NextResponse.json({ success: true, browser: status });
    }

    throw new Error("أمر متصفح غير معروف.");
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Live browser action failed",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
