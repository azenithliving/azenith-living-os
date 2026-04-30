// API Route: /api/admin/agents/heartbeat
// بيستقبل نبضات الحياة من الأجهزة (Docker nodes)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, agentDevicesDAL } from '@/lib/dal/unified-supabase';
import { z } from 'zod';

// التحقق من البيانات اللي جاية
const heartbeatSchema = z.object({
  device_key: z.string(),
  status: z.enum(['online', 'offline', 'busy', 'error']),
  cpu_percent: z.number().min(0).max(100).optional(),
  memory_percent: z.number().min(0).max(100).optional(),
  disk_percent: z.number().min(0).max(100).optional(),
  active_tasks: z.number().int().min(0).optional(),
  queue_depth: z.number().int().min(0).optional(),
  network_latency_ms: z.number().int().optional(),
  metadata: z.object({}).passthrough().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // تحقق من البيانات
    const parseResult = heartbeatSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'بيانات غير صحيحة', details: parseResult.error.message },
        { status: 400 }
      );
    }
    
    const data = parseResult.data;
    
    // دور على الجهاز في الداتابيز
    const { data: device, error: deviceError } = await supabaseServer
      .from('agent_devices')
      .select('id, company_id')
      .eq('device_key', data.device_key)
      .single();
    
    if (deviceError || !device) {
      return NextResponse.json(
        { success: false, error: 'الجهاز مش موجود' },
        { status: 404 }
      );
    }
    
    // سجل النبضة في الداتابيز
    const { error: heartbeatError } = await supabaseServer
      .from('agent_device_heartbeats')
      .insert({
        device_id: device.id,
        status: data.status,
        cpu_percent: data.cpu_percent,
        memory_percent: data.memory_percent,
        disk_percent: data.disk_percent,
        active_tasks: data.active_tasks || 0,
        queue_depth: data.queue_depth || 0,
        network_latency_ms: data.network_latency_ms,
        metadata: data.metadata || {},
        recorded_at: new Date().toISOString()
      });
    
    if (heartbeatError) {
      console.error('Heartbeat insert error:', heartbeatError);
      return NextResponse.json(
        { success: false, error: 'مش قادر أسجل النبضة' },
        { status: 500 }
      );
    }
    
    // حدّث حالة الجهاز
    await supabaseServer
      .from('agent_devices')
      .update({
        status: data.status,
        last_seen_at: new Date().toISOString(),
        current_task_count: data.active_tasks || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', device.id);
    
    return NextResponse.json({ 
      success: true, 
      message: 'تم تسجيل النبضة',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Heartbeat error:', error);
    return NextResponse.json(
      { success: false, error: 'خطأ في السيرفر' },
      { status: 500 }
    );
  }
}

// جلب آخر نبضات لجهاز معين
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceKey = searchParams.get('device_key');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    if (!deviceKey) {
      return NextResponse.json(
        { success: false, error: 'محتاج device_key' },
        { status: 400 }
      );
    }
    
    // دور على الجهاز
    const { data: device } = await supabaseServer
      .from('agent_devices')
      .select('id')
      .eq('device_key', deviceKey)
      .single();
    
    if (!device) {
      return NextResponse.json(
        { success: false, error: 'الجهاز مش موجود' },
        { status: 404 }
      );
    }
    
    // جلب آخر النبضات
    const { data: heartbeats, error } = await supabaseServer
      .from('agent_device_heartbeats')
      .select('*')
      .eq('device_id', device.id)
      .order('recorded_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ 
      success: true, 
      data: heartbeats 
    });
    
  } catch (error) {
    console.error('Get heartbeats error:', error);
    return NextResponse.json(
      { success: false, error: 'خطأ في السيرفر' },
      { status: 500 }
    );
  }
}
