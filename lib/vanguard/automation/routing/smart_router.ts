/**
 * VANGUARD Phase 5: Smart Automation - Intelligent Routing System
 * 
 * نظام التوجيه الذكي - توزيع العملاء والمحادثات على الوكلاء
 * Intelligent lead/conversation routing based on skills, availability, and performance
 */

import { EventBus } from '../event_bus';
import { createClient } from '@/lib/supabase/client';

// ============================================================================
// Types
// ============================================================================

export type RoutingStrategy = 
  | 'round_robin'       // توزيع بالتناوب
  | 'least_busy'        // الأقل انشغالاً
  | 'skill_based'       // حسب المهارات
  | 'performance_based' // حسب الأداء
  | 'weighted'          // موزون حسب معايير متعددة
  | 'priority_based';   // حسب الأولوية

export type AgentAvailability = 
  | 'available'   // متاح
  | 'busy'        // مشغول
  | 'away'        // غائب
  | 'offline';    // غير متصل

export interface Agent {
  id: string;
  name: string;
  email: string;
  availability: AgentAvailability;
  skills: string[];
  languages: string[];
  maxConcurrentChats: number;
  currentChatCount: number;
  
  // Performance metrics
  performance: {
    averageResponseTime: number; // seconds
    resolutionRate: number;      // 0-100%
    satisfactionScore: number;   // 0-100
    totalConversations: number;
    activeConversations: number;
  };
  
  // Capacity
  capacity: {
    current: number;
    maximum: number;
    utilizationRate: number; // 0-100%
  };
  
  // Scheduling
  schedule?: {
    timezone: string;
    workingHours: {
      start: string; // HH:MM
      end: string;   // HH:MM
    };
    workingDays: number[]; // 0-6 (Sunday-Saturday)
  };
  
  metadata?: Record<string, any>;
}

export interface RoutingRequest {
  type: 'lead' | 'conversation' | 'task';
  entityId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requiredSkills?: string[];
  preferredLanguage?: string;
  metadata?: Record<string, any>;
}

export interface RoutingResult {
  success: boolean;
  agentId?: string;
  agent?: Agent;
  reason?: string;
  score?: number;
  alternativeAgents?: Array<{ agentId: string; score: number }>;
}

export interface RoutingRule {
  id: string;
  name: string;
  nameAr: string;
  priority: number;
  enabled: boolean;
  
  conditions: {
    leadSource?: string[];
    leadScore?: { min?: number; max?: number };
    requiredSkills?: string[];
    timeOfDay?: { start: string; end: string };
    dayOfWeek?: number[];
    customConditions?: Record<string, any>;
  };
  
  strategy: RoutingStrategy;
  targetAgents?: string[]; // Specific agents or null for all
  
  fallbackStrategy?: RoutingStrategy;
  
  metadata?: Record<string, any>;
}

// ============================================================================
// Smart Router
// ============================================================================

export class SmartRouter {
  private static instance: SmartRouter;
  private eventBus: EventBus;
  private agents: Map<string, Agent> = new Map();
  private rules: Map<string, RoutingRule> = new Map();
  private lastAssignmentIndex = 0; // For round robin
  
  private constructor() {
    this.eventBus = EventBus.getInstance();
    console.log('[SmartRouter] Initialized');
  }

  static getInstance(): SmartRouter {
    if (!SmartRouter.instance) {
      SmartRouter.instance = new SmartRouter();
    }
    return SmartRouter.instance;
  }

  // ============================================================================
  // Agent Management
  // ============================================================================

  /**
   * Register an agent
   */
  async registerAgent(agent: Agent): Promise<void> {
    this.agents.set(agent.id, agent);
    
    console.log(`[SmartRouter] Registered agent: ${agent.id} (${agent.name})`);
    
    await this.eventBus.publish(
      'system:error' as any, // Using system event as fallback
      { message: 'agent.registered', agentId: agent.id, name: agent.name }
    );
  }

  /**
   * Update agent availability
   */
  async updateAgentAvailability(agentId: string, availability: AgentAvailability): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const oldAvailability = agent.availability;
    agent.availability = availability;

    console.log(`[SmartRouter] Agent ${agentId} availability: ${oldAvailability} → ${availability}`);

    await this.eventBus.publish(
      'system:error' as any, // Using system event as fallback
      { message: 'agent.availability_changed', agentId, oldAvailability, newAvailability: availability }
    );
  }

  /**
   * Update agent capacity
   */
  async updateAgentCapacity(agentId: string, currentLoad: number): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    agent.capacity.current = currentLoad;
    agent.capacity.utilizationRate = (currentLoad / agent.capacity.maximum) * 100;
    agent.currentChatCount = currentLoad;

    // Auto-update availability based on capacity
    if (agent.capacity.utilizationRate >= 100) {
      agent.availability = 'busy';
    } else if (agent.availability === 'busy' && agent.capacity.utilizationRate < 80) {
      agent.availability = 'available';
    }
  }

  /**
   * Get available agents
   */
  getAvailableAgents(filters?: {
    skills?: string[];
    languages?: string[];
    minCapacity?: number;
  }): Agent[] {
    return Array.from(this.agents.values()).filter(agent => {
      // Check availability
      if (agent.availability !== 'available') return false;
      
      // Check capacity
      if (agent.capacity.utilizationRate >= 100) return false;
      
      // Check filters
      if (filters?.skills) {
        const hasRequiredSkills = filters.skills.every(skill => 
          agent.skills.includes(skill)
        );
        if (!hasRequiredSkills) return false;
      }
      
      if (filters?.languages) {
        const hasRequiredLanguage = filters.languages.some(lang =>
          agent.languages.includes(lang)
        );
        if (!hasRequiredLanguage) return false;
      }
      
      if (filters?.minCapacity !== undefined) {
        const availableCapacity = agent.capacity.maximum - agent.capacity.current;
        if (availableCapacity < filters.minCapacity) return false;
      }
      
      return true;
    });
  }

  // ============================================================================
  // Routing Rules
  // ============================================================================

  /**
   * Add routing rule
   */
  async addRoutingRule(rule: RoutingRule): Promise<void> {
    this.rules.set(rule.id, rule);
    console.log(`[SmartRouter] Added routing rule: ${rule.id} (${rule.nameAr})`);
  }

  /**
   * Get matching rule for request
   */
  private getMatchingRule(request: RoutingRequest): RoutingRule | null {
    const sortedRules = Array.from(this.rules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (this.evaluateRuleConditions(rule, request)) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Evaluate if rule conditions match request
   */
  private evaluateRuleConditions(rule: RoutingRule, request: RoutingRequest): boolean {
    const { conditions } = rule;
    
    // Check required skills
    if (conditions.requiredSkills && request.requiredSkills) {
      const hasRequiredSkills = conditions.requiredSkills.every(skill =>
        request.requiredSkills?.includes(skill)
      );
      if (!hasRequiredSkills) return false;
    }
    
    // Check time of day
    if (conditions.timeOfDay) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      if (currentTime < conditions.timeOfDay.start || currentTime > conditions.timeOfDay.end) {
        return false;
      }
    }
    
    // Check day of week
    if (conditions.dayOfWeek) {
      const today = new Date().getDay();
      if (!conditions.dayOfWeek.includes(today)) {
        return false;
      }
    }
    
    return true;
  }

  // ============================================================================
  // Routing Strategies
  // ============================================================================

  /**
   * Route request to best agent
   */
  async route(request: RoutingRequest): Promise<RoutingResult> {
    console.log(`[SmartRouter] Routing ${request.type}: ${request.entityId}`);

    // Get matching rule
    const rule = this.getMatchingRule(request);
    const strategy = rule?.strategy || 'weighted';

    // Get candidate agents
    let candidates = this.getAvailableAgents({
      skills: request.requiredSkills,
      languages: request.preferredLanguage ? [request.preferredLanguage] : undefined,
    });

    // Filter by rule's target agents if specified
    if (rule?.targetAgents) {
      candidates = candidates.filter(agent => rule.targetAgents?.includes(agent.id));
    }

    if (candidates.length === 0) {
      return {
        success: false,
        reason: 'No available agents matching criteria',
      };
    }

    // Apply routing strategy
    let selectedAgent: Agent | null = null;
    let score = 0;

    switch (strategy) {
      case 'round_robin':
        selectedAgent = this.routeRoundRobin(candidates);
        break;
      
      case 'least_busy':
        selectedAgent = this.routeLeastBusy(candidates);
        break;
      
      case 'skill_based':
        const skillResult = this.routeSkillBased(candidates, request);
        selectedAgent = skillResult.agent;
        score = skillResult.score;
        break;
      
      case 'performance_based':
        const perfResult = this.routePerformanceBased(candidates);
        selectedAgent = perfResult.agent;
        score = perfResult.score;
        break;
      
      case 'weighted':
        const weightedResult = this.routeWeighted(candidates, request);
        selectedAgent = weightedResult.agent;
        score = weightedResult.score;
        break;
      
      case 'priority_based':
        selectedAgent = this.routePriorityBased(candidates, request);
        break;
    }

    if (!selectedAgent) {
      return {
        success: false,
        reason: 'Routing strategy failed to select agent',
      };
    }

    // Update agent capacity
    await this.updateAgentCapacity(selectedAgent.id, selectedAgent.capacity.current + 1);

    // Publish routing event
    await this.eventBus.publish(
      'lead:assigned',
      {
        entityType: request.type,
        entityId: request.entityId,
        agentId: selectedAgent.id,
        strategy,
        score,
      }
    );

    console.log(`[SmartRouter] Routed to agent ${selectedAgent.id} (${selectedAgent.name}) - Score: ${score}`);

    return {
      success: true,
      agentId: selectedAgent.id,
      agent: selectedAgent,
      score,
      reason: `Assigned using ${strategy} strategy`,
    };
  }

  /**
   * Round Robin routing
   */
  private routeRoundRobin(agents: Agent[]): Agent {
    this.lastAssignmentIndex = (this.lastAssignmentIndex + 1) % agents.length;
    return agents[this.lastAssignmentIndex];
  }

  /**
   * Least Busy routing
   */
  private routeLeastBusy(agents: Agent[]): Agent {
    return agents.reduce((least, current) => 
      current.capacity.utilizationRate < least.capacity.utilizationRate ? current : least
    );
  }

  /**
   * Skill-Based routing
   */
  private routeSkillBased(agents: Agent[], request: RoutingRequest): { agent: Agent; score: number } {
    const scoredAgents = agents.map(agent => {
      let score = 0;
      
      // Score based on skill match
      if (request.requiredSkills) {
        const matchedSkills = request.requiredSkills.filter(skill => 
          agent.skills.includes(skill)
        );
        score = (matchedSkills.length / request.requiredSkills.length) * 100;
      } else {
        score = agent.skills.length * 10; // More skills = higher score
      }
      
      return { agent, score };
    });

    scoredAgents.sort((a, b) => b.score - a.score);
    return scoredAgents[0];
  }

  /**
   * Performance-Based routing
   */
  private routePerformanceBased(agents: Agent[]): { agent: Agent; score: number } {
    const scoredAgents = agents.map(agent => {
      const { performance } = agent;
      
      // Weighted performance score
      const score = (
        performance.satisfactionScore * 0.4 +
        performance.resolutionRate * 0.3 +
        (100 - Math.min(performance.averageResponseTime / 60, 100)) * 0.3
      );
      
      return { agent, score };
    });

    scoredAgents.sort((a, b) => b.score - a.score);
    return scoredAgents[0];
  }

  /**
   * Weighted routing (combines multiple factors)
   */
  private routeWeighted(agents: Agent[], request: RoutingRequest): { agent: Agent; score: number } {
    const scoredAgents = agents.map(agent => {
      let score = 0;
      
      // Availability score (40%)
      const availabilityScore = (1 - agent.capacity.utilizationRate / 100) * 40;
      
      // Performance score (30%)
      const performanceScore = (
        agent.performance.satisfactionScore * 0.4 +
        agent.performance.resolutionRate * 0.3 +
        (100 - Math.min(agent.performance.averageResponseTime / 60, 100)) * 0.3
      ) * 0.3;
      
      // Skill match score (20%)
      let skillScore = 0;
      if (request.requiredSkills) {
        const matchedSkills = request.requiredSkills.filter(skill =>
          agent.skills.includes(skill)
        );
        skillScore = (matchedSkills.length / request.requiredSkills.length) * 20;
      } else {
        skillScore = Math.min(agent.skills.length * 2, 20);
      }
      
      // Priority bonus (10%)
      const priorityBonus = request.priority === 'urgent' ? 10 : 
                           request.priority === 'high' ? 7 :
                           request.priority === 'medium' ? 4 : 0;
      
      score = availabilityScore + performanceScore + skillScore + priorityBonus;
      
      return { agent, score };
    });

    scoredAgents.sort((a, b) => b.score - a.score);
    return scoredAgents[0];
  }

  /**
   * Priority-Based routing
   */
  private routePriorityBased(agents: Agent[], request: RoutingRequest): Agent {
    if (request.priority === 'urgent' || request.priority === 'high') {
      // Route to best performing agent with capacity
      return this.routePerformanceBased(agents).agent;
    } else {
      // Route to least busy agent
      return this.routeLeastBusy(agents);
    }
  }

  // ============================================================================
  // Load Balancing
  // ============================================================================

  /**
   * Rebalance workload across agents
   */
  async rebalanceWorkload(): Promise<void> {
    const agents = Array.from(this.agents.values())
      .filter(a => a.availability === 'available');

    if (agents.length < 2) return;

    const avgUtilization = agents.reduce((sum, a) => sum + a.capacity.utilizationRate, 0) / agents.length;
    
    const overloaded = agents.filter(a => a.capacity.utilizationRate > avgUtilization + 20);
    const underutilized = agents.filter(a => a.capacity.utilizationRate < avgUtilization - 20);

    if (overloaded.length > 0 && underutilized.length > 0) {
      console.log(`[SmartRouter] Rebalancing: ${overloaded.length} overloaded, ${underutilized.length} underutilized`);
      
      await this.eventBus.publish(
        'system:anomaly_detected',
        {
          type: 'routing_rebalance_needed' as any,
          severity: 'medium',
          message: 'Routing rebalance needed',
          details: {
            avgUtilization,
            overloadedAgents: overloaded.map(a => a.id),
            underutilizedAgents: underutilized.map(a => a.id),
          },
        }
      );
    }
  }

  // ============================================================================
  // Analytics
  // ============================================================================

  /**
   * Get routing statistics
   */
  getRoutingStats(): {
    totalAgents: number;
    availableAgents: number;
    avgUtilization: number;
    totalCapacity: number;
    usedCapacity: number;
  } {
    const agents = Array.from(this.agents.values());
    const available = agents.filter(a => a.availability === 'available');
    
    const totalCapacity = agents.reduce((sum, a) => sum + a.capacity.maximum, 0);
    const usedCapacity = agents.reduce((sum, a) => sum + a.capacity.current, 0);
    const avgUtilization = agents.length > 0
      ? agents.reduce((sum, a) => sum + a.capacity.utilizationRate, 0) / agents.length
      : 0;

    return {
      totalAgents: agents.length,
      availableAgents: available.length,
      avgUtilization,
      totalCapacity,
      usedCapacity,
    };
  }
}

// Export singleton instance
export const smartRouter = SmartRouter.getInstance();
