/**
 * VANGUARD Automation API - Triggers
 * 
 * POST   /api/vanguard/automation/triggers          - Create a trigger
 * GET    /api/vanguard/automation/triggers          - List all triggers
 * PUT    /api/vanguard/automation/triggers/:id      - Update trigger (enable/disable)
 * DELETE /api/vanguard/automation/triggers/:id      - Delete trigger
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAutomationConsciousness } from '@/lib/vanguard/consciousness/automation_integration';
import { ConsciousnessCore } from '@/lib/vanguard/consciousness/consciousness_core';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const trigger = body;

    if (!trigger.id || !trigger.name || !trigger.type) {
      return NextResponse.json(
        { error: 'id, name, and type are required' },
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
    await automation.addTrigger(trigger);

    return NextResponse.json({
      success: true,
      triggerId: trigger.id,
      message: 'Trigger created successfully',
    });
  } catch (error) {
    console.error('[API] Trigger create error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create trigger',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const consciousness = ConsciousnessCore.getInstance();
    if (!consciousness) {
      return NextResponse.json(
        { error: 'Consciousness not initialized' },
        { status: 503 }
      );
    }

    const automation = await getAutomationConsciousness(consciousness);
    const triggerEngine = automation.getTriggerEngine();
    
    const triggers = triggerEngine.getTriggers();

    return NextResponse.json({
      success: true,
      triggers: triggers.map((t: any) => ({
        id: t.id,
        name: t.name,
        nameAr: t.nameAr,
        type: t.type,
        enabled: t.enabled,
        priority: t.priority,
        executionCount: t.executionCount || 0,
      })),
      count: triggers.length,
    });
  } catch (error) {
    console.error('[API] Trigger list error:', error);
    return NextResponse.json(
      {
        error: 'Failed to list triggers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
