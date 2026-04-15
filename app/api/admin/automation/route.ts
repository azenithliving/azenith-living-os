/**
 * Automation Rules Management API
 * CRUD operations for automation rules
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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

/**
 * GET /api/admin/automation
 * List all automation rules
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("automation_rules")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Automation API] Error fetching rules:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch automation rules", details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, rules: data as AutomationRule[] });
  } catch (error) {
    console.error("[Automation API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/automation
 * Add new rule: { name, trigger, conditions, actions, enabled? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, trigger, conditions, actions, enabled = true } = body;

    // Validation
    if (!name || !trigger) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: name and trigger are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("automation_rules")
      .insert({
        name,
        trigger,
        conditions: conditions || {},
        actions: actions || {},
        enabled,
      })
      .select()
      .single();

    if (error) {
      console.error("[Automation API] Error creating rule:", error);
      return NextResponse.json(
        { success: false, error: "Failed to create automation rule" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      rule: data as AutomationRule,
      message: "Automation rule created successfully",
    });
  } catch (error) {
    console.error("[Automation API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/automation?id=<id>
 * Update rule: { name?, trigger?, conditions?, actions?, enabled? }
 */
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing rule id" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, trigger, conditions, actions, enabled } = body;

    const supabase = await createClient();

    // Build update object with only provided fields
    const updateData: Partial<AutomationRule> = {};
    if (name !== undefined) updateData.name = name;
    if (trigger !== undefined) updateData.trigger = trigger;
    if (conditions !== undefined) updateData.conditions = conditions;
    if (actions !== undefined) updateData.actions = actions;
    if (enabled !== undefined) updateData.enabled = enabled;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("automation_rules")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Automation API] Error updating rule:", error);
      return NextResponse.json(
        { success: false, error: "Failed to update automation rule" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      rule: data as AutomationRule,
      message: "Automation rule updated successfully",
    });
  } catch (error) {
    console.error("[Automation API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/automation?id=<id>
 * Delete a rule
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing rule id" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("automation_rules")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[Automation API] Error deleting rule:", error);
      return NextResponse.json(
        { success: false, error: "Failed to delete automation rule" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Automation rule deleted successfully",
    });
  } catch (error) {
    console.error("[Automation API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
