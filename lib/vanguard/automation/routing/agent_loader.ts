/**
 * VANGUARD Phase 5: Smart Automation - Agent Data Loader
 * 
 * تحميل بيانات الوكلاء من قاعدة البيانات
 * Loads agent data from database and keeps it synchronized
 */

import { createClient } from '@/lib/supabase/client';
import { SmartRouter, Agent, AgentAvailability } from './smart_router';

export class AgentLoader {
  private static instance: AgentLoader;
  private router: SmartRouter;
  private syncInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.router = SmartRouter.getInstance();
  }

  static getInstance(): AgentLoader {
    if (!AgentLoader.instance) {
      AgentLoader.instance = new AgentLoader();
    }
    return AgentLoader.instance;
  }

  /**
   * Load all agents from database
   */
  async loadAgents(): Promise<void> {
    const supabase = createClient();
    
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'agent')
      .eq('is_active', true);

    if (error) {
      console.error('[AgentLoader] Failed to load agents:', error);
      throw error;
    }

    console.log(`[AgentLoader] Loading ${users?.length || 0} agents`);

    for (const user of users || []) {
      const agent = await this.buildAgentFromUser(user);
      await this.router.registerAgent(agent);
    }
  }

  /**
   * Build Agent object from database user
   */
  private async buildAgentFromUser(user: any): Promise<Agent> {
    const supabase = createClient();

    // Get agent's current workload
    const { data: conversations } = await supabase
      .from('vanguard_conversations')
      .select('id, status')
      .eq('assigned_agent_id', user.id)
      .in('status', ['active', 'waiting']);

    const currentChatCount = conversations?.length || 0;

    // Get agent performance metrics
    const { data: metrics } = await supabase
      .from('vanguard_agent_metrics')
      .select('*')
      .eq('agent_id', user.id)
      .single();

    // Parse metadata
    const metadata = user.metadata || {};
    const skills = metadata.skills || [];
    const languages = metadata.languages || ['ar', 'en'];
    const maxConcurrentChats = metadata.maxConcurrentChats || 5;
    const availability = (metadata.availability || 'available') as AgentAvailability;

    const agent: Agent = {
      id: user.id,
      name: user.full_name || user.email,
      email: user.email,
      availability,
      skills,
      languages,
      maxConcurrentChats,
      currentChatCount,
      
      performance: {
        averageResponseTime: metrics?.avg_response_time || 120,
        resolutionRate: metrics?.resolution_rate || 75,
        satisfactionScore: metrics?.satisfaction_score || 80,
        totalConversations: metrics?.total_conversations || 0,
        activeConversations: currentChatCount,
      },
      
      capacity: {
        current: currentChatCount,
        maximum: maxConcurrentChats,
        utilizationRate: (currentChatCount / maxConcurrentChats) * 100,
      },
      
      schedule: metadata.schedule || {
        timezone: 'Africa/Cairo',
        workingHours: {
          start: '09:00',
          end: '17:00',
        },
        workingDays: [0, 1, 2, 3, 4], // Sunday-Thursday
      },
      
      metadata: metadata,
    };

    return agent;
  }

  /**
   * Sync agent data periodically
   */
  startSync(intervalMs: number = 60000): void {
    if (this.syncInterval) {
      console.warn('[AgentLoader] Sync already running');
      return;
    }

    console.log(`[AgentLoader] Starting agent sync (interval: ${intervalMs}ms)`);

    this.syncInterval = setInterval(async () => {
      try {
        await this.syncAgentData();
      } catch (error) {
        console.error('[AgentLoader] Sync failed:', error);
      }
    }, intervalMs);

    // Initial sync
    this.syncAgentData().catch(console.error);
  }

  /**
   * Stop syncing
   */
  stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[AgentLoader] Stopped agent sync');
    }
  }

  /**
   * Sync agent availability and workload
   */
  private async syncAgentData(): Promise<void> {
    const supabase = createClient();
    
    const { data: users } = await supabase
      .from('users')
      .select('id, metadata')
      .eq('role', 'agent')
      .eq('is_active', true);

    if (!users) return;

    for (const user of users) {
      const { data: conversations } = await supabase
        .from('vanguard_conversations')
        .select('id')
        .eq('assigned_agent_id', user.id)
        .in('status', ['active', 'waiting']);

      const currentLoad = conversations?.length || 0;
      
      try {
        await this.router.updateAgentCapacity(user.id, currentLoad);
        
        // Update availability if changed
        const availability = user.metadata?.availability as AgentAvailability;
        if (availability) {
          await this.router.updateAgentAvailability(user.id, availability);
        }
      } catch (error) {
        // Agent might not be registered yet
        console.debug(`[AgentLoader] Could not update agent ${user.id}`);
      }
    }
  }

  /**
   * Update agent availability manually
   */
  async updateAgentAvailability(agentId: string, availability: AgentAvailability): Promise<void> {
    const supabase = createClient();
    
    // Update in database
    const { error } = await supabase
      .from('users')
      .update({
        metadata: {
          availability,
        },
      })
      .eq('id', agentId);

    if (error) throw error;

    // Update in router
    await this.router.updateAgentAvailability(agentId, availability);
  }
}

// Export singleton
export const agentLoader = AgentLoader.getInstance();
