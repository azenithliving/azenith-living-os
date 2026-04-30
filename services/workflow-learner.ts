// Service: Workflow Learner
// يتعلم من التجارب ويحسن الأداء

import { supabaseServer } from '@/lib/dal/unified-supabase';

export interface WorkflowPattern {
  pattern_type: string;
  trigger: string;
  action: string;
  success_count: number;
  confidence: number;
}

export class WorkflowLearner {
  // تسجيل نجاح مهمة
  async recordSuccess(
    patternType: string, 
    trigger: string, 
    action: string, 
    context: any
  ): Promise<void> {
    // دور على نمط موجود
    const { data: existing } = await supabaseServer
      .from('agent_learnings')
      .select('*')
      .eq('lesson_type', 'success_pattern')
      .eq('context', `${patternType}:${trigger}:${action}`)
      .eq('company_id', context.company_id)
      .single();
    
    if (existing) {
      // حدث النمط الموجود
      await supabaseServer
        .from('agent_learnings')
        .update({
          used_count: existing.used_count + 1,
          success_count: (existing.success_count || 0) + 1,
          success_rate: Math.min(100, (existing.success_rate || 50) + 2),
          last_used_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      // أنشئ نمط جديد
      await supabaseServer
        .from('agent_learnings')
        .insert({
          company_id: context.company_id,
          agent_profile_id: context.agent_id,
          lesson_type: 'success_pattern',
          context: `${patternType}:${trigger}:${action}`,
          pattern: { trigger, action, context },
          success_rate: 75,
          used_count: 1,
          success_count: 1,
          last_used_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });
    }
  }
  
  // جلب اقتراحات بناءً على السياق
  async getSuggestedActions(context: string, companyId: string, limit: number = 3): Promise<string[]> {
    const { data: learnings } = await supabaseServer
      .from('agent_learnings')
      .select('*')
      .eq('company_id', companyId)
      .eq('lesson_type', 'success_pattern')
      .ilike('context', `%${context}%`)
      .order('success_rate', { ascending: false })
      .limit(limit);
    
    return learnings?.map(l => l.pattern?.action).filter(Boolean) || [];
  }
  
  // تسجيل فشل لتعلم الأخطاء
  async recordFailure(
    patternType: string,
    trigger: string,
    action: string,
    error: string,
    context: any
  ): Promise<void> {
    await supabaseServer
      .from('agent_learnings')
      .insert({
        company_id: context.company_id,
        agent_profile_id: context.agent_id,
        lesson_type: 'failure_avoidance',
        context: `${patternType}:${trigger}:${action}:${error}`,
        pattern: { trigger, action, error, context },
        success_rate: 0,
        used_count: 1,
        success_count: 0,
        created_at: new Date().toISOString()
      });
  }
}

export const workflowLearner = new WorkflowLearner();
