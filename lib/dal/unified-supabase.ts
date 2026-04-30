/**
 * Unified Data Access Layer (DAL)
 * 
 * This is the SINGLE source of truth for all database access.
 * All other database utilities are deprecated and should migrate to this.
 * 
 * @deprecated utils/supabase/server.ts - Use this file instead
 * @deprecated lib/supabase-server.ts - Use this file instead
 * @deprecated lib/supabase-service.ts - Use this file instead
 * @deprecated aaca/database/database-service.ts - Use this file instead
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// ===========================================
// CLIENT INSTANCES
// ===========================================

/**
 * Server-side client with anon key (for RLS-respecting operations)
 * Use this when you need to respect Row Level Security policies
 */
export const supabaseAnon = createClient(
  supabaseUrl,
  supabaseAnonKey
);

/**
 * Server-side client with service role key (for admin operations)
 * ⚠️ WARNING: This bypasses RLS. Use with caution!
 * Only use for: background jobs, admin operations, agent tasks
 */
export const supabaseServer = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : supabaseAnon;  // Fallback to anon if service key not available

// ===========================================
// TYPE EXPORTS
// ===========================================

export type Tables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Row'];

export type InsertTables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Insert'];

export type UpdateTables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Update'];

// ===========================================
// COMPANY-SCOPED QUERIES
// ===========================================

/**
 * Helper to add company_id filter to any query
 */
export function withCompany<T>(
  query: any,
  companyId: string
) {
  return query.eq('company_id', companyId);
}

// ===========================================
// TABLE-SPECIFIC HELPERS
// ===========================================

/**
 * Users
 */
export const usersDAL = {
  async getById(id: string) {
    return supabaseServer
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
  },

  async getByAuthId(authUserId: string) {
    return supabaseServer
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();
  },

  async getByEmail(email: string) {
    return supabaseServer
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
  },

  async getByCompany(companyId: string) {
    return supabaseServer
      .from('users')
      .select('*')
      .eq('company_id', companyId);
  }
};

/**
 * Companies
 */
export const companiesDAL = {
  async getById(id: string) {
    return supabaseServer
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();
  },

  async getBySlug(slug: string) {
    return supabaseServer
      .from('companies')
      .select('*')
      .eq('slug', slug)
      .single();
  }
};

/**
 * Agent Profiles
 */
export const agentProfilesDAL = {
  async getByKey(agentKey: string, companyId: string) {
    return supabaseServer
      .from('agent_profiles')
      .select('*')
      .eq('agent_key', agentKey)
      .eq('company_id', companyId)
      .single();
  },

  async getAll(companyId: string) {
    return supabaseServer
      .from('agent_profiles')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true);
  }
};

/**
 * Agent Devices
 */
export const agentDevicesDAL = {
  async getByKey(deviceKey: string, companyId: string) {
    return supabaseServer
      .from('agent_devices')
      .select('*')
      .eq('device_key', deviceKey)
      .eq('company_id', companyId)
      .single();
  },

  async getOnline(companyId: string) {
    return supabaseServer
      .from('agent_devices')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'online');
  },

  async updateHeartbeat(deviceId: string, data: {
    status: string;
    cpu_percent?: number;
    memory_percent?: number;
    active_tasks?: number;
  }) {
    // Insert heartbeat
    await supabaseServer
      .from('agent_device_heartbeats')
      .insert({
        device_id: deviceId,
        ...data,
        recorded_at: new Date().toISOString()
      });

    // Update device status
    return supabaseServer
      .from('agent_devices')
      .update({
        status: data.status,
        last_seen_at: new Date().toISOString()
      })
      .eq('id', deviceId);
  }
};

/**
 * Agent Tasks
 */
export const agentTasksDAL = {
  async create(data: {
    company_id: string;
    agent_profile_id?: string;
    device_id?: string;
    task_type: string;
    title: string;
    description?: string;
    priority?: number;
    context?: any;
    request_id?: string;
    sales_order_id?: string;
    production_job_id?: string;
    scheduled_at?: string;
  }) {
    return supabaseServer
      .from('agent_tasks')
      .insert({
        ...data,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
  },

  async getById(id: string) {
    return supabaseServer
      .from('agent_tasks')
      .select('*, agent_profiles(agent_key)')
      .eq('id', id)
      .single();
  },

  async getPending(companyId: string, limit: number = 50) {
    return supabaseServer
      .from('agent_tasks')
      .select('*, agent_profiles(agent_key)')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);
  },

  async getByAgent(agentProfileId: string, status?: string) {
    let query = supabaseServer
      .from('agent_tasks')
      .select('*')
      .eq('agent_profile_id', agentProfileId);

    if (status) {
      query = query.eq('status', status);
    }

    return query.order('created_at', { ascending: false });
  },

  async updateStatus(
    taskId: string,
    status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled',
    result?: any
  ) {
    const update: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'running') {
      update.started_at = new Date().toISOString();
    }

    if (status === 'completed' || status === 'failed') {
      update.completed_at = new Date().toISOString();
      if (result) {
        // Store result in task_runs table instead
      }
    }

    return supabaseServer
      .from('agent_tasks')
      .update(update)
      .eq('id', taskId);
  },

  async assignToDevice(taskId: string, deviceId: string) {
    return supabaseServer
      .from('agent_tasks')
      .update({
        device_id: deviceId,
        status: 'queued',
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId);
  }
};

/**
 * Agent Conversations
 */
export const agentConversationsDAL = {
  async create(data: {
    company_id: string;
    title: string;
    conversation_type: 'direct' | 'group' | 'agent_to_agent';
    participants: string[];
  }) {
    return supabaseServer
      .from('agent_conversations')
      .insert({
        ...data,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
  },

  async getById(id: string) {
    return supabaseServer
      .from('agent_conversations')
      .select('*')
      .eq('id', id)
      .single();
  },

  async getByCompany(companyId: string, activeOnly: boolean = true) {
    let query = supabaseServer
      .from('agent_conversations')
      .select('*')
      .eq('company_id', companyId);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    return query.order('created_at', { ascending: false });
  }
};

/**
 * Agent Messages
 */
export const agentMessagesDAL = {
  async create(data: {
    conversation_id: string;
    sender_type: 'agent' | 'user' | 'system';
    sender_id?: string;
    content: string;
    mentions?: string[];
    context?: any;
    requires_action?: boolean;
  }) {
    return supabaseServer
      .from('agent_messages')
      .insert({
        ...data,
        action_taken: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
  },

  async getByConversation(conversationId: string, limit: number = 100) {
    return supabaseServer
      .from('agent_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);
  }
};

/**
 * Sales Orders
 */
export const salesOrdersDAL = {
  async create(data: {
    company_id: string;
    request_id?: string;
    customer_id?: string;
    status?: string;
    total_amount?: number;
    deposit_amount?: number;
    created_by_user_id?: string;
  }) {
    return supabaseServer
      .from('sales_orders')
      .insert({
        ...data,
        status: data.status || 'draft',
        deposit_paid: false,
        final_payment_paid: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
  },

  async getById(id: string) {
    return supabaseServer
      .from('sales_orders')
      .select('*, users(name, email, phone), sales_order_items(*)')
      .eq('id', id)
      .single();
  },

  async getByCompany(companyId: string, status?: string) {
    let query = supabaseServer
      .from('sales_orders')
      .select('*, users(name), sales_order_items(id)')
      .eq('company_id', companyId);

    if (status) {
      query = query.eq('status', status);
    }

    return query.order('created_at', { ascending: false });
  },

  async updateStatus(id: string, status: string) {
    return supabaseServer
      .from('sales_orders')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
  }
};

/**
 * Production Jobs
 */
export const productionJobsDAL = {
  async create(data: {
    company_id: string;
    sales_order_id?: string;
    sales_order_item_id?: string;
    current_stage_id?: string;
    assigned_to?: string;
  }) {
    return supabaseServer
      .from('production_jobs')
      .insert({
        ...data,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
  },

  async getById(id: string) {
    return supabaseServer
      .from('production_jobs')
      .select('*, production_stages(name), sales_order_items(description)')
      .eq('id', id)
      .single();
  },

  async getByCompany(companyId: string, status?: string) {
    let query = supabaseServer
      .from('production_jobs')
      .select('*, production_stages(name), sales_orders(id, customer_id)')
      .eq('company_id', companyId);

    if (status) {
      query = query.eq('status', status);
    }

    return query.order('scheduled_start', { ascending: true });
  },

  async updateStatus(id: string, status: string, stageId?: string) {
    const update: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (stageId) {
      update.current_stage_id = stageId;
    }

    if (status === 'in_progress') {
      update.actual_start = new Date().toISOString();
    }

    if (status === 'completed') {
      update.actual_end = new Date().toISOString();
    }

    return supabaseServer
      .from('production_jobs')
      .update(update)
      .eq('id', id);
  }
};

/**
 * Inventory
 */
export const inventoryDAL = {
  async getById(id: string) {
    return supabaseServer
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .single();
  },

  async getByCompany(companyId: string, lowStockOnly: boolean = false) {
    let query = supabaseServer
      .from('inventory_items')
      .select('*')
      .eq('company_id', companyId);

    if (lowStockOnly) {
      query = query.lte('current_quantity', 'min_stock_level');
    }

    return query.order('name');
  },

  async updateQuantity(id: string, newQuantity: number) {
    return supabaseServer
      .from('inventory_items')
      .update({
        current_quantity: newQuantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
  },

  async recordMovement(data: {
    inventory_item_id: string;
    movement_type: string;
    quantity: number;
    reference_type?: string;
    reference_id?: string;
    unit_cost?: number;
    created_by?: string;
  }) {
    return supabaseServer
      .from('inventory_movements')
      .insert({
        ...data,
        total_cost: data.unit_cost ? data.quantity * data.unit_cost : null,
        created_at: new Date().toISOString()
      });
  }
};

/**
 * Approval Requests
 */
export const approvalRequestsDAL = {
  async create(data: {
    company_id: string;
    request_type: string;
    title: string;
    description: string;
    amount?: number;
    requested_by: string;
    context?: any;
  }) {
    return supabaseServer
      .from('approval_requests')
      .insert({
        ...data,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
  },

  async getPending(companyId: string) {
    return supabaseServer
      .from('approval_requests')
      .select('*, users(name)')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
  },

  async updateDecision(
    id: string,
    decision: 'approved' | 'rejected',
    decidedBy: string,
    notes?: string
  ) {
    return supabaseServer
      .from('approval_requests')
      .update({
        status: decision,
        decided_by: decidedBy,
        decided_at: new Date().toISOString(),
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
  }
};

// ===========================================
// REALTIME SUBSCRIPTIONS
// ===========================================

export const realtimeDAL = {
  subscribeToTable(
    table: string,
    callback: (payload: any) => void,
    filter?: { column: string; value: string }
  ) {
    const channel = supabaseServer.channel(`table-changes-${table}`);

    const subscription = channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: filter ? `${filter.column}=eq.${filter.value}` : undefined
        },
        callback
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  },

  subscribeToAgentEvents(companyId: string, callback: (payload: any) => void) {
    return this.subscribeToTable('agent_events', callback, {
      column: 'company_id',
      value: companyId
    });
  }
};

// ===========================================
// TRANSACTION HELPERS
// ===========================================

/**
 * Note: Supabase doesn't support multi-table transactions in the JS client
 * For complex transactions, use RPC calls to database functions
 */

export async function withTransaction<T>(
  operations: () => Promise<T>
): Promise<T> {
  // In a real implementation, you'd use a PostgreSQL function
  // or manage this at the application level
  return operations();
}
