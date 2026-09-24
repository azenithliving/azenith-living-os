/**
 * VANGUARD Automation API - Notifications
 * 
 * POST /api/vanguard/automation/notifications        - Send notification
 * POST /api/vanguard/automation/notifications/batch  - Send batch notifications
 * GET  /api/vanguard/automation/notifications/stats  - Get notification statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAutomationConsciousness } from '@/lib/vanguard/consciousness/automation_integration';
import { ConsciousnessCore } from '@/lib/vanguard/consciousness/consciousness_core';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      channel, 
      recipient, 
      title, 
      body: messageBody, 
      priority, 
      scheduledFor,
      templateId,
      templateData,
      batch,
      recipients
    } = body;

    const consciousness = ConsciousnessCore.getInstance();
    if (!consciousness) {
      return NextResponse.json(
        { error: 'Consciousness not initialized' },
        { status: 503 }
      );
    }

    const automation = await getAutomationConsciousness(consciousness);

    // Send from template
    if (templateId) {
      if (!recipient && !recipients) {
        return NextResponse.json(
          { error: 'recipient or recipients is required' },
          { status: 400 }
        );
      }

      const notificationId = await automation.sendTemplateNotification({
        templateId,
        recipient: recipient || recipients[0],
        templateData: templateData || {},
        priority: priority || 'normal',
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      });

      return NextResponse.json({
        success: true,
        notificationId,
        message: 'Template notification sent successfully',
      });
    }

    // Send batch
    if (batch || recipients) {
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return NextResponse.json(
          { error: 'recipients array is required for batch notifications' },
          { status: 400 }
        );
      }

      if (!channel || !title || !messageBody) {
        return NextResponse.json(
          { error: 'channel, title, and body are required' },
          { status: 400 }
        );
      }

      // Note: Batch notification requires direct access to notificationEngine
      // For now, send individual notifications
      const notificationIds: string[] = [];
      for (const rec of recipients) {
        const id = await automation.sendNotification({
          channel,
          recipient: rec,
          title,
          body: messageBody,
          priority: priority || 'normal',
        });
        notificationIds.push(id);
      }

      return NextResponse.json({
        success: true,
        notificationIds,
        count: notificationIds.length,
        message: 'Batch notifications sent successfully',
      });
    }

    // Send single notification
    if (!channel || !recipient || !title || !messageBody) {
      return NextResponse.json(
        { error: 'channel, recipient, title, and body are required' },
        { status: 400 }
      );
    }

    const notificationId = await automation.sendNotification({
      channel,
      recipient,
      title,
      body: messageBody,
      priority: priority || 'normal',
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
    });

    return NextResponse.json({
      success: true,
      notificationId,
      message: 'Notification sent successfully',
    });
  } catch (error) {
    console.error('[API] Notification send error:', error);
    return NextResponse.json(
      {
        error: 'Failed to send notification',
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

    if (action !== 'stats') {
      return NextResponse.json(
        { error: 'Invalid action. Use action=stats' },
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
    
    // Access notificationEngine directly through automation
    const { notificationEngine } = await import('@/lib/vanguard/automation/notifications');
    const stats = notificationEngine.getStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[API] Notification stats error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get notification statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
