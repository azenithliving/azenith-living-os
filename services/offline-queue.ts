// Service: Offline Queue
// طابور للمهام لما يكون النت مقطوع

import { supabaseServer } from '@/lib/dal/unified-supabase';

export interface QueuedAction {
  id: string;
  action_type: string;
  payload: any;
  retry_count: number;
  max_retries: number;
  created_at: Date;
}

export class OfflineQueueService {
  // إضافة مهمة للطابور
  async enqueue(
    actionType: string, 
    payload: any, 
    companyId: string,
    maxRetries: number = 3
  ): Promise<string> {
    const { data, error } = await supabaseServer
      .from('agent_tasks')
      .insert({
        company_id: companyId,
        task_type: 'offline_action',
        title: `Offline: ${actionType}`,
        context: { 
          action_type: actionType, 
          payload, 
          retry_count: 0, 
          max_retries: maxRetries 
        },
        status: 'pending',
        priority: 5,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();
    
    if (error) throw error;
    return data.id;
  }
  
  // جلب المهام المعلقة
  async getPendingActions(limit: number = 20): Promise<QueuedAction[]> {
    const { data } = await supabaseServer
      .from('agent_tasks')
      .select('*')
      .eq('task_type', 'offline_action')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);
    
    return data?.map(t => ({
      id: t.id,
      action_type: t.context?.action_type,
      payload: t.context?.payload,
      retry_count: t.context?.retry_count || 0,
      max_retries: t.context?.max_retries || 3,
      created_at: new Date(t.created_at)
    })) || [];
  }
  
  // علامة المهمة اكتملت
  async markCompleted(actionId: string): Promise<void> {
    await supabaseServer
      .from('agent_tasks')
      .update({ 
        status: 'completed', 
        completed_at: new Date().toISOString() 
      })
      .eq('id', actionId);
  }
  
  // زيادة عدد المحاولات
  async incrementRetry(actionId: string): Promise<number> {
    const { data } = await supabaseServer
      .from('agent_tasks')
      .select('context')
      .eq('id', actionId)
      .single();
    
    const newCount = (data?.context?.retry_count || 0) + 1;
    const maxRetries = data?.context?.max_retries || 3;
    
    await supabaseServer
      .from('agent_tasks')
      .update({
        context: { ...data?.context, retry_count: newCount },
        status: newCount >= maxRetries ? 'failed' : 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', actionId);
    
    return newCount;
  }
}

export const offlineQueue = new OfflineQueueService();
