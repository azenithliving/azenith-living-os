// Service: Agent Scheduler
// بيوزع المهام على الأجهزة المتاحة

import { supabaseServer } from '@/lib/dal/unified-supabase';

export interface TaskSchedule {
  task_id: string;
  priority: number;
  scheduled_at: Date;
  device_id?: string;
}

export class AgentScheduler {
  // جلب المهام المنتظرة
  async getPendingTasks(agentKey: string, limit: number = 10): Promise<TaskSchedule[]> {
    const { data: agent } = await supabaseServer
      .from('agent_profiles')
      .select('id')
      .eq('agent_key', agentKey)
      .single();
    
    if (!agent) throw new Error('الـ Agent مش موجود');
    
    const { data: tasks } = await supabaseServer
      .from('agent_tasks')
      .select('*')
      .eq('agent_profile_id', agent.id)
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);
    
    return tasks?.map(t => ({
      task_id: t.id,
      priority: t.priority,
      scheduled_at: new Date(t.scheduled_at || t.created_at),
      device_id: t.device_id
    })) || [];
  }
  
  // توزيع مهمة على جهاز
  async assignTaskToDevice(taskId: string, deviceKey: string): Promise<boolean> {
    const { data: device } = await supabaseServer
      .from('agent_devices')
      .select('id, status')
      .eq('device_key', deviceKey)
      .single();
    
    if (!device) throw new Error('الجهاز مش موجود');
    if (device.status !== 'online') throw new Error('الجهاز مش متصل');
    
    const { error } = await supabaseServer
      .from('agent_tasks')
      .update({ 
        device_id: device.id,
        status: 'queued',
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId);
    
    return !error;
  }
  
  // اختيار أفضل جهاز متاح
  async getOptimalDevice(agentKey: string): Promise<string | null> {
    // جلب الأجهزة المتصلة مع أقل حمل
    const { data: devices } = await supabaseServer
      .from('agent_devices')
      .select('device_key, current_task_count, max_concurrent_tasks')
      .eq('status', 'online')
      .eq('is_active', true)
      .order('current_task_count', { ascending: true })
      .limit(1);
    
    if (!devices || devices.length === 0) return null;
    
    const device = devices[0];
    
    // شيك لو الجهاز عنده مكان للمهام الجديدة
    if (device.current_task_count >= device.max_concurrent_tasks) {
      return null;
    }
    
    return device.device_key;
  }
  
  // جدولة مهمة تلقائياً
  async autoSchedule(taskId: string): Promise<{ success: boolean; deviceKey?: string; error?: string }> {
    try {
      // جلب بيانات المهمة
      const { data: task } = await supabaseServer
        .from('agent_tasks')
        .select('*, agent_profiles(agent_key)')
        .eq('id', taskId)
        .single();
      
      if (!task) {
        return { success: false, error: 'المهمة مش موجودة' };
      }
      
      if (task.status !== 'pending') {
        return { success: false, error: 'المهمة مش في حالة الانتظار' };
      }
      
      const agentKey = task.agent_profiles?.agent_key;
      if (!agentKey) {
        return { success: false, error: 'الـ Agent مش محدد' };
      }
      
      // دور على أفضل جهاز
      const deviceKey = await this.getOptimalDevice(agentKey);
      if (!deviceKey) {
        return { success: false, error: 'مفيش أجهزة متاحة' };
      }
      
      // وزع المهمة
      const assigned = await this.assignTaskToDevice(taskId, deviceKey);
      if (!assigned) {
        return { success: false, error: 'مش قادر أوزع المهمة' };
      }
      
      return { success: true, deviceKey };
      
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  // إعادة جدولة مهمة فاشلة
  async rescheduleTask(taskId: string, delayMinutes: number = 5): Promise<boolean> {
    const newScheduledTime = new Date(Date.now() + delayMinutes * 60000);
    
    const { error } = await supabaseServer
      .from('agent_tasks')
      .update({
        status: 'pending',
        device_id: null,
        scheduled_at: newScheduledTime.toISOString(),
        retry_count: supabaseServer.rpc('increment'),
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId);
    
    return !error;
  }
}

export const agentScheduler = new AgentScheduler();
