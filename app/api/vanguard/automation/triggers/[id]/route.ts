/**
 * VANGUARD Automation API - Trigger Management
 * 
 * GET    /api/vanguard/automation/triggers/[id]     - Get trigger details
 * PUT    /api/vanguard/automation/triggers/[id]     - Update trigger
 * DELETE /api/vanguard/automation/triggers/[id]     - Delete trigger
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
    const triggerId = id;

    const consciousness = ConsciousnessCore.getInstance();
    if (!consciousness) {
      return NextResponse.json(
        { error: 'Consciousness not initialized' },
        { status: 503 }
      );
    }

    const automation = await getAutomationConsciousness(consciousness);
    const triggerEngine = automation.getTriggerEngine();
    
    const trigger = triggerEngine.getTrigger(triggerId);

    if (!trigger) {
      return NextResponse.json(
        { error: 'Trigger not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      trigger,
    });
  } catch (error) {
    console.error('[API] Trigger get error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get trigger',
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
    const triggerId = id;
    const body = await request.json();
    const { action, enabled } = body;

    const consciousness = ConsciousnessCore.getInstance();
    if (!consciousness) {
      return NextResponse.json(
        { error: 'Consciousness not initialized' },
        { status: 503 }
      );
    }

    const automation = await getAutomationConsciousness(consciousness);
    const triggerEngine = automation.getTriggerEngine();

    // Enable/disable trigger
    if (action === 'enable' || enabled === true) {
      triggerEngine.enableTrigger(triggerId);
      return NextResponse.json({
        success: true,
        triggerId,
        message: 'Trigger enabled successfully',
      });
    }

    if (action === 'disable' || enabled === false) {
      triggerEngine.disableTrigger(triggerId);
      return NextResponse.json({
        success: true,
        triggerId,
        message: 'Trigger disabled successfully',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use enable or disable' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Trigger update error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update trigger',
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
    const triggerId = id;

    const consciousness = ConsciousnessCore.getInstance();
    if (!consciousness) {
      return NextResponse.json(
        { error: 'Consciousness not initialized' },
        { status: 503 }
      );
    }

    const automation = await getAutomationConsciousness(consciousness);
    const triggerEngine = automation.getTriggerEngine();
    
    await triggerEngine.deleteTrigger(triggerId);

    return NextResponse.json({
      success: true,
      triggerId,
      message: 'Trigger deleted successfully',
    });
  } catch (error) {
    console.error('[API] Trigger delete error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete trigger',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
