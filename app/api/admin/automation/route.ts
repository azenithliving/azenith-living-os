/**
 * Automation Rules Management API
 * CRUD operations for automation rules
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-service";

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
    const { data, error } = await supabaseService
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
  console.log("[Automation API] ===== POST /api/admin/automation START =====");

  try {
    // Log raw request
    const requestClone = request.clone();
    const rawBody = await requestClone.text();
    console.log("[Automation API] Raw request body:", rawBody);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
      console.log("[Automation API] Parsed body:", JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error("[Automation API] Failed to parse JSON body:", parseError);
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { name, trigger, conditions, actions, enabled = true, company_id } = body;

    // Validation
    if (!name || !trigger) {
      console.error("[Automation API] Validation failed: Missing name or trigger", { name, trigger });
      return NextResponse.json(
        { success: false, error: "Missing required fields: name and trigger are required" },
        { status: 400 }
      );
    }

    // Check if company_id is provided, if not use a default system company
    const insertData: Record<string, unknown> = {
      name,
      trigger,
      conditions: conditions || {},
      actions: actions || {},
      enabled,
    };

    // If company_id provided, add it; otherwise fetch or use default
    if (company_id) {
      insertData.company_id = company_id;
      console.log("[Automation API] Using provided company_id:", company_id);
    } else {
      // Try to fetch the first company from the database
      console.log("[Automation API] No company_id provided, fetching first company...");
      try {
        const { data: firstCompany, error: companyError } = await supabaseService
          .from("companies")
          .select("id")
          .limit(1)
          .single();

        if (companyError) {
          console.error("[Automation API] Error fetching company:", JSON.stringify(companyError, null, 2));
        }

        if (companyError || !firstCompany) {
          // Use a default UUID if no companies exist (this will fail if company doesn't exist)
          const defaultCompanyId = "00000000-0000-0000-0000-000000000001";
          console.warn("[Automation API] No company found, using default:", defaultCompanyId);
          insertData.company_id = defaultCompanyId;
        } else {
          console.log("[Automation API] Using company_id:", firstCompany.id);
          insertData.company_id = firstCompany.id;
        }
      } catch (companyFetchError) {
        console.error("[Automation API] Exception fetching company:", companyFetchError);
        const defaultCompanyId = "00000000-0000-0000-0000-000000000001";
        insertData.company_id = defaultCompanyId;
      }
    }

    console.log("[Automation API] Attempting insert with data:", JSON.stringify(insertData, null, 2));

    let data, error;
    try {
      const result = await supabaseService
        .from("automation_rules")
        .insert(insertData)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } catch (supabaseError) {
      console.error("[Automation API] EXCEPTION during Supabase insert:", supabaseError);
      console.error("[Automation API] Exception stack:", (supabaseError as Error).stack);
      return NextResponse.json(
        { success: false, error: "Database exception", details: String(supabaseError) },
        { status: 500 }
      );
    }

    if (error) {
      console.error("[Automation API] Supabase ERROR object:", JSON.stringify(error, null, 2));
      console.error("[Automation API] Error code:", (error as { code?: string }).code);
      console.error("[Automation API] Error message:", (error as { message?: string }).message);
      console.error("[Automation API] Error details:", (error as { details?: string }).details);
      console.error("[Automation API] Insert data attempted:", JSON.stringify(insertData, null, 2));
      return NextResponse.json(
        { success: false, error: "Failed to create automation rule", details: error },
        { status: 500 }
      );
    }

    console.log("[Automation API] SUCCESS: Rule created:", JSON.stringify(data, null, 2));
    console.log("[Automation API] ===== POST /api/admin/automation END =====");

    return NextResponse.json({
      success: true,
      rule: data as AutomationRule,
      message: "Automation rule created successfully",
    });
  } catch (error) {
    console.error("[Automation API] UNEXPECTED ERROR:", error);
    console.error("[Automation API] Error type:", typeof error);
    console.error("[Automation API] Error string:", String(error));
    if (error instanceof Error) {
      console.error("[Automation API] Error stack:", error.stack);
    }
    console.error("[Automation API] ===== POST /api/admin/automation END WITH ERROR =====");
    return NextResponse.json(
      { success: false, error: "Internal server error", details: String(error) },
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

    const { data, error } = await supabaseService
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

    const { error } = await supabaseService
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
