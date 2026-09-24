/**
 * VANGUARD Automation API - Smart Routing
 * 
 * POST /api/vanguard/automation/routing/leads           - Route a lead
 * POST /api/vanguard/automation/routing/conversations   - Route a conversation
 * GET  /api/vanguard/automation/routing/stats           - Get routing statistics
 * GET  /api/vanguard/automation/routing/agents          - Get available agents
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAutomationConsciousness } from '@/lib/vanguard/consciousness/automation_integration';
import { ConsciousnessCore } from '@/lib/vanguard/consciousness/consciousness_core';
import { smartRouter } from '@/lib/vanguard/automation/routing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, entityId, priority, requiredSkills, preferredLanguage } = body;

    if (!type || !entityId) {
      return NextResponse.json(
        { error: 'type and entityId are required' },
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

    // Route based on type
    if (type === 'lead') {
      const result = await automation.routeLead({
        leadId: entityId,
        priority: priority || 'medium',
        requiredSkills: requiredSkills || [],
        preferredLanguage: preferredLanguage || 'ar',
      });

      return NextResponse.json({
        success: result.success,
        agentId: result.agentId,
        reason: result.reason,
        message: result.success ? 'Lead routed successfully' : 'Failed to route lead',
      });
    }

    if (type === 'conversation') {
      const result = await smartRouter.route({
        type: 'conversation',
        entityId,
        priority: priority || 'medium',
        requiredSkills,
        preferredLanguage,
      });

      return NextResponse.json({
        success: result.success,
        agentId: result.agentId,
        reason: result.reason,
        message: result.success ? 'Conversation routed successfully' : 'Failed to route conversation',
      });
    }

    return NextResponse.json(
      { error: 'Invalid type. Use lead or conversation' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Routing error:', error);
    return NextResponse.json(
      {
        error: 'Failed to route entity',
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

    const consciousness = ConsciousnessCore.getInstance();
    if (!consciousness) {
      return NextResponse.json(
        { error: 'Consciousness not initialized' },
        { status: 503 }
      );
    }

    const automation = await getAutomationConsciousness(consciousness);

    // Get statistics
    if (action === 'stats') {
      const stats = automation.getRoutingStats();

      return NextResponse.json({
        success: true,
        stats,
      });
    }

    // Get available agents
    if (action === 'agents') {
      const skills = searchParams.get('skills')?.split(',') || undefined;
      const languages = searchParams.get('languages')?.split(',') || undefined;
      const minCapacity = searchParams.get('minCapacity') 
        ? parseInt(searchParams.get('minCapacity')!)
        : undefined;

      const agents = smartRouter.getAvailableAgents({
        skills,
        languages,
        minCapacity,
      });

      return NextResponse.json({
        success: true,
        agents: agents.map(a => ({
          id: a.id,
          name: a.name,
          availability: a.availability,
          skills: a.skills,
          languages: a.languages,
          capacity: a.capacity,
          performance: a.performance,
        })),
        count: agents.length,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use stats or agents' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Routing GET error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process routing request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
