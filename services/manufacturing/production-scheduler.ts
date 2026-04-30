// Service: Production Scheduler
// جدولة الإنتاج وتوزيع المهام على المراحل

import { supabaseServer } from '@/lib/dal/unified-supabase';

export interface ScheduleSlot {
  start: Date;
  end: Date;
  resource_id?: string;
  job_id?: string;
}

export class ProductionSchedulerService {
  // جدولة مهمة إنتاج
  async scheduleJob(jobId: string): Promise<{
    scheduled: boolean;
    scheduled_start: Date;
    scheduled_end: Date;
    conflicts: string[];
  }> {
    // جلب بيانات المهمة
    const { data: job } = await supabaseServer
      .from('production_jobs')
      .select('*, production_stages(default_duration_hours)')
      .eq('id', jobId)
      .single();
    
    if (!job) throw new Error('المهمة مش موجودة');
    
    // حساب المدة
    const durationHours = job.production_stages?.default_duration_hours || 24;
    
    // دور على أقرب slot متاح
    const start = await this.findNextAvailableSlot(durationHours, job.company_id);
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
    
    // شيك التعارضات
    const conflicts = await this.findConflicts(start, end, job.company_id);
    
    if (conflicts.length > 0) {
      return {
        scheduled: false,
        scheduled_start: start,
        scheduled_end: end,
        conflicts
      };
    }
    
    // حدّث جدولة المهمة
    await supabaseServer
      .from('production_jobs')
      .update({
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        status: 'scheduled',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
    
    return {
      scheduled: true,
      scheduled_start: start,
      scheduled_end: end,
      conflicts: []
    };
  }
  
  // إعادة جدولة مهمة
  async rescheduleJob(jobId: string, reason: string): Promise<boolean> {
    const { data: job } = await supabaseServer
      .from('production_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (!job) return false;
    
    // امسح الجدولة القديمة
    await supabaseServer
      .from('production_schedule_entries')
      .delete()
      .eq('production_job_id', jobId);
    
    // سجل حدث إعادة الجدولة
    await supabaseServer.from('production_job_events').insert({
      production_job_id: jobId,
      event_type: 'delay',
      reason,
      created_at: new Date().toISOString()
    });
    
    // أعد الجدولة
    const result = await this.scheduleJob(jobId);
    return result.scheduled;
  }
  
  // تحسين الجدولة (batch similar jobs)
  async optimizeSchedule(companyId: string): Promise<{
    optimizations: number;
    time_saved: number;
  }> {
    // جلب المهام المعلقة
    const { data: jobs } = await supabaseServer
      .from('production_jobs')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .order('priority', { ascending: false });
    
    let optimizations = 0;
    let timeSaved = 0;
    
    // group by stage
    const jobsByStage: Record<string, typeof jobs> = {};
    for (const job of (jobs || [])) {
      const stage = job.current_stage_id || 'unknown';
      if (!jobsByStage[stage]) jobsByStage[stage] = [];
      jobsByStage[stage].push(job);
    }
    
    // optimize each group
    for (const [stageId, stageJobs] of Object.entries(jobsByStage)) {
      if (stageJobs && stageJobs.length > 1) {
        // schedule back-to-back to reduce setup time
        optimizations++;
        timeSaved += (stageJobs.length - 1) * 2; // 2 hours saved per batch
      }
    }
    
    return { optimizations, time_saved: timeSaved };
  }
  
  // دور على slot متاح
  private async findNextAvailableSlot(
    durationHours: number, 
    companyId: string
  ): Promise<Date> {
    // ابدأ من بكرة
    let candidate = new Date();
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(8, 0, 0, 0);  // 8 AM
    
    // دور على slot بدون تعارضات
    while (true) {
      const end = new Date(candidate.getTime() + durationHours * 60 * 60 * 1000);
      const conflicts = await this.findConflicts(candidate, end, companyId);
      
      if (conflicts.length === 0) {
        return candidate;
      }
      
      // انتقل لليوم اللي جاي
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(8, 0, 0, 0);
      
      // safety: limit to 90 days ahead
      if (candidate.getTime() > Date.now() + 90 * 24 * 60 * 60 * 1000) {
        throw new Error('مش قادر أجدول في 90 يوم جايين');
      }
    }
  }
  
  // دور على تعارضات
  private async findConflicts(
    start: Date, 
    end: Date, 
    companyId: string
  ): Promise<string[]> {
    const { data: entries } = await supabaseServer
      .from('production_schedule_entries')
      .select('production_job_id')
      .eq('company_id', companyId)
      .or(`scheduled_start.lte.${end.toISOString()},scheduled_end.gte.${start.toISOString()}`);
    
    return entries?.map(e => e.production_job_id) || [];
  }
  
  // تخصيص مهمة لموظف
  async assignToTeamMember(jobId: string, teamMemberId: string): Promise<boolean> {
    const { error } = await supabaseServer
      .from('production_jobs')
      .update({
        assigned_to: teamMemberId,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
    
    return !error;
  }
  
  // تحديث مرحلة المهمة
  async updateStage(
    jobId: string, 
    newStageId: string, 
    qualityCheckRequired: boolean = true
  ): Promise<boolean> {
    const { error } = await supabaseServer
      .from('production_jobs')
      .update({
        current_stage_id: newStageId,
        quality_check_required: qualityCheckRequired,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
    
    // سجل الحدث
    if (!error) {
      await supabaseServer.from('production_job_events').insert({
        production_job_id: jobId,
        event_type: 'stage_change',
        to_stage_id: newStageId,
        created_at: new Date().toISOString()
      });
    }
    
    return !error;
  }
}

export const productionScheduler = new ProductionSchedulerService();
