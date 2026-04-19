/**
 * Rollback API Route
 * 
 * Handles rollback of content revisions and execution results.
 * Provides secure rollback functionality for the agent's actions.
 */

import { createClient } from "@/utils/supabase/server";
import { logAuditEvent } from "@/lib/ultimate-agent/security-manager";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { revisionId, executionId, type = "revision" } = body;

    if (!revisionId && !executionId) {
      return new Response(
        JSON.stringify({ success: false, error: "revisionId or executionId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = await createClient();
    const actorId = req.headers.get("x-admin-user-id") || "admin_dashboard";

    if (type === "revision" && revisionId) {
      // Get revision details
      const { data: revision, error: fetchError } = await supabase
        .from("content_revisions")
        .select("*")
        .eq("id", revisionId)
        .single();

      if (fetchError || !revision) {
        return new Response(
          JSON.stringify({ success: false, error: "Revision not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      if (revision.revision_status !== "applied") {
        return new Response(
          JSON.stringify({ success: false, error: "Can only rollback applied revisions" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Perform rollback based on table
      let rollbackResult;
      switch (revision.table_name) {
        case "site_settings": {
          rollbackResult = await supabase
            .from("site_settings")
            .update({
              setting_value: revision.old_value,
              current_revision_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", revision.record_id);
          break;
        }
        case "site_sections": {
          rollbackResult = await supabase
            .from("site_sections")
            .update({
              is_active: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", revision.record_id);
          break;
        }
        default: {
          return new Response(
            JSON.stringify({ success: false, error: `Rollback not supported for table: ${revision.table_name}` }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      if (rollbackResult.error) {
        return new Response(
          JSON.stringify({ success: false, error: rollbackResult.error.message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      // Update revision status
      await supabase
        .from("content_revisions")
        .update({
          revision_status: "rolled_back",
          rolled_back_at: new Date().toISOString(),
          rolled_back_by: actorId,
        })
        .eq("id", revisionId);

      // Log the rollback
      await logAuditEvent(
        "rollback",
        `Rolled back revision ${revisionId} on ${revision.table_name}`,
        actorId,
        { revisionId, table: revision.table_name },
        "success"
      );

      return Response.json({
        success: true,
        message: `Successfully rolled back revision on ${revision.table_name}`,
        data: {
          revisionId,
          table: revision.table_name,
          rolledBackAt: new Date().toISOString(),
        },
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid rollback type" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Rollback API] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
