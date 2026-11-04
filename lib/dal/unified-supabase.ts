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
import { realtimeChannelVerdict, type RealtimeReason } from './realtime-verdict';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function createUnavailableSupabaseClient() {
  const missing = [
    !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
    !supabaseAnonKey ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : null,
  ].filter(Boolean).join(', ');

  return new Proxy({}, {
    get() {
      throw new Error(`Supabase is not configured: missing ${missing}`);
    },
  }) as ReturnType<typeof createClient>;
}

// ===========================================
// CLIENT INSTANCES
// ===========================================

/**
 * Server-side client with anon key (for RLS-respecting operations)
 * Use this when you need to respect Row Level Security policies
 */
export const supabaseAnon = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createUnavailableSupabaseClient();

/**
 * Server-side client with service role key (for admin operations)
 * ⚠️ WARNING: This bypasses RLS. Use with caution!
 * Only use for: background jobs, admin operations, agent tasks
 */
export const supabaseServer = supabaseServiceKey
  ? createClient(supabaseUrl!, supabaseServiceKey, {
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
    // Measured 2026-11-04: `users` has seventeen columns and none of them joins a profile row to an
    // auth account — `id` defaults to gen_random_uuid(), and the record holds 33 profile rows against
    // 1 auth account. A filter on `auth_user_id` could never return a row, so the promise is said
    // here instead of being paid for with a refused query.
    return {
      data: null,
      error: {
        code: 'DAL_NO_AUTH_LINK',
        message: 'سجل المشترك مفيهوش عمود يربط الصف بحساب الدخول — الربط قرار في هيكل السجل',
      },
    };
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

  // The record's companies table has never had a slug; the column that resolves a company from a
  // request is `domain`, and that is what lib/tenant.ts already asks (measured 2026-11-04).
  async getByDomain(domain: string) {
    return supabaseServer
      .from('companies')
      .select('*')
      .eq('domain', domain)
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
    customer_name?: string;
    customer_id?: string;
    status?: string;
    total_amount?: number;
    deposit_amount?: number;
    created_by_user_id?: string;
  }) {
    // Measured 2026-11-04: sales_orders answers to eleven columns. Three names this insert used to
    // send have never been among them — `request_id`, `created_by_user_id` and `final_payment_paid`
    // — and a payload with a name the record does not have is refused outright (PGRST204).
    // The one column that does hold the buyer is `user_id`.
    return supabaseServer
      .from('sales_orders')
      .insert({
        company_id: data.company_id,
        customer_name: data.customer_name ?? null,
        user_id: data.created_by_user_id ?? data.customer_id ?? null,
        status: data.status || 'draft',
        total_amount: data.total_amount ?? null,
        deposit_amount: data.deposit_amount ?? null,
        deposit_paid: false,
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

    // `scheduled_start` is not one of the eight columns production_jobs answers to; ordering by a
    // column the record does not have refuses the whole query, so the list came back empty.
    return query.order('created_at', { ascending: true });
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
    // Measured 2026-11-04: the record has one inventory relation — `inventory_items` — and no
    // movement ledger. Writing here used to send an insert into a table that answers PGRST205 and
    // drop the refusal; the answer now says plainly that the store keeps no movement history.
    void data;
    return {
      data: null,
      error: {
        code: 'DAL_NO_TABLE',
        message: 'السجل ما فيهوش جدول حركة المخزون — التاريخ ده مالوش مكان يتسجل فيه لحد دلوقتي',
      },
    };
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
    // The record keeps the decision in `approved_by` / `approved_at`, and a refusal's reason in
    // `rejection_reason` — measured 2026-11-04; `decided_by` and `decided_at` have never existed,
    // so every decision write this layer made was refused and the paper stayed pending forever.
    return supabaseServer
      .from('approval_requests')
      .update({
        status: decision,
        approved_by: decidedBy,
        approved_at: new Date().toISOString(),
        rejection_reason: decision === 'rejected' ? (notes ?? null) : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
  }
};

// ===========================================
// REALTIME SUBSCRIPTIONS
// ===========================================

export const realtimeDAL = {
  /**
   * Opens a live channel only for a table the record itself publishes. A subscription to a
   * table outside its publication costs nothing when it is wrong — the channel opens, the
   * callback never fires, and the caller believes it has a feed — so the answer comes from
   * the measured snapshot in lib/dal/realtime-verdict.ts and the refusal is reported.
   */
  subscribeToTable(
    table: string,
    callback: (payload: any) => void,
    filter?: { column: string; value: string }
  ): { subscribed: boolean; reason: RealtimeReason; unsubscribe: () => void } {
    const verdict = realtimeChannelVerdict(table);
    if (!verdict.usable) {
      console.warn(
        `[realtime] no live channel for "${table}": ${verdict.reason} ` +
          `(measured ${verdict.measuredAt ?? 'never'}; ${verdict.publishedCount} tables published). ` +
          `The store's alerts are read from the ledger by lib/ops/alerts.ts.`
      );
      return { subscribed: false, reason: verdict.reason, unsubscribe: () => {} };
    }

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

    return {
      subscribed: true,
      reason: verdict.reason,
      unsubscribe: () => subscription.unsubscribe()
    };
  },

  /**
   * There is no live alert feed here. Measured 2026-11-04: the event table this used to
   * subscribe to holds 4 seeded rows and was last written 2026-08-10, and neither it nor the
   * ledger the alerts actually live in is in the record's publication — so the channel below
   * refuses instead of pretending. Read the alerts through lib/ops/alerts.ts.
   */
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
