/**
 * Unified Tool Execution API
 * 
 * Endpoint واحد لتنفيذ جميع أدوات الوكيل مع:
 * - Execution tracking
 * - Approval workflow
 * - Rollback support
 * - Real-time notifications
 */

import { NextResponse } from "next/server";
import { executeTool, getTool, validateToolParams, TOOL_REGISTRY } from "@/lib/agent-tools/tool-registry";
import { createExecutionRecord, updateExecutionRecord } from "@/lib/agent-tools/execution-tracker";
import { executeWithApproval, requiresApproval } from "@/lib/agent-tools/approval-system";
import { logAuditEvent } from "@/lib/ultimate-agent/security-manager";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      toolName, 
      params, 
      requireApproval = false, 
      skipApproval = false,
      context = {}
    } = body;

    // Get admin user info from headers
    const adminUserId = req.headers.get("x-admin-user-id") || "system";
    const companyId = req.headers.get("x-company-id") || null;

    // Validation
    if (!toolName) {
      return NextResponse.json(
        { success: false, error: "toolName is required" },
        { status: 400 }
      );
    }

    const tool = getTool(toolName);
    if (!tool) {
      return NextResponse.json(
        { success: false, error: `Unknown tool: ${toolName}` },
        { status: 400 }
      );
    }

    // Validate parameters
    const validation = validateToolParams(toolName, params || {});
    if (!validation.valid) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Invalid parameters", 
          details: validation.errors 
        },
        { status: 400 }
      );
    }

    // Build execution context
    const executionContext = {
      companyId: companyId || undefined,
      actorUserId: adminUserId,
      executionId: crypto.randomUUID(),
      ...context,
    };

    // Check if approval is required
    const needsApproval = tool.requiresApproval && !skipApproval;

    if (needsApproval) {
      // Create approval request
      const approvalResult = await executeWithApproval(
        toolName,
        params,
        executionContext,
        false // Don't skip approval
      );

      if (approvalResult.requiresApproval) {
        return NextResponse.json({
          success: true,
          requiresApproval: true,
          approvalId: approvalResult.approvalId,
          message: approvalResult.message,
          toolName,
          params,
        });
      }
    }

    // Create execution record
    const execution = await createExecutionRecord({
      toolName,
      params: params || {},
      status: "running",
      relationContext: executionContext,
    });

    // Execute the tool
    const result = await executeTool(toolName, params || {}, {
      ...executionContext,
      executionId: execution.id,
    });

    // Update execution record
    await updateExecutionRecord(execution.id, {
      status: result.success ? "completed" : "failed",
      result: result.data,
      error: result.error,
      rollbackAvailable: result.canRollback,
    });

    // Log audit event
    await logAuditEvent(
      "tool_executed",
      `Executed ${tool.displayName}`,
      adminUserId,
      { toolName, params, success: result.success },
      result.success ? "success" : "failure"
    );

    // Return full result (no filtering!)
    return NextResponse.json({
      success: result.success,
      message: result.message,
      data: result.data,
      executionId: execution.id,
      toolName,
      canRollback: result.canRollback,
      rollbackId: result.rollbackId,
      requiresApproval: false,
    });

  } catch (error) {
    console.error("[Tool Execute API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

// GET /api/admin/agent/tools/execute - List available tools
export async function GET() {
  try {
    const tools = Object.values(TOOL_REGISTRY).map((tool) => ({
      name: tool.name,
      displayName: tool.displayName,
      description: tool.description,
      category: tool.category,
      riskLevel: tool.riskLevel,
      requiresApproval: tool.requiresApproval,
      parameters: tool.parameters,
      examples: tool.examples,
    }));

    return NextResponse.json({
      success: true,
      tools,
      total: tools.length,
    });
  } catch (error) {
    console.error("[Tool Execute API] GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list tools" },
      { status: 500 }
    );
  }
}
