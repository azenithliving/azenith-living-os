/**
 * Automation Rules Management API
 * CRUD operations for automation rules
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-service";
import { resolvePrimaryCompanyId } from "@/lib/company-resolver";

export const dynamic = "force-dynamic";

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

function apiSuccess(data: Record<string, unknown>, message?: string) {
  return NextResponse.json({
    success: true,
    message: message || "OK",
    ...data,
  });
}

function apiError(error: string, status: number, details?: unknown) {
  return NextResponse.json(
    { success: false, error, details: details || null },
    { status }
  );
}

function normalizeRule(row: Record<string, unknown>): AutomationRule {
  const isActive = typeof row.is_active === "boolean" ? row.is_active : Boolean(row.enabled);
  return {
    id: String(row.id || ""),
    name: String(row.name || ""),
    trigger: String(row.trigger || ""),
    conditions: (row.conditions as Record<string, unknown>) || {},
    actions: (row.actions as Record<string, unknown>) || {},
    enabled: isActive,
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function isMissingColumn(error: { code?: string; message?: string } | null, column: string) {
  const message = error?.message || "";
  return (
    ((error?.code === "42703" || error?.code === "PGRST204") &&
      message.toLowerCase().includes(column.toLowerCase())) ||
    new RegExp(`column .*${column}.* does not exist|could not find .*${column}.* column`, "i").test(message)
  );
}

function missingOptionalColumn(
  error: { code?: string; message?: string } | null,
  columns: string[]
) {
  return columns.find((column) => isMissingColumn(error, column)) || null;
}

async function insertAutomationRule(insertData: Record<string, unknown>) {
  let data = null;
  let error = null;
  const optionalColumns = ["created_by", "is_active", "company_id"];

  for (let attempt = 0; attempt <= optionalColumns.length; attempt += 1) {
    const result = await supabaseService
      .from("automation_rules")
      .insert(insertData as never)
      .select()
      .single();

    data = result.data;
    error = result.error;

    const column = missingOptionalColumn(error, optionalColumns);
    if (!error || !column) break;
    delete insertData[column];
  }

  return { data, error };
}

async function updateAutomationRule(id: string, updateData: Record<string, unknown>) {
  let data = null;
  let error = null;
  const optionalColumns = ["updated_by", "is_active"];

  for (let attempt = 0; attempt <= optionalColumns.length; attempt += 1) {
    const result = await supabaseService
      .from("automation_rules")
      .update(updateData as never)
      .eq("id", id)
      .select()
      .single();

    data = result.data;
    error = result.error;

    const column = missingOptionalColumn(error, optionalColumns);
    if (!error || !column) break;
    delete updateData[column];
  }

  return { data, error };
}

/**
 * GET /api/admin/automation
 * List all automation rules
 */
export async function GET() {
  try {
    const { data, error } = await supabaseService
      .from("automation_rules")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Automation API] Error fetching rules:", error);
      return apiError("Failed to fetch automation rules", 500, error);
    }

    const rules = (data || []).map((row) => normalizeRule(row as Record<string, unknown>));
    return apiSuccess({ rules });
  } catch (error) {
    console.error("[Automation API] Error:", error);
    return apiError("Internal server error", 500);
  }
}

/**
 * POST /api/admin/automation
 * Add new rule: { name, trigger, conditions, actions, enabled? }
 */
export async function POST(request: NextRequest) {
  try {
    const actorId = request.headers.get("x-admin-user-id");
    if (!actorId) return apiError("Unauthorized", 401);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON in request body", 400);
    }

    const { name, trigger, conditions, actions, enabled = true, company_id } = body;

    // Validation
    if (!name || !trigger) {
      return apiError("Missing required fields: name and trigger are required", 400);
    }

    const resolvedCompanyId =
      typeof company_id === "string" && company_id ? company_id : await resolvePrimaryCompanyId();

    const insertData: Record<string, unknown> = {
      name,
      trigger,
      conditions: conditions || {},
      actions: actions || {},
      enabled,
      is_active: enabled,
      company_id: resolvedCompanyId,
      created_by: actorId,
    };

    const { data, error } = await insertAutomationRule(insertData);

    if (error) {
      return apiError("Failed to create automation rule", 500, error);
    }

    return apiSuccess({ rule: normalizeRule(data as unknown as Record<string, unknown>) }, "Automation rule created successfully");
  } catch (error) {
    console.error("[Automation API] UNEXPECTED ERROR:", error);
    return apiError("Internal server error", 500, String(error));
  }
}

/**
 * PUT /api/admin/automation?id=<id>
 * Update rule: { name?, trigger?, conditions?, actions?, enabled? }
 */
export async function PUT(request: NextRequest) {
  try {
    const actorId = request.headers.get("x-admin-user-id");
    if (!actorId) return apiError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return apiError("Missing rule id", 400);
    }

    const body = await request.json();
    const { name, trigger, conditions, actions, enabled } = body;

    // Build update object with only provided fields
    const updateData: Partial<AutomationRule> = {};
    if (name !== undefined) updateData.name = name;
    if (trigger !== undefined) updateData.trigger = trigger;
    if (conditions !== undefined) updateData.conditions = conditions;
    if (actions !== undefined) updateData.actions = actions;
    if (enabled !== undefined) updateData.enabled = enabled;

    if (Object.keys(updateData).length === 0) {
      return apiError("No fields to update", 400);
    }

    if (updateData.enabled !== undefined) {
      (updateData as Record<string, unknown>).is_active = updateData.enabled;
    }
    (updateData as Record<string, unknown>).updated_by = actorId;

    const { data, error } = await updateAutomationRule(id, updateData as Record<string, unknown>);

    if (error) {
      console.error("[Automation API] Error updating rule:", error);
      return apiError("Failed to update automation rule", 500, error);
    }

    return apiSuccess({ rule: normalizeRule(data as unknown as Record<string, unknown>) }, "Automation rule updated successfully");
  } catch (error) {
    console.error("[Automation API] Error:", error);
    return apiError("Internal server error", 500);
  }
}

/**
 * DELETE /api/admin/automation?id=<id>
 * Delete a rule
 */
export async function DELETE(request: NextRequest) {
  try {
    const actorId = request.headers.get("x-admin-user-id");
    if (!actorId) return apiError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return apiError("Missing rule id", 400);
    }

    const { error } = await supabaseService
      .from("automation_rules")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[Automation API] Error deleting rule:", error);
      return apiError("Failed to delete automation rule", 500, error);
    }

    return apiSuccess({ deletedId: id, actorId }, "Automation rule deleted successfully");
  } catch (error) {
    console.error("[Automation API] Error:", error);
    return apiError("Internal server error", 500);
  }
}
