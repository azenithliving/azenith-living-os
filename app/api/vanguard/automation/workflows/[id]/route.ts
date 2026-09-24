/**
 * VANGUARD Automation API - Workflow Management
 * 
 * GET    /api/vanguard/automation/workflows/[id]        - Get workflow status
 * PUT    /api/vanguard/automation/workflows/[id]        - Control workflow (pause/resume)
 * DELETE /api/vanguard/automation/workflows/[id]        - Cancel workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAutomationConsciousness } from '@/lib/vanguard/consciousness/automation_integration';
import { ConsciousnessCore } from '@/lib/vanguard/consciousness/consciousness_core';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const executionId = id;

    const consciousness = ConsciousnessCore.getInstance();
    if (!consciousness) {
      return NextResponse.json(
        { error: 'Consciousness not initialized' },
        { status: 503 }
      );
    }

    const automation = await getAutomationConsciousness(consciousness);
    const workflowEngine = automation.getWorkflowEngine();

    const execution = workflowEngine.getExecution(executionId);

    if (!execution) {
      return NextResponse.json(
        { error: 'Workflow execution not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      execution: {
        id: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        completedSteps: execution.completedSteps,
        failedSteps: execution.failedSteps,
        error: execution.error,
      },
    });
  } catch (error) {
    console.error('[API] Workflow status error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get workflow status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const executionId = id;
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'action is required (pause|resume)' },
        { status: 400 }
      );
    }

    const consciousness = ConsciousnessCore.getInstance();
    if (!consciousness) {
      return NextResponse.json(
        { error: 'Consciousness not initialized' },
        { status: 503 }
      );
    }

    const automation = await getAutomationConsciousness(consciousness);

    const workflowEngine = automation.getWorkflowEngine();
    
    switch (action) {
      case 'pause':
        await workflowEngine.pauseExecution(executionId);
        break;
      case 'resume':
        await workflowEngine.resumeExecution(executionId);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use pause or resume' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      executionId,
      action,
      message: `Workflow ${action}d successfully`,
    });
  } catch (error) {
    console.error('[API] Workflow control error:', error);
    return NextResponse.json(
      {
        error: 'Failed to control workflow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const executionId = id;

    const consciousness = ConsciousnessCore.getInstance();
    if (!consciousness) {
      return NextResponse.json(
        { error: 'Consciousness not initialized' },
        { status: 503 }
      );
    }

    const automation = await getAutomationConsciousness(consciousness);
    const workflowEngine = automation.getWorkflowEngine();
    await workflowEngine.cancelExecution(executionId);

    return NextResponse.json({
      success: true,
      executionId,
      message: 'Workflow cancelled successfully',
    });
  } catch (error) {
    console.error('[API] Workflow cancel error:', error);
    return NextResponse.json(
      {
        error: 'Failed to cancel workflow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
