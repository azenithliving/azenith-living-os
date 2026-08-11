/**
 * PATCH /api/admin/keys/[id] - Update key (toggle active, change notes)
 * DELETE /api/admin/keys/[id] - Delete key
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { reloadKeys } from "@/lib/api-keys-service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const id = params.id;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Key ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    // Build update object dynamically
    const updates: any = {};
    
    if (typeof body.isActive === "boolean") {
      updates.is_active = body.isActive;
    }
    
    if (typeof body.isBackup === "boolean") {
      updates.is_backup = body.isBackup;
    }
    
    if (body.notes !== undefined) {
      updates.notes = body.notes || null;
    }
    
    if (body.clearCooldown === true) {
      updates.cooldown_until = null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("api_keys")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Admin API] Update error:", error);
      return NextResponse.json(
        { error: "Failed to update key" },
        { status: 500 }
      );
    }

    // Hot-reload keys to reflect changes immediately
    await reloadKeys();

    return NextResponse.json({
      success: true,
      message: "Key updated successfully",
      key: {
        id: data.id,
        provider: data.provider,
        isActive: data.is_active,
        isBackup: data.is_backup,
        notes: data.notes,
      },
    });
    
  } catch (error: any) {
    console.error("[Admin API] PATCH error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const id = params.id;

    if (!id) {
      return NextResponse.json(
        { error: "Key ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    const { error } = await supabase
      .from("api_keys")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[Admin API] Delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete key" },
        { status: 500 }
      );
    }

    // Hot-reload keys to remove from memory
    await reloadKeys();

    return NextResponse.json({
      success: true,
      message: "Key deleted successfully",
    });
    
  } catch (error: any) {
    console.error("[Admin API] DELETE error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
