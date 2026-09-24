/**
 * VANGUARD Automation API - Workflows
 * 
 * POST   /api/vanguard/automation/workflows          - Start a workflow
 * GET    /api/vanguard/automation/workflows/:id      - Get workflow status
 * PUT    /api/vanguard/automation/workflows/:id/pause - Pause workflow
 * PUT    /api/vanguard/automation/workflows/:id/resume - Resume workflow
 * DELETE /api/vanguard/automation/workflows/:id      - Cancel workflow
 * GET    /api/vanguard/automation/workflows/templates - List templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAutomationConsciousness } from '@/lib/vanguard/consciousness/automation_integration';
import { ConsciousnessCore } from '@/lib/vanguard/consciousness/consciousness_core';
import { getAllWorkflowTemplates } from '@/lib/vanguard/automation/templates';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, variables, options } = body;

    if (!workflowId) {
      return NextResponse.json(
        { error: 'workflowId is required' },
        { status: 400 }
      );
    }

    // Get automation consciousness (assumes it's initialized)
    const consciousness = ConsciousnessCore.getInstance();
    if (!consciousness) {
      return NextResponse.json(
        { error: 'Consciousness not initialized' },
        { status: 503 }
      );
    }

    const automation = await getAutomationConsciousness(consciousness);

    // Start workflow
    const executionId = await automation.startWorkflow(
      workflowId,
      variables || {},
      options
    );

    return NextResponse.json({
      success: true,
      executionId,
      workflowId,
      message: 'Workflow started successfully',
    });
  } catch (error) {
    console.error('[API] Workflow start error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start workflow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // List templates
    if (action === 'templates') {
      const templates = getAllWorkflowTemplates();
      return NextResponse.json({
        success: true,
        templates: templates.map((t: any) => ({
          id: t.id,
          name: t.name,
          nameAr: t.nameAr,
          description: t.description,
          descriptionAr: t.descriptionAr,
          version: t.version,
          stepCount: t.steps.length,
          variables: Object.keys(t.variables || {}),
        })),
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Workflow GET error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
