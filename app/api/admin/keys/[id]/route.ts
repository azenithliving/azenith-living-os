import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { reloadKeys } from "@/lib/api-keys-service";
import { AdminApiAuthError, requireAdminApiAccess } from "@/lib/admin-api-auth";

function authResponse(error: unknown) {
  return error instanceof AdminApiAuthError ? NextResponse.json({ success: false, error: error.message }, { status: error.status }) : null;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApiAccess(request);
    const id = (await context.params).id;
    const body = await request.json();
    if (!id) return NextResponse.json({ success: false, error: "Key ID is required" }, { status: 400 });
    const updates: Record<string, unknown> = {};
    if (typeof body.isActive === "boolean") updates.is_active = body.isActive;
    if (typeof body.isBackup === "boolean") updates.is_backup = body.isBackup;
    if (body.notes !== undefined) updates.notes = body.notes || null;
    if (body.clearCooldown === true) updates.cooldown_until = null;
    if (body.cooldownUntil) updates.cooldown_until = body.cooldownUntil;
    if (body.markDead === true) { updates.is_active = false; updates.is_backup = false; updates.error_count = 3; updates.last_error = "[DEAD] Manually marked by administrator"; }
    if (body.clearDead === true) { updates.error_count = 0; updates.last_error = null; }
    if (!Object.keys(updates).length) return NextResponse.json({ success: false, error: "No updates provided" }, { status: 400 });
    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
    const { data, error } = await supabase.from("api_keys").update(updates).eq("id", id).select().single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    const reload = await reloadKeys();
    if (!reload.success) return NextResponse.json({ success: false, error: reload.error || "Key updated but reload failed", persisted: true }, { status: 502 });
    return NextResponse.json({ success: true, key: { id: data.id, provider: data.provider, isActive: data.is_active, isBackup: data.is_backup, notes: data.notes } });
  } catch (error) {
    const response = authResponse(error); if (response) return response;
    console.error("[Admin API] PATCH key error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApiAccess(request);
    const id = (await context.params).id;
    if (!id) return NextResponse.json({ success: false, error: "Key ID is required" }, { status: 400 });
    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
    const { error } = await supabase.from("api_keys").delete().eq("id", id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    const reload = await reloadKeys();
    if (!reload.success) return NextResponse.json({ success: false, error: reload.error || "Key deleted but reload failed", persisted: true }, { status: 502 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const response = authResponse(error); if (response) return response;
    console.error("[Admin API] DELETE key error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
