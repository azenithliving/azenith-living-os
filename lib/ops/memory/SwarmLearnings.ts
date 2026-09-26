/**
 * SwarmLearnings - Cross-agent learning system
 * Agents share patterns, anti-patterns, heuristics, templates
 */

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { sharedMemory } from "./SharedMemory";

export interface SwarmLearning {
  id: string;
  company_id: string;
  source_agent: string;
  target_agents: string[]; // empty = all agents
  lesson_type: 'pattern' | 'anti-pattern' | 'heuristic' | 'template' | 'best_practice';
  domain: string; // 'hero_copy', 'image_selection', 'seo_fix', 'ux_flow', 'arabic_tone', 'identity_rule', etc.
  
  pattern: Record<string, any>; // The extracted pattern/rule
  evidence: Record<string, any>; // Supporting evidence: {task_id, before_metrics, after_metrics, urls}
  
  confidence: number; // 0.0 to 1.0
  success_count: number;
  failure_count: number;
  last_validated_at: string | null;
  
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LearningSearchOptions {
  agentKey?: string;           // Find learnings for this agent
  domain?: string;             // Specific domain
  lessonType?: SwarmLearning['lesson_type'];
  minConfidence?: number;      // 0-1
  limit?: number;
  includeInactive?: boolean;
}

export interface LearningApplication {
  learningId: string;
  appliedByAgent: string;
  context: Record<string, any>;
  success: boolean;
  notes?: string;
  appliedAt: string;
}

export interface LearningStats {
  totalLearnings: number;
  activeLearnings: number;
  byDomain: Record<string, number>;
  byLessonType: Record<string, number>;
  bySourceAgent: Record<string, number>;
  avgConfidence: number;
  totalApplications: number;
  successRate: number;
}

export class SwarmLearnings {
  private supabase: any;
  private companyId: string | null = null;
  private localCache: Map<string, SwarmLearning> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.supabase = getSupabaseAdminClient();
  }

  // ============================================
  // Core Operations
  // ============================================

  /**
   * Create a new learning from agent experience
   */
  async create(learning: Omit<SwarmLearning, 'id' | 'company_id' | 'success_count' | 'failure_count' | 'last_validated_at' | 'created_at' | 'updated_at'>): Promise<string> {
    if (!this.companyId) await this.initialize();

    const { data, error } = await this.supabase
      .from('qayyim_swarm_learnings')
      .insert({
        company_id: this.companyId,
        source_agent: learning.source_agent,
        target_agents: learning.target_agents,
        lesson_type: learning.lesson_type,
        domain: learning.domain,
        pattern: learning.pattern,
        evidence: learning.evidence,
        confidence: learning.confidence,
        is_active: learning.is_active ?? true,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Get learning by ID
   */
  async getById(id: string): Promise<SwarmLearning | null> {
    if (!this.companyId) await this.initialize();

    // Check cache first
    const cached = this.localCache.get(id);
    const expiry = this.cacheExpiry.get(id);
    if (cached && expiry && expiry > Date.now()) {
      return cached;
    }

    const { data, error } = await this.supabase
      .from('qayyim_swarm_learnings')
      .select('*')
      .eq('id', id)
      .eq('company_id', this.companyId)
      .single();

    if (error || !data) return null;

    const learning = data as SwarmLearning;
    this.localCache.set(id, learning);
    this.cacheExpiry.set(id, Date.now() + this.CACHE_TTL);
    return learning;
  }

  /**
   * Search learnings with filters
   */
  async search(options: LearningSearchOptions = {}): Promise<SwarmLearning[]> {
    if (!this.companyId) await this.initialize();

    let query = this.supabase
      .from('qayyim_swarm_learnings')
      .select('*')
      .eq('company_id', this.companyId);

    if (!options.includeInactive) {
      query = query.eq('is_active', true);
    }

    if (options.domain) {
      query = query.eq('domain', options.domain);
    }

    if (options.lessonType) {
      query = query.eq('lesson_type', options.lessonType);
    }

    if (options.minConfidence !== undefined) {
      query = query.gte('confidence', options.minConfidence);
    }

    if (options.agentKey) {
      // Match target_agents that include this agent OR empty array (all agents)
      query = query.or(`target_agents.cs.{${options.agentKey}},target_agents.eq.{}`);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    query = query.order('confidence', { ascending: false })
                .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as SwarmLearning[];
  }

  /**
   * Get learnings for a specific agent
   */
  async getForAgent(agentKey: string, options: {
    domain?: string;
    limit?: number;
  } = {}): Promise<SwarmLearning[]> {
    return this.search({
      agentKey,
      domain: options.domain,
      limit: options.limit,
    });
  }

  /**
   * Get learnings by source agent
   */
  async getBySourceAgent(sourceAgent: string, limit: number = 20): Promise<SwarmLearning[]> {
    if (!this.companyId) await this.initialize();

    const { data, error } = await this.supabase
      .from('qayyim_swarm_learnings')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('source_agent', sourceAgent)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as SwarmLearning[];
  }

  /**
   * Record learning application outcome
   */
  async recordApplication(application: Omit<LearningApplication, 'appliedAt'>): Promise<void> {
    if (!this.companyId) await this.initialize();

    const { error } = await this.supabase
      .from('qayyim_learning_applications')
      .insert({
        company_id: this.companyId,
        learning_id: application.learningId,
        applied_by_agent: application.appliedByAgent,
        context: application.context,
        success: application.success,
        notes: application.notes,
      });

    if (error) throw error;

    // Update success/failure counts on the learning
    await this.recordOutcome(application.learningId, application.success);
  }

  /**
   * Record learning outcome (success/failure)
   */
  async recordOutcome(learningId: string, success: boolean): Promise<void> {
    if (!this.companyId) await this.initialize();

    const { data: current } = await this.supabase
      .from('qayyim_swarm_learnings')
      .select('success_count, failure_count')
      .eq('id', learningId)
      .eq('company_id', this.companyId)
      .single();

    if (!current) return;

    await this.supabase
      .from('qayyim_swarm_learnings')
      .update({
        success_count: success ? current.success_count + 1 : current.success_count,
        failure_count: success ? current.failure_count : current.failure_count + 1,
        last_validated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', learningId)
      .eq('company_id', this.companyId);

    // Invalidate cache
    this.localCache.delete(learningId);
    this.cacheExpiry.delete(learningId);
  }

  /**
   * Update learning confidence based on outcomes
   */
  async recalculateConfidence(learningId: string): Promise<number> {
    if (!this.companyId) await this.initialize();

    const { data: current } = await this.supabase
      .from('qayyim_swarm_learnings')
      .select('success_count, failure_count, confidence')
      .eq('id', learningId)
      .eq('company_id', this.companyId)
      .single();

    if (!current) return 0;

    const total = current.success_count + current.failure_count;
    if (total === 0) return current.confidence;

    // Wilson score interval for confidence
    const z = 1.96; // 95% confidence
    const p = current.success_count / total;
    const denominator = 1 + z * z / total;
    const centre = p + z * z / (2 * total);
    const adjustment = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total));
    const newConfidence = (centre - adjustment) / denominator;

    await this.supabase
      .from('qayyim_swarm_learnings')
      .update({
        confidence: Math.round(newConfidence * 100) / 100,
        last_validated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', learningId)
      .eq('company_id', this.companyId);

    this.localCache.delete(learningId);
    this.cacheExpiry.delete(learningId);

    return newConfidence;
  }

  /**
   * Deactivate a learning (soft delete)
   */
  async deactivate(learningId: string, reason?: string): Promise<void> {
    if (!this.companyId) await this.initialize();

    await this.supabase
      .from('qayyim_swarm_learnings')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
        pattern: { ...(await this.getById(learningId))?.pattern, deactivation_reason: reason },
      })
      .eq('id', learningId)
      .eq('company_id', this.companyId);

    this.localCache.delete(learningId);
    this.cacheExpiry.delete(learningId);
  }

  /**
   * Reactivate a learning
   */
  async reactivate(learningId: string): Promise<void> {
    if (!this.companyId) await this.initialize();

    await this.supabase
      .from('qayyim_swarm_learnings')
      .update({
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', learningId)
      .eq('company_id', this.companyId);

    this.localCache.delete(learningId);
    this.cacheExpiry.delete(learningId);
  }

  // ============================================
  // Learning Transfer & Sharing
  // ============================================

  /**
   * Share a learning with specific agents
   */
  async shareWithAgents(learningId: string, targetAgents: string[]): Promise<void> {
    if (!this.companyId) await this.initialize();

    const learning = await this.getById(learningId);
    if (!learning) throw new Error('Learning not found');

    const newTargets = Array.from(new Set([...learning.target_agents, ...targetAgents]));

    await this.supabase
      .from('qayyim_swarm_learnings')
      .update({
        target_agents: newTargets,
        updated_at: new Date().toISOString(),
      })
      .eq('id', learningId)
      .eq('company_id', this.companyId);

    this.localCache.delete(learningId);
    this.cacheExpiry.delete(learningId);

    // Notify target agents via sync layer
    const { syncLayer } = await import('./SyncLayer');
    await syncLayer.publishLearningCreated('system', learningId, learning.domain, targetAgents);
  }

  /**
   * Broadcast learning to all agents
   */
  async broadcast(learningId: string): Promise<void> {
    await this.shareWithAgents(learningId, []);
  }

  /**
   * Find similar learnings across domains
   */
  async findSimilar(learningId: string, limit: number = 5): Promise<SwarmLearning[]> {
    const learning = await this.getById(learningId);
    if (!learning) return [];

    // Use sharedMemory for semantic search
    const results = await sharedMemory.searchSimilar(
      JSON.stringify(learning.pattern),
      {
        memoryTypes: ['pattern'],
        limit: limit + 1,
        minSimilarity: 0.75,
      }
    );

    // Filter out the original learning
    return results
      .filter(r => r.item.id !== learningId)
      .map(r => r.item as unknown as SwarmLearning)
      .slice(0, limit);
  }

  // ============================================
  // Statistics & Analytics
  // ============================================

  async getStats(): Promise<LearningStats> {
    if (!this.companyId) await this.initialize();

    const { data: learnings } = await this.supabase
      .from('qayyim_swarm_learnings')
      .select('domain, lesson_type, source_agent, confidence, is_active, success_count, failure_count')
      .eq('company_id', this.companyId);

    const { data: applications } = await this.supabase
      .from('qayyim_learning_applications')
      .select('success', { count: 'exact', head: false })
      .eq('company_id', this.companyId);

    const learningsArray = learnings || [];
    const activeLearnings = learningsArray.filter((l: any) => l.is_active);

    const byDomain: Record<string, number> = {};
    const byLessonType: Record<string, number> = {};
    const bySourceAgent: Record<string, number> = {};

    for (const l of learningsArray) {
      byDomain[l.domain] = (byDomain[l.domain] || 0) + 1;
      byLessonType[l.lesson_type] = (byLessonType[l.lesson_type] || 0) + 1;
      bySourceAgent[l.source_agent] = (bySourceAgent[l.source_agent] || 0) + 1;
    }

    const avgConfidence = learningsArray.length > 0
      ? learningsArray.reduce((sum: number, l: { confidence: number }) => sum + l.confidence, 0) / learningsArray.length
      : 0;

    const totalApplications = applications?.length || 0;
    const successfulApplications = applications?.filter((a: any) => a.success).length || 0;
    const successRate = totalApplications > 0 ? successfulApplications / totalApplications : 0;

    return {
      totalLearnings: learningsArray.length,
      activeLearnings: activeLearnings.length,
      byDomain,
      byLessonType,
      bySourceAgent,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      totalApplications,
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Get top learnings by domain
   */
  async getTopByDomain(domain: string, limit: number = 10): Promise<SwarmLearning[]> {
    return this.search({ domain, limit, minConfidence: 0.6 });
  }

  /**
   * Get learnings that need validation (low confidence or old)
   */
  async getNeedingValidation(limit: number = 20): Promise<SwarmLearning[]> {
    if (!this.companyId) await this.initialize();

    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const { data, error } = await this.supabase
      .from('qayyim_swarm_learnings')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('is_active', true)
      .or(`confidence.lt.0.6,last_validated_at.is.null,last_validated_at.lt.${cutoffDate}`)
      .order('confidence', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data || []) as SwarmLearning[];
  }

  /**
   * Auto-promote high-confidence learnings to templates
   */
  async promoteToTemplate(learningId: string): Promise<void> {
    const learning = await this.getById(learningId);
    if (!learning) throw new Error('Learning not found');

    if (learning.confidence < 0.85) {
      throw new Error('Learning confidence too low for template promotion (min 0.85)');
    }

    await this.supabase
      .from('qayyim_swarm_learnings')
      .update({
        lesson_type: 'template',
        pattern: { ...learning.pattern, promoted_to_template: true, promoted_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq('id', learningId)
      .eq('company_id', this.companyId);

    this.localCache.delete(learningId);
    this.cacheExpiry.delete(learningId);
  }

  // ============================================
  // Maintenance
  // ============================================

  async initialize(companyId?: string) {
    this.companyId = await resolveAdminCompanyId(companyId);
    if (!this.companyId) {
      throw new Error('Company ID not resolved');
    }
  }

  async cleanupInactive(olderThanDays: number = 30): Promise<number> {
    if (!this.companyId) await this.initialize();

    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from('qayyim_swarm_learnings')
      .delete()
      .eq('company_id', this.companyId)
      .eq('is_active', false)
      .lt('updated_at', cutoffDate)
      .select('id');

    if (error) throw error;
    return data?.length || 0;
  }

  /**
   * Create the learning applications table
   */
  static async createTables(supabase: any): Promise<void> {
    await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS public.qayyim_learning_applications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID,
          learning_id UUID NOT NULL REFERENCES qayyim_swarm_learnings(id) ON DELETE CASCADE,
          applied_by_agent TEXT NOT NULL,
          context JSONB DEFAULT '{}',
          success BOOLEAN NOT NULL,
          notes TEXT,
          applied_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_learning_apps_company ON public.qayyim_learning_applications(company_id);
        CREATE INDEX IF NOT EXISTS idx_learning_apps_learning ON public.qayyim_learning_applications(learning_id);
        CREATE INDEX IF NOT EXISTS idx_learning_apps_agent ON public.qayyim_learning_applications(applied_by_agent);
        CREATE INDEX IF NOT EXISTS idx_learning_apps_success ON public.qayyim_learning_applications(success);
        CREATE INDEX IF NOT EXISTS idx_learning_apps_applied ON public.qayyim_learning_applications(applied_at);
      `
    });
  }

  clearCache() {
    this.localCache.clear();
    this.cacheExpiry.clear();
  }
}

export const swarmLearnings = new SwarmLearnings();
