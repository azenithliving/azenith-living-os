/**
 * VANGUARD Pipeline Execution API
 * 
 * POST /api/vanguard/execute/pipeline - Execute an action pipeline
 * GET /api/vanguard/execute/pipeline/:id - Get pipeline execution status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPipeline } from '@/lib/vanguard/execution/action_pipeline';
import { executionMonitor } from '@/lib/vanguard/execution/execution_monitor';

// ============================================================================
// POST /api/vanguard/execute/pipeline - Execute a pipeline
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, nameAr, steps, context, options } = body;

    // Validate request
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'name is required',
            messageAr: 'الاسم مطلوب'
          }
        },
        { status: 400 }
      );
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'steps array is required and must not be empty',
            messageAr: 'خطوات التنفيذ مطلوبة'
          }
        },
        { status: 400 }
      );
    }

    // Validate steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step.toolId || typeof step.toolId !== 'string') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_STEP',
              message: `Step ${i + 1} is missing toolId`,
              messageAr: `الخطوة ${i + 1} تفتقد معرف الأداة`
            }
          },
          { status: 400 }
        );
      }
    }

    // Build pipeline
    const builder = createPipeline(name, nameAr || name)
      .withContext(context || {})
      .withMode(options?.mode || 'mixed');

    if (options?.continueOnError) {
      builder.continueOnError(true);
    }

    if (options?.enableRollback) {
      builder.enableRollback(true);
    }

    if (options?.timeout) {
      builder.withTimeout(options.timeout);
    }

    // Add steps
    for (const step of steps) {
      builder.addStep({
        toolId: step.toolId,
        input: step.input || {},
        dependsOn: step.dependsOn,
        optional: step.optional,
        retryOnFailure: step.retryOnFailure,
        maxRetries: step.maxRetries,
        rollbackOnFailure: step.rollbackOnFailure,
        description: step.description,
        descriptionAr: step.descriptionAr
      });
    }

    // Execute pipeline
    const startTime = Date.now();
    const result = await builder.execute();
    const executionTime = Date.now() - startTime;

    console.log(`[PipelineAPI] Pipeline "${name}" executed in ${executionTime}ms`, {
      status: result.status,
      completedSteps: result.completedSteps,
      failedSteps: result.failedSteps
    });

    // Return response
    return NextResponse.json({
      success: result.status === 'completed',
      data: {
        planId: result.planId,
        status: result.status,
        totalSteps: result.totalSteps,
        completedSteps: result.completedSteps,
        failedSteps: result.failedSteps,
        skippedSteps: result.skippedSteps,
        totalDurationMs: result.totalDurationMs,
        steps: result.steps.map(step => ({
          stepId: step.stepId,
          toolId: step.toolId,
          status: step.status,
          durationMs: step.durationMs,
          retryCount: step.retryCount,
          error: step.error,
          // Don't include full result data to keep response size reasonable
          hasData: step.result?.success && !!step.result.data
        }))
      },
      error: result.error,
      metadata: {
        startTime: result.startTime,
        endTime: result.endTime,
        name,
        nameAr: nameAr || name
      }
    });
  } catch (error) {
    console.error('[PipelineAPI] POST /api/vanguard/execute/pipeline error:', error);
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
// GET /api/vanguard/execute/pipeline - Get pipeline metrics
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      // Get logs for a specific session
      const logs = executionMonitor.getLogsBySession(sessionId);
      
      return NextResponse.json({
        success: true,
        data: {
          sessionId,
          logs: logs.map(log => ({
            id: log.id,
            toolId: log.toolId,
            toolName: log.toolName,
            status: log.status,
            executionTimeMs: log.metrics.executionTimeMs,
            timestamp: log.timestamp,
            verification: log.verification ? {
              status: log.verification.status,
              confidence: log.verification.confidence
            } : undefined
          })),
          total: logs.length,
          successCount: logs.filter(l => l.status === 'success').length,
          failureCount: logs.filter(l => l.status === 'failure').length
        }
      });
    }

    // Get system-wide metrics
    const systemMetrics = executionMonitor.getSystemMetrics();
    
    return NextResponse.json({
      success: true,
      data: systemMetrics
    });
  } catch (error) {
    console.error('[PipelineAPI] GET /api/vanguard/execute/pipeline error:', error);
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
