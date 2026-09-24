/**
 * VANGUARD Automation API - Tasks
 * 
 * POST /api/vanguard/automation/tasks         - Schedule a task
 * GET  /api/vanguard/automation/tasks/:id     - Get task status
 * GET  /api/vanguard/automation/tasks/stats   - Get task statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAutomationConsciousness } from '@/lib/vanguard/consciousness/automation_integration';
import { ConsciousnessCore } from '@/lib/vanguard/consciousness/consciousness_core';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskType, data, options } = body;

    if (!taskType) {
      return NextResponse.json(
        { error: 'taskType is required' },
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

    // Schedule task
    const taskId = await automation.scheduleTask(
      taskType,
      data || {},
      {
        priority: options?.priority || 'MEDIUM',
        scheduledFor: options?.scheduledFor ? new Date(options.scheduledFor) : undefined,
        recurring: options?.recurring,
      }
    );

    return NextResponse.json({
      success: true,
      taskId,
      taskType,
      message: 'Task scheduled successfully',
    });
  } catch (error) {
    console.error('[API] Task schedule error:', error);
    return NextResponse.json(
      {
        error: 'Failed to schedule task',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('id');
    const action = searchParams.get('action');

    const consciousness = ConsciousnessCore.getInstance();
    if (!consciousness) {
      return NextResponse.json(
        { error: 'Consciousness not initialized' },
        { status: 503 }
      );
    }

    const automation = await getAutomationConsciousness(consciousness);

    // Get task status
    if (taskId) {
      const status = await automation.getTaskStatus(taskId);

      if (!status) {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        task: status,
      });
    }

    // Get statistics
    if (action === 'stats') {
      const taskQueue = automation.getTaskQueue();
      const stats = taskQueue.getStats();

      return NextResponse.json({
        success: true,
        stats,
      });
    }

    return NextResponse.json(
      { error: 'Invalid request. Provide id or action=stats' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Task GET error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
