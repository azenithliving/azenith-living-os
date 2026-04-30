// API Route: /api/admin/agents/lock
// قفل الموارد علشان Agent واحد يستخدمها في نفس الوقت

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/dal/unified-supabase';
import { z } from 'zod';

// التحقق من بيانات القفل
const lockSchema = z.object({
  resource_type: z.enum(['browser', 'whatsapp', 'design_tool', 'cad_software', 'printer', 'file']),
  resource_id: z.string(),
  agent_id: z.string().uuid(),
  task_id: z.string().uuid(),
  lock_duration_seconds: z.number().int().min(30).max(3600).default(300) // 5 دقايق افتراضي
});

// محاولة قفل مورد
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // التحقق من البيانات
    const parseResult = lockSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'بيانات غير صحيحة', details: parseResult.error.message },
        { status: 400 }
      );
    }
    
    const data = parseResult.data;
    
    // شيك لو المورد مقفول من Agent تاني
    const { data: existingLock, error: checkError } = await supabaseServer
      .from('agent_tasks')
      .select('id, agent_profile_id, status, context')
      .eq('status', 'running')
      .filter('context->>locked_resource_type', 'eq', data.resource_type)
      .filter('context->>locked_resource_id', 'eq', data.resource_id)
      .single();
    
    if (existingLock && existingLock.agent_profile_id !== data.agent_id) {
      // المورد مقفول من Agent تاني
      return NextResponse.json(
        { 
          success: false, 
          error: 'المورد مقفول من Agent تاني',
          locked_by: existingLock.agent_profile_id,
          expires_at: existingLock.context?.lock_expires_at
        },
        { status: 423 } // Locked
      );
    }
    
    // قفل المورد عن طريق تحديث المهمة
    const expiresAt = new Date(Date.now() + data.lock_duration_seconds * 1000).toISOString();
    
    const { data: task, error } = await supabaseServer
      .from('agent_tasks')
      .update({
        context: {
          locked_resource_type: data.resource_type,
          locked_resource_id: data.resource_id,
          lock_expires_at: expiresAt,
          lock_acquired_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', data.task_id)
      .eq('agent_profile_id', data.agent_id)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'تم قفل المورد بنجاح',
      data: {
        resource_type: data.resource_type,
        resource_id: data.resource_id,
        locked_until: expiresAt
      }
    });
    
  } catch (error) {
    console.error('Lock error:', error);
    return NextResponse.json(
      { success: false, error: 'خطأ في السيرفر' },
      { status: 500 }
    );
  }
}

// فتح القفل
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('task_id');
    const agentId = searchParams.get('agent_id');
    
    if (!taskId || !agentId) {
      return NextResponse.json(
        { success: false, error: 'محتاج task_id و agent_id' },
        { status: 400 }
      );
    }
    
    // شيك على المهمة الأول
    const { data: task } = await supabaseServer
      .from('agent_tasks')
      .select('context')
      .eq('id', taskId)
      .eq('agent_profile_id', agentId)
      .single();
    
    if (!task) {
      return NextResponse.json(
        { success: false, error: 'المهمة مش موجودة' },
        { status: 404 }
      );
    }
    
    // امسح بيانات القفل
    const { context } = task;
    const newContext = { ...context };
    delete newContext.locked_resource_type;
    delete newContext.locked_resource_id;
    delete newContext.lock_expires_at;
    delete newContext.lock_acquired_at;
    
    await supabaseServer
      .from('agent_tasks')
      .update({
        context: newContext,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'تم فتح القفل بنجاح'
    });
    
  } catch (error) {
    console.error('Unlock error:', error);
    return NextResponse.json(
      { success: false, error: 'خطأ في السيرفر' },
      { status: 500 }
    );
  }
}

// جلب الموارد المقفولة حالياً
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    
    let query = supabaseServer
      .from('agent_tasks')
      .select(`
        id,
        agent_profile_id,
        agent_profiles(agent_key, name),
        context
      `)
      .eq('status', 'running')
      .not('context->>locked_resource_type', 'is', null);
    
    if (agentId) {
      query = query.eq('agent_profile_id', agentId);
    }
    
    const { data: locks, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // فلتر القفول المنتهية
    const now = new Date().toISOString();
    const activeLocks = (locks || []).filter((lock: any) => {
      return lock.context?.lock_expires_at > now;
    }).map((lock: any) => ({
      task_id: lock.id,
      agent_id: lock.agent_profile_id,
      agent_key: lock.agent_profiles?.agent_key,
      agent_name: lock.agent_profiles?.name,
      resource_type: lock.context?.locked_resource_type,
      resource_id: lock.context?.locked_resource_id,
      locked_until: lock.context?.lock_expires_at
    }));
    
    return NextResponse.json({ 
      success: true, 
      data: activeLocks 
    });
    
  } catch (error) {
    console.error('Get locks error:', error);
    return NextResponse.json(
      { success: false, error: 'خطأ في السيرفر' },
      { status: 500 }
    );
  }
}
