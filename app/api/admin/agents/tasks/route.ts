// API Route: /api/admin/agents/tasks
// إدارة المهام (إضافة، جلب، تحديث الحالة)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, agentTasksDAL } from '@/lib/dal/unified-supabase';
import { z } from 'zod';

// التحقق من بيانات المهمة
const taskSchema = z.object({
  agent_key: z.enum(['prime', 'vanguard']),
  task_type: z.string().min(1),
  title: z.string().min(3),
  description: z.string().optional(),
  priority: z.number().int().min(-10).max(10).default(0),
  context: z.object({}).passthrough().optional(),
  scheduled_at: z.string().datetime().optional(),
  request_id: z.string().uuid().optional(),
  sales_order_id: z.string().uuid().optional(),
  production_job_id: z.string().uuid().optional()
});

// جلب المهام
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    // TODO: Connect to Supabase when migrations are fixed
    // For now, return mock tasks
    const mockTasks = [
      {
        id: '1',
        title: 'مهمة تجريبية لـ PRIME',
        status: 'pending',
        priority: 5,
        agent_key: 'prime',
        created_at: new Date().toISOString(),
        progress_percent: 0
      },
      {
        id: '2', 
        title: 'مهمة تجريبية لـ Vanguard',
        status: 'running',
        priority: 3,
        agent_key: 'vanguard',
        created_at: new Date().toISOString(),
        progress_percent: 50
      }
    ].filter(t => !status || t.status === status);
    
    return NextResponse.json({ 
      success: true, 
      data: mockTasks 
    });
    
  } catch (error) {
    console.error('Get tasks error:', error);
    return NextResponse.json(
      { success: false, error: 'خطأ في السيرفر' },
      { status: 500 }
    );
  }
}

// إضافة مهمة جديدة
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // التحقق من البيانات
    const parseResult = taskSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'بيانات غير صحيحة', details: parseResult.error.message },
        { status: 400 }
      );
    }
    
    const data = parseResult.data;
    
    // دور على الـ Agent
    const { data: agent, error: agentError } = await supabaseServer
      .from('agent_profiles')
      .select('id')
      .eq('agent_key', data.agent_key)
      .eq('company_id', body.company_id || '00000000-0000-0000-0000-000000000000')
      .single();
    
    if (agentError || !agent) {
      return NextResponse.json(
        { success: false, error: 'الـ Agent مش موجود' },
        { status: 404 }
      );
    }
    
    // أنشئ المهمة
    const { data: task, error } = await supabaseServer
      .from('agent_tasks')
      .insert({
        company_id: body.company_id || '00000000-0000-0000-0000-000000000000',
        agent_profile_id: agent.id,
        task_type: data.task_type,
        title: data.title,
        description: data.description,
        priority: data.priority,
        context: data.context || {},
        status: 'pending',
        scheduled_at: data.scheduled_at,
        request_id: data.request_id,
        sales_order_id: data.sales_order_id,
        production_job_id: data.production_job_id,
        retry_count: 0,
        max_retries: 3,
        progress_percent: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'تم إضافة المهمة بنجاح',
      data: task 
    }, { status: 201 });
    
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json(
      { success: false, error: 'خطأ في السيرفر' },
      { status: 500 }
    );
  }
}

// تحديث حالة المهمة
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { task_id, status, ...updates } = body;
    
    if (!task_id) {
      return NextResponse.json(
        { success: false, error: 'محتاج task_id' },
        { status: 400 }
      );
    }
    
    const updateData: any = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    if (status) {
      updateData.status = status;
      
      if (status === 'running') {
        updateData.started_at = new Date().toISOString();
      }
      
      if (status === 'completed' || status === 'failed') {
        updateData.completed_at = new Date().toISOString();
        
        // احسب المدة
        const { data: task } = await supabaseServer
          .from('agent_tasks')
          .select('started_at')
          .eq('id', task_id)
          .single();
        
        if (task?.started_at) {
          const duration = Math.round(
            (new Date().getTime() - new Date(task.started_at).getTime()) / 60000
          );
          updateData.actual_duration_minutes = duration;
        }
      }
    }
    
    const { data: task, error } = await supabaseServer
      .from('agent_tasks')
      .update(updateData)
      .eq('id', task_id)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'تم التحديث بنجاح',
      data: task 
    });
    
  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json(
      { success: false, error: 'خطأ في السيرفر' },
      { status: 500 }
    );
  }
}
