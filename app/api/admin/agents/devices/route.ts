// API Route: /api/admin/agents/devices
// إدارة الأجهزة (إضافة، جلب، تحديث)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, agentDevicesDAL } from '@/lib/dal/unified-supabase';
import { z } from 'zod';

// التحقق من بيانات الجهاز الجديد
const deviceSchema = z.object({
  device_key: z.string().min(3),
  device_type: z.enum(['powerhouse_linux', 'mobile_android', 'live_linux', 'docker_container']),
  hostname: z.string().optional(),
  capabilities: z.array(z.string()).default([]),
  max_concurrent_tasks: z.number().int().min(1).max(10).default(3),
  metadata: z.object({}).passthrough().optional()
});

// جلب كل الأجهزة
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    // TODO: Connect to Supabase when migrations are fixed
    // For now, return mock devices (Docker containers)
    const mockDevices = [
      {
        id: '1',
        device_key: 'powerhouse-alpha',
        device_type: 'docker_container',
        hostname: 'powerhouse-alpha',
        status: 'online',
        capabilities: ['browser', 'scrape', 'screenshot', 'research'],
        last_seen_at: new Date().toISOString(),
        current_task_count: 0,
        max_concurrent_tasks: 3,
        agent_device_heartbeats: [{
          status: 'online',
          recorded_at: new Date().toISOString(),
          cpu_percent: 15,
          memory_percent: 45,
          active_tasks: 0
        }]
      },
      {
        id: '2',
        device_key: 'powerhouse-beta',
        device_type: 'docker_container',
        hostname: 'powerhouse-beta',
        status: 'online',
        capabilities: ['browser', 'scrape', 'screenshot', 'research'],
        last_seen_at: new Date().toISOString(),
        current_task_count: 1,
        max_concurrent_tasks: 3,
        agent_device_heartbeats: [{
          status: 'online',
          recorded_at: new Date().toISOString(),
          cpu_percent: 12,
          memory_percent: 38,
          active_tasks: 1
        }]
      }
    ].filter(d => !status || d.status === status);
    
    return NextResponse.json({ 
      success: true, 
      data: mockDevices 
    });
    
  } catch (error) {
    console.error('Get devices error:', error);
    return NextResponse.json(
      { success: false, error: 'خطأ في السيرفر' },
      { status: 500 }
    );
  }
}

// إضافة جهاز جديد
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // التحقق من البيانات
    const parseResult = deviceSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'بيانات غير صحيحة', details: parseResult.error.message },
        { status: 400 }
      );
    }
    
    const data = parseResult.data;
    
    // شيك لو الجهاز موجود بالفعل
    const { data: existing } = await supabaseServer
      .from('agent_devices')
      .select('id')
      .eq('device_key', data.device_key)
      .single();
    
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'الجهاز موجود بالفعل' },
        { status: 409 }
      );
    }
    
    // أضف الجهاز الجديد
    const { data: device, error } = await supabaseServer
      .from('agent_devices')
      .insert({
        company_id: body.company_id || '00000000-0000-0000-0000-000000000000',
        device_key: data.device_key,
        device_type: data.device_type,
        hostname: data.hostname || data.device_key,
        status: 'offline',
        capabilities: data.capabilities,
        max_concurrent_tasks: data.max_concurrent_tasks,
        metadata: data.metadata || {},
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'تم إضافة الجهاز بنجاح',
      data: device 
    }, { status: 201 });
    
  } catch (error) {
    console.error('Create device error:', error);
    return NextResponse.json(
      { success: false, error: 'خطأ في السيرفر' },
      { status: 500 }
    );
  }
}

// تحديث جهاز
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { device_key, ...updates } = body;
    
    if (!device_key) {
      return NextResponse.json(
        { success: false, error: 'محتاج device_key' },
        { status: 400 }
      );
    }
    
    const { data: device, error } = await supabaseServer
      .from('agent_devices')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('device_key', device_key)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'تم التحديث بنجاح',
      data: device 
    });
    
  } catch (error) {
    console.error('Update device error:', error);
    return NextResponse.json(
      { success: false, error: 'خطأ في السيرفر' },
      { status: 500 }
    );
  }
}

// حذف جهاز
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceKey = searchParams.get('device_key');
    
    if (!deviceKey) {
      return NextResponse.json(
        { success: false, error: 'محتاج device_key' },
        { status: 400 }
      );
    }
    
    const { error } = await supabaseServer
      .from('agent_devices')
      .delete()
      .eq('device_key', deviceKey);
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'تم حذف الجهاز بنجاح'
    });
    
  } catch (error) {
    console.error('Delete device error:', error);
    return NextResponse.json(
      { success: false, error: 'خطأ في السيرفر' },
      { status: 500 }
    );
  }
}
