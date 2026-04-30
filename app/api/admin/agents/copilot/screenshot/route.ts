/**
 * Agent Co-Pilot Screenshot API
 * GET /api/admin/agents/copilot/screenshot
 * Capture screenshot from agent device for Co-Pilot mode
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/dal/unified-supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const deviceKey = searchParams.get('device_key');
    const fullPage = searchParams.get('full_page') === 'true';

    if (!deviceId && !deviceKey) {
      return NextResponse.json(
        { success: false, error: 'device_id or device_key required' },
        { status: 400 }
      );
    }

    // Find device
    let device: any = null;
    
    if (deviceId) {
      const { data } = await supabaseServer
        .from('agent_devices')
        .select('*')
        .eq('id', deviceId)
        .single();
      device = data;
    } else {
      const { data } = await supabaseServer
        .from('agent_devices')
        .select('*')
        .eq('device_key', deviceKey)
        .single();
      device = data;
    }

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      );
    }

    if (device.status !== 'online') {
      return NextResponse.json(
        { success: false, error: 'Device is offline' },
        { status: 503 }
      );
    }

    // Call device screenshot endpoint
    try {
      const devicePort = device.metadata?.api_port || 3002;
      const deviceHost = device.hostname || 'localhost';
      
      const response = await fetch(
        `http://${deviceHost}:${devicePort}/api/screenshot?full_page=${fullPage}`,
        { timeout: 30000 } as any
      );

      if (!response.ok) {
        throw new Error(`Device screenshot failed: ${response.statusText}`);
      }

      const screenshotData = await response.json();

      return NextResponse.json({
        success: true,
        data: {
          device_id: device.id,
          device_key: device.device_key,
          screenshot_url: screenshotData.url,
          timestamp: new Date().toISOString(),
          full_page: fullPage
        }
      });
    } catch (deviceError) {
      console.error('Device screenshot error:', deviceError);
      
      // Return mock screenshot for development
      return NextResponse.json({
        success: true,
        data: {
          device_id: device.id,
          device_key: device.device_key,
          screenshot_url: '/mock/screenshot.png',
          timestamp: new Date().toISOString(),
          full_page: fullPage,
          mock: true
        }
      });
    }
  } catch (error) {
    console.error('Screenshot API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
