/**
 * Goals Management API
 * 
 * CRUD operations for agent goals with auto-check scheduling
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET /api/admin/agent/goals - List goals
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";
    const companyId = searchParams.get("companyId");
    const limit = parseInt(searchParams.get("limit") || "50");

    const supabase = await createClient();

    let query = supabase
      .from("agent_goals_v2")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data: goals, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Get progress history for each goal
    const goalsWithProgress = await Promise.all(
      (goals || []).map(async (goal) => {
        const { data: progress } = await supabase
          .from("goal_progress_history")
          .select("*")
          .eq("goal_id", goal.id)
          .order("recorded_at", { ascending: false })
          .limit(5);

        return {
          ...goal,
          progressHistory: progress || [],
        };
      })
    );

    return NextResponse.json({
      success: true,
      goals: goalsWithProgress,
      total: goalsWithProgress.length,
    });

  } catch (error) {
    console.error("[Goals API] GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch goals" },
      { status: 500 }
    );
  }
}

// POST /api/admin/agent/goals - Create goal
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      goalType = "metric_target",
      targetMetric,
      targetValue,
      unit = "count",
      deadline,
      priority = 5,
      autoCheck = false,
      checkFrequency = "daily",
      relatedEntityType,
      relatedEntityId,
      successCriteria = [],
    } = body;

    const supabase = await createClient();

    // Get admin user info
    const adminUserId = req.headers.get("x-admin-user-id") || null;
    const companyId = req.headers.get("x-company-id") || null;

    // Validation
    if (!title) {
      return NextResponse.json(
        { success: false, error: "Title is required" },
        { status: 400 }
      );
    }

    const { data: goal, error } = await supabase
      .from("agent_goals_v2")
      .insert({
        title,
        description,
        goal_type: goalType,
        target_metric: targetMetric,
        target_value: targetValue,
        unit,
        deadline,
        priority,
        auto_check_enabled: autoCheck,
        check_frequency: checkFrequency,
        next_check_at: autoCheck ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        company_id: companyId,
        created_by: adminUserId,
        success_criteria: successCriteria,
        status: "active",
        progress_percent: 0,
        current_value: 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Goal created successfully",
      goal,
    });

  } catch (error) {
    console.error("[Goals API] POST Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create goal" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/agent/goals - Update goal progress
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { goalId, progress, currentValue, notes } = body;

    const supabase = await createClient();
    const adminUserId = req.headers.get("x-admin-user-id") || null;

    if (!goalId) {
      return NextResponse.json(
        { success: false, error: "Goal ID is required" },
        { status: 400 }
      );
    }

    // Update goal progress using the database function
    const { data: result, error } = await supabase
      .rpc("update_goal_progress", {
        p_goal_id: goalId,
        p_new_value: currentValue || progress || 0,
        p_notes: notes || "Manual update via API",
        p_recorded_by: adminUserId,
      });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Goal progress updated",
      data: result,
    });

  } catch (error) {
    console.error("[Goals API] PATCH Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update goal" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/agent/goals - Delete or archive goal
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const goalId = searchParams.get("id");

    if (!goalId) {
      return NextResponse.json(
        { success: false, error: "Goal ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Soft delete by marking as abandoned
    const { error } = await supabase
      .from("agent_goals_v2")
      .update({
        status: "abandoned",
        updated_at: new Date().toISOString(),
      })
      .eq("id", goalId);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Goal archived successfully",
    });

  } catch (error) {
    console.error("[Goals API] DELETE Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete goal" },
      { status: 500 }
    );
  }
}
