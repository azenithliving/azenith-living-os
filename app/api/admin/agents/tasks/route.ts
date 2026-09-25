// API Route: /api/admin/agents/tasks
// إدارة المهام (إضافة، جلب، تحديث الحالة)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, agentTasksDAL } from '@/lib/dal/unified-supabase';
import { resolveAdminCompanyId } from '@/lib/admin-company';
import { z } from 'zod';

// التحقق من بيانات المهمة
const taskSchema = z.object({
  agent_key: z.enum([
    'qayyim-core', 'qayyim-cont', 'qayyim-vis', 'qayyim-seo',
    'qayyim-ux', 'qayyim-ana', 'qayyim-dev', 'qayyim-qa',
    'prime',    // deprecated alias — kept for backward compat
    'vanguard',
  ]),
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
    const status = searchParams.get('status') || 'pending';
    const companyId = await resolveAdminCompanyId(searchParams.get('company_id'));
    
    if (!companyId) {
      return NextResponse.json({ success: true, data: [] });
    }
    
    if (status === 'all') {
      // كل الحالات مع عدّادات حقيقية لنفس نطاق الشركة
      const limitParam = parseInt(searchParams.get('limit') || '50', 10);
      const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 50, 1), 500);

      const [tasksRes, statusesRes] = await Promise.all([
        supabaseServer
          .from('agent_tasks')
          .select('*, agent_profiles(agent_key)')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(limit),
        supabaseServer
          .from('agent_tasks')
          .select('status')
          .eq('company_id', companyId),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (statusesRes.error) throw statusesRes.error;

      const statuses = (statusesRes.data || []).map((r: any) => r.status);
      const counts = {
        pending: statuses.filter((s: string) => s === 'pending').length,
        running: statuses.filter((s: string) => s === 'running').length,
        completed: statuses.filter((s: string) => s === 'completed').length,
        failed: statuses.filter((s: string) => s === 'failed').length,
        total: statuses.length,
      };

      return NextResponse.json({
        success: true,
        tasks: tasksRes.data,
        counts,
      });
    }

    let result;
    if (status === 'pending') {
      result = await agentTasksDAL.getPending(companyId);
    } else {
      // جلب المهام بناءً على الحالة
      result = await supabaseServer
        .from('agent_tasks')
        .select('*, agent_profiles(agent_key)')
        .eq('company_id', companyId)
        .eq('status', status)
        .order('created_at', { ascending: false });
    }

    if (result.error) throw result.error;

    return NextResponse.json({
      success: true,
      data: result.data
    });
    
  } catch (error: any) {
    console.error('Get tasks error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'خطأ في السيرفر' },
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
    
    const resolvedCompanyId = await resolveAdminCompanyId(body.company_id);
    if (!resolvedCompanyId) {
      return NextResponse.json(
        { success: false, error: 'لا توجد شركة مهيأة' },
        { status: 422 }
      );
    }
    
    // دور على الـ Agent — أو أنشئه لأول مرة
    let agentId: string | null = null;
    const { data: agent, error: agentError } = await supabaseServer
      .from('agent_profiles')
      .select('id')
      .eq('agent_key', data.agent_key)
      .eq('company_id', resolvedCompanyId)
      .single();
    
    if (agent) {
      agentId = agent.id;
    } else {
      // Agent profile does not exist for this company — auto-create it
      const { data: created, error: createErr } = await supabaseServer
        .from('agent_profiles')
        .insert({
          company_id: resolvedCompanyId,
          agent_key: data.agent_key,
          name: (data.agent_key === 'prime' || data.agent_key === 'qayyim-core')
            ? 'مدير تشغيل المحتوى — قيّم الدار'
            : data.agent_key.startsWith('qayyim-')
              ? `قيّم الدار — ${data.agent_key.replace('qayyim-', '')}`
              : 'VANGUARD',
          description: (data.agent_key === 'prime' || data.agent_key === 'qayyim-core')
            ? 'قائد سرب قيّم الدار — إطلالة الموقع'
            : data.agent_key.startsWith('qayyim-')
              ? 'وكيل سرب قيّم الدار'
              : 'وكيل المبيعات والعمليات',
          is_active: true,
        })
        .select('id')
        .single();
      if (createErr || !created) {
        return NextResponse.json(
          { success: false, error: 'تعذر إنشاء ملف الوكيل' },
          { status: 500 }
        );
      }
      agentId = created.id;
    }
    
    // أنشئ المهمة
    const { data: task, error } = await supabaseServer
      .from('agent_tasks')
      .insert({
        company_id: resolvedCompanyId,
        agent_profile_id: agentId,
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
