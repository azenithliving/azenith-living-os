/**
 * VANGUARD Execution API
 * 
 * POST /api/vanguard/execute - Execute a single tool
 * POST /api/vanguard/execute/pipeline - Execute a pipeline
 * GET /api/vanguard/execute/tools - List available tools
 * GET /api/vanguard/execute/metrics - Get execution metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { toolRegistry } from '@/lib/vanguard/execution/tool_registry';
import { resultVerifier } from '@/lib/vanguard/execution/result_verifier';
import { executionMonitor } from '@/lib/vanguard/execution/execution_monitor';

// ============================================================================
// POST /api/vanguard/execute - Execute a single tool
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { toolId, input, context, options } = body;

    // Validate request
    if (!toolId || typeof toolId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'toolId is required',
            messageAr: 'معرف الأداة مطلوب'
          }
        },
        { status: 400 }
      );
    }

    // Get tool
    const tool = toolRegistry.getTool(toolId);
    if (!tool) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOOL_NOT_FOUND',
            message: `Tool "${toolId}" not found`,
            messageAr: `الأداة "${toolId}" غير موجودة`
          }
        },
        { status: 404 }
      );
    }

    // Execute tool
    const result = await toolRegistry.executeTool(
      toolId,
      input || {},
      context || {}
    );

    // Verify result if requested
    let verification;
    const verificationLevel = options?.verificationLevel || 'standard';
    
    if (verificationLevel !== 'none' && result.success) {
      verification = await resultVerifier.verify(
        result,
        {
          toolId,
          input,
          metadata: context
        },
        verificationLevel
      );
    }

    // Log execution
    await executionMonitor.logExecution(
      toolId,
      tool.definition.name,
      input,
      result,
      context || {},
      verification
    );

    // Return response
    return NextResponse.json({
      success: result.success,
      data: result.data,
      error: result.error,
      verification: verification ? {
        status: verification.status,
        confidence: verification.confidence,
        warnings: verification.warnings,
        errors: verification.errors
      } : undefined,
      metadata: {
        ...result.metadata,
        toolName: tool.definition.name,
        toolNameAr: tool.definition.nameAr,
        toolCategory: tool.definition.category,
        toolRiskLevel: tool.definition.riskLevel
      }
    });
  } catch (error) {
    console.error('[ExecutionAPI] POST /api/vanguard/execute error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'خطأ داخلي'
        }
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/vanguard/execute - List available tools
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Get metrics
    if (action === 'metrics') {
      const systemMetrics = executionMonitor.getSystemMetrics();
      const stats = toolRegistry.getStats();

      return NextResponse.json({
        success: true,
        data: {
          system: systemMetrics,
          registry: stats,
          recentLogs: executionMonitor.getRecentLogs(20).map(log => ({
            id: log.id,
            toolId: log.toolId,
            toolName: log.toolName,
            status: log.status,
            executionTimeMs: log.metrics.executionTimeMs,
            timestamp: log.timestamp,
            error: log.error
          }))
        }
      });
    }

    // Get anomalies
    if (action === 'anomalies') {
      const anomalies = executionMonitor.detectAnomalies();
      return NextResponse.json({
        success: true,
        data: { anomalies }
      });
    }

    // Get tool details
    const toolId = searchParams.get('toolId');
    if (toolId) {
      const tool = toolRegistry.getTool(toolId);
      if (!tool) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'TOOL_NOT_FOUND',
              message: `Tool "${toolId}" not found`,
              messageAr: `الأداة "${toolId}" غير موجودة`
            }
          },
          { status: 404 }
        );
      }

      const metrics = executionMonitor.getToolMetrics(toolId);
      
      return NextResponse.json({
        success: true,
        data: {
          definition: tool,
          metrics
        }
      });
    }

    // List all tools (default)
    const category = searchParams.get('category');
    const riskLevel = searchParams.get('riskLevel') as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
    const search = searchParams.get('search');

    let tools = toolRegistry.getAllTools();

    // Apply filters
    if (category) {
      tools = tools.filter(t => t.category === category);
    }

    if (riskLevel) {
      tools = toolRegistry.getToolsByRiskLevel(riskLevel);
    }

    if (search) {
      tools = toolRegistry.searchTools(search);
    }

    return NextResponse.json({
      success: true,
      data: {
        tools: tools.map(tool => ({
          id: tool.id,
          name: tool.name,
          nameAr: tool.nameAr,
          description: tool.description,
          descriptionAr: tool.descriptionAr,
          category: tool.category,
          riskLevel: tool.riskLevel,
          parameters: tool.parameters.map(p => ({
            name: p.name,
            type: p.type,
            required: p.required,
            description: p.description
          }))
        })),
        total: tools.length
      }
    });
  } catch (error) {
    console.error('[ExecutionAPI] GET /api/vanguard/execute error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'خطأ داخلي'
        }
      },
      { status: 500 }
    );
  }
}
