/**
 * VANGUARD CRM Tool Adapter
 * 
 * أداة إدارة العملاء المحتملين - التكامل مع جدول vanguard_leads
 * Supabase leads integration for pipeline management
 */

import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/vanguard/memory/supabase_persistence';
import type {
  ToolAdapter,
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult
} from '../tool_registry';

// ============================================================================
// Types
// ============================================================================

export type LeadStage =
  | 'new'
  | 'qualified'
  | 'quoted'
  | 'negotiating'
  | 'contracted'
  | 'won'
  | 'lost';

export type LeadTier = 'diamond' | 'gold' | 'silver' | 'bronze';

export type LeadUrgency =
  | 'immediate'
  | 'this_week'
  | 'this_month'
  | 'quarter'
  | 'exploring';

export interface Lead {
  id: string;
  session_id: string;
  stage: LeadStage;
  tier?: LeadTier;
  score: number;
  room_slug?: string;
  material_preferences: string[];
  budget_min?: number;
  budget_max?: number;
  urgency?: LeadUrgency;
  next_action?: string;
  assigned_to: string;
  probability: number;
  predicted_value?: number;
  predicted_close_date?: string;
  risk_factors: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  closed_at?: string;
  notes?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Schemas
// ============================================================================

const CreateLeadSchema = z.object({
  session_id: z.string().min(1),
  stage: z.enum(['new', 'qualified', 'quoted', 'negotiating', 'contracted', 'won', 'lost']).optional(),
  tier: z.enum(['diamond', 'gold', 'silver', 'bronze']).optional(),
  score: z.number().min(0).max(100).optional(),
  room_slug: z.string().optional(),
  material_preferences: z.array(z.string()).optional(),
  budget_min: z.number().positive().optional(),
  budget_max: z.number().positive().optional(),
  urgency: z.enum(['immediate', 'this_week', 'this_month', 'quarter', 'exploring']).optional(),
  next_action: z.string().optional(),
  assigned_to: z.string().optional(),
  probability: z.number().min(0).max(1).optional(),
  predicted_value: z.number().positive().optional(),
  predicted_close_date: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const UpdateLeadSchema = z.object({
  lead_id: z.string().uuid(),
  stage: z.enum(['new', 'qualified', 'quoted', 'negotiating', 'contracted', 'won', 'lost']).optional(),
  tier: z.enum(['diamond', 'gold', 'silver', 'bronze']).optional(),
  score: z.number().min(0).max(100).optional(),
  room_slug: z.string().optional(),
  material_preferences: z.array(z.string()).optional(),
  budget_min: z.number().positive().optional(),
  budget_max: z.number().positive().optional(),
  urgency: z.enum(['immediate', 'this_week', 'this_month', 'quarter', 'exploring']).optional(),
  next_action: z.string().optional(),
  assigned_to: z.string().optional(),
  probability: z.number().min(0).max(1).optional(),
  predicted_value: z.number().positive().optional(),
  predicted_close_date: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const SearchLeadsSchema = z.object({
  stage: z.enum(['new', 'qualified', 'quoted', 'negotiating', 'contracted', 'won', 'lost']).optional(),
  tier: z.enum(['diamond', 'gold', 'silver', 'bronze']).optional(),
  min_score: z.number().min(0).max(100).optional(),
  assigned_to: z.string().optional(),
  room_slug: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional()
});

const GetLeadSchema = z.object({
  lead_id: z.string().uuid().optional(),
  session_id: z.string().optional()
}).refine(data => data.lead_id || data.session_id, {
  message: 'Either lead_id or session_id must be provided'
});

const DeleteLeadSchema = z.object({
  lead_id: z.string().uuid()
});

const BulkUpdateSchema = z.object({
  lead_ids: z.array(z.string().uuid()).min(1),
  updates: z.object({
    stage: z.enum(['new', 'qualified', 'quoted', 'negotiating', 'contracted', 'won', 'lost']).optional(),
    assigned_to: z.string().optional(),
    tier: z.enum(['diamond', 'gold', 'silver', 'bronze']).optional()
  })
});

// ============================================================================
// CRM Create Adapter
// ============================================================================

class CRMCreateAdapter implements ToolAdapter<z.infer<typeof CreateLeadSchema>, Lead> {
  definition: ToolDefinition = {
    id: 'crm_create_lead',
    name: 'Create Lead',
    nameAr: 'إنشاء عميل محتمل',
    description: 'Create a new lead in the CRM pipeline',
    descriptionAr: 'إنشاء عميل محتمل جديد في خط المبيعات',
    category: 'crm',
    riskLevel: 'MEDIUM',
    parameters: [
      {
        name: 'session_id',
        type: 'string',
        description: 'Unique session identifier',
        required: true,
        examples: ['sess_abc123']
      },
      {
        name: 'stage',
        type: 'string',
        description: 'Lead stage in pipeline',
        required: false,
        examples: ['new', 'qualified']
      },
      {
        name: 'score',
        type: 'number',
        description: 'Lead score (0-100)',
        required: false,
        examples: [75]
      },
      {
        name: 'budget_min',
        type: 'number',
        description: 'Minimum budget in EGP',
        required: false,
        examples: [50000]
      },
      {
        name: 'budget_max',
        type: 'number',
        description: 'Maximum budget in EGP',
        required: false,
        examples: [150000]
      }
    ],
    returns: {
      type: 'Lead',
      description: 'Created lead object',
      descriptionAr: 'بيانات العميل المحتمل المُنشأ'
    },
    examples: [
      {
        input: {
          session_id: 'sess_123',
          stage: 'new',
          score: 60,
          budget_min: 50000,
          budget_max: 100000
        },
        output: { id: 'lead-uuid', session_id: 'sess_123', stage: 'new' },
        description: 'Create a new lead with budget range'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = CreateLeadSchema.safeParse(input);
    if (result.success) {
      return { valid: true };
    }
    return {
      valid: false,
      errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const supabase = createServiceRoleClient();
      const { error } = await supabase.from('vanguard_leads').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async execute(
    input: z.infer<typeof CreateLeadSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<Lead>> {
    const startTime = Date.now();

    try {
      const supabase = createServiceRoleClient();

      const { data, error } = await supabase
        .from('vanguard_leads')
        .insert({
          session_id: input.session_id,
          stage: input.stage || 'new',
          tier: input.tier,
          score: input.score || 0,
          room_slug: input.room_slug,
          material_preferences: input.material_preferences || [],
          budget_min: input.budget_min,
          budget_max: input.budget_max,
          urgency: input.urgency,
          next_action: input.next_action,
          assigned_to: input.assigned_to || 'vanguard',
          probability: input.probability || 0.0,
          predicted_value: input.predicted_value,
          predicted_close_date: input.predicted_close_date,
          notes: input.notes,
          metadata: input.metadata || {},
          risk_factors: []
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'CRM_CREATE_ERROR',
            message: error.message,
            messageAr: 'فشل إنشاء العميل المحتمل',
            details: { error }
          },
          metadata: {
            toolId: this.definition.id,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        };
      }

      return {
        success: true,
        data: data as Lead,
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CRM_CREATE_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'حدث خطأ أثناء إنشاء العميل المحتمل'
        },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

// ============================================================================
// CRM Update Adapter
// ============================================================================

class CRMUpdateAdapter implements ToolAdapter<z.infer<typeof UpdateLeadSchema>, Lead> {
  definition: ToolDefinition = {
    id: 'crm_update_lead',
    name: 'Update Lead',
    nameAr: 'تحديث عميل محتمل',
    description: 'Update an existing lead in the CRM',
    descriptionAr: 'تحديث بيانات عميل محتمل موجود',
    category: 'crm',
    riskLevel: 'MEDIUM',
    parameters: [
      {
        name: 'lead_id',
        type: 'string',
        description: 'Lead UUID',
        required: true,
        examples: ['550e8400-e29b-41d4-a716-446655440000']
      },
      {
        name: 'stage',
        type: 'string',
        description: 'New lead stage',
        required: false,
        examples: ['qualified', 'quoted']
      },
      {
        name: 'score',
        type: 'number',
        description: 'Updated lead score',
        required: false,
        examples: [85]
      }
    ],
    returns: {
      type: 'Lead',
      description: 'Updated lead object',
      descriptionAr: 'بيانات العميل المحتمل المُحدث'
    },
    examples: [
      {
        input: { lead_id: 'uuid', stage: 'qualified', score: 85 },
        output: { id: 'uuid', stage: 'qualified', score: 85 },
        description: 'Move lead to qualified stage'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = UpdateLeadSchema.safeParse(input);
    if (result.success) {
      return { valid: true };
    }
    return {
      valid: false,
      errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const supabase = createServiceRoleClient();
      const { error } = await supabase.from('vanguard_leads').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async execute(
    input: z.infer<typeof UpdateLeadSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<Lead>> {
    const startTime = Date.now();

    try {
      const supabase = createServiceRoleClient();
      const { lead_id, ...updates } = input;

      // Check if lead exists
      const { data: existingLead, error: checkError } = await supabase
        .from('vanguard_leads')
        .select('id')
        .eq('id', lead_id)
        .single();

      if (checkError || !existingLead) {
        return {
          success: false,
          error: {
            code: 'LEAD_NOT_FOUND',
            message: `Lead with id ${lead_id} not found`,
            messageAr: 'العميل المحتمل غير موجود'
          },
          metadata: {
            toolId: this.definition.id,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        };
      }

      // Update lead
      const { data, error } = await supabase
        .from('vanguard_leads')
        .update(updates)
        .eq('id', lead_id)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'CRM_UPDATE_ERROR',
            message: error.message,
            messageAr: 'فشل تحديث العميل المحتمل',
            details: { error }
          },
          metadata: {
            toolId: this.definition.id,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        };
      }

      return {
        success: true,
        data: data as Lead,
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CRM_UPDATE_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'حدث خطأ أثناء تحديث العميل المحتمل'
        },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

// ============================================================================
// CRM Search Adapter
// ============================================================================

class CRMSearchAdapter implements ToolAdapter<z.infer<typeof SearchLeadsSchema>, Lead[]> {
  definition: ToolDefinition = {
    id: 'crm_search_leads',
    name: 'Search Leads',
    nameAr: 'البحث في العملاء المحتملين',
    description: 'Search and filter leads in the CRM',
    descriptionAr: 'البحث والتصفية في قاعدة العملاء المحتملين',
    category: 'crm',
    riskLevel: 'LOW',
    parameters: [
      {
        name: 'stage',
        type: 'string',
        description: 'Filter by stage',
        required: false,
        examples: ['qualified', 'quoted']
      },
      {
        name: 'tier',
        type: 'string',
        description: 'Filter by tier',
        required: false,
        examples: ['gold', 'diamond']
      },
      {
        name: 'min_score',
        type: 'number',
        description: 'Minimum lead score',
        required: false,
        examples: [70]
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Maximum results',
        required: false,
        default: 20,
        examples: [10, 50]
      }
    ],
    returns: {
      type: 'Lead[]',
      description: 'Array of matching leads',
      descriptionAr: 'قائمة العملاء المحتملين المطابقة'
    },
    examples: [
      {
        input: { stage: 'qualified', min_score: 70, limit: 10 },
        output: [{ id: 'uuid', stage: 'qualified', score: 85 }],
        description: 'Find qualified leads with score >= 70'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = SearchLeadsSchema.safeParse(input);
    if (result.success) {
      return { valid: true };
    }
    return {
      valid: false,
      errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const supabase = createServiceRoleClient();
      const { error } = await supabase.from('vanguard_leads').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async execute(
    input: z.infer<typeof SearchLeadsSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<Lead[]>> {
    const startTime = Date.now();

    try {
      const supabase = createServiceRoleClient();
      
      let query = supabase.from('vanguard_leads').select('*');

      // Apply filters
      if (input.stage) {
        query = query.eq('stage', input.stage);
      }
      if (input.tier) {
        query = query.eq('tier', input.tier);
      }
      if (input.min_score !== undefined) {
        query = query.gte('score', input.min_score);
      }
      if (input.assigned_to) {
        query = query.eq('assigned_to', input.assigned_to);
      }
      if (input.room_slug) {
        query = query.eq('room_slug', input.room_slug);
      }

      // Apply pagination
      const limit = input.limit || 20;
      const offset = input.offset || 0;
      query = query.range(offset, offset + limit - 1);

      // Order by score descending
      query = query.order('score', { ascending: false });

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          error: {
            code: 'CRM_SEARCH_ERROR',
            message: error.message,
            messageAr: 'فشل البحث في العملاء المحتملين',
            details: { error }
          },
          metadata: {
            toolId: this.definition.id,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        };
      }

      return {
        success: true,
        data: (data || []) as Lead[],
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CRM_SEARCH_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'حدث خطأ أثناء البحث'
        },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

// ============================================================================
// CRM Get Adapter
// ============================================================================

class CRMGetAdapter implements ToolAdapter<z.infer<typeof GetLeadSchema>, Lead> {
  definition: ToolDefinition = {
    id: 'crm_get_lead',
    name: 'Get Lead',
    nameAr: 'استرجاع عميل محتمل',
    description: 'Get a single lead by ID or session ID',
    descriptionAr: 'استرجاع بيانات عميل محتمل واحد',
    category: 'crm',
    riskLevel: 'LOW',
    parameters: [
      {
        name: 'lead_id',
        type: 'string',
        description: 'Lead UUID (optional if session_id provided)',
        required: false,
        examples: ['550e8400-e29b-41d4-a716-446655440000']
      },
      {
        name: 'session_id',
        type: 'string',
        description: 'Session ID (optional if lead_id provided)',
        required: false,
        examples: ['sess_abc123']
      }
    ],
    returns: {
      type: 'Lead',
      description: 'Lead object',
      descriptionAr: 'بيانات العميل المحتمل'
    },
    examples: [
      {
        input: { lead_id: 'uuid' },
        output: { id: 'uuid', session_id: 'sess_123', stage: 'qualified' },
        description: 'Get lead by UUID'
      },
      {
        input: { session_id: 'sess_123' },
        output: { id: 'uuid', session_id: 'sess_123', stage: 'qualified' },
        description: 'Get lead by session ID'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = GetLeadSchema.safeParse(input);
    if (result.success) {
      return { valid: true };
    }
    return {
      valid: false,
      errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const supabase = createServiceRoleClient();
      const { error } = await supabase.from('vanguard_leads').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async execute(
    input: z.infer<typeof GetLeadSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<Lead>> {
    const startTime = Date.now();

    try {
      const supabase = createServiceRoleClient();
      
      let query = supabase.from('vanguard_leads').select('*');

      if (input.lead_id) {
        query = query.eq('id', input.lead_id);
      } else if (input.session_id) {
        query = query.eq('session_id', input.session_id);
      }

      const { data, error } = await query.single();

      if (error || !data) {
        return {
          success: false,
          error: {
            code: 'LEAD_NOT_FOUND',
            message: 'Lead not found',
            messageAr: 'العميل المحتمل غير موجود'
          },
          metadata: {
            toolId: this.definition.id,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        };
      }

      return {
        success: true,
        data: data as Lead,
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CRM_GET_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'حدث خطأ أثناء استرجاع البيانات'
        },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

// ============================================================================
// CRM Delete Adapter
// ============================================================================

class CRMDeleteAdapter implements ToolAdapter<z.infer<typeof DeleteLeadSchema>, { deleted: boolean }> {
  definition: ToolDefinition = {
    id: 'crm_delete_lead',
    name: 'Delete Lead',
    nameAr: 'حذف عميل محتمل',
    description: 'Delete a lead from the CRM (use with caution)',
    descriptionAr: 'حذف عميل محتمل من النظام (استخدم بحذر)',
    category: 'crm',
    riskLevel: 'HIGH',
    parameters: [
      {
        name: 'lead_id',
        type: 'string',
        description: 'Lead UUID to delete',
        required: true,
        examples: ['550e8400-e29b-41d4-a716-446655440000']
      }
    ],
    returns: {
      type: 'object',
      description: 'Deletion confirmation',
      descriptionAr: 'تأكيد الحذف'
    },
    examples: [
      {
        input: { lead_id: 'uuid' },
        output: { deleted: true },
        description: 'Delete a lead permanently'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = DeleteLeadSchema.safeParse(input);
    if (result.success) {
      return { valid: true };
    }
    return {
      valid: false,
      errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const supabase = createServiceRoleClient();
      const { error } = await supabase.from('vanguard_leads').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async execute(
    input: z.infer<typeof DeleteLeadSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<{ deleted: boolean }>> {
    const startTime = Date.now();

    try {
      const supabase = createServiceRoleClient();

      const { error } = await supabase
        .from('vanguard_leads')
        .delete()
        .eq('id', input.lead_id);

      if (error) {
        return {
          success: false,
          error: {
            code: 'CRM_DELETE_ERROR',
            message: error.message,
            messageAr: 'فشل حذف العميل المحتمل',
            details: { error }
          },
          metadata: {
            toolId: this.definition.id,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        };
      }

      return {
        success: true,
        data: { deleted: true },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CRM_DELETE_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'حدث خطأ أثناء الحذف'
        },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

// ============================================================================
// CRM Bulk Update Adapter
// ============================================================================

class CRMBulkUpdateAdapter implements ToolAdapter<z.infer<typeof BulkUpdateSchema>, { updated: number }> {
  definition: ToolDefinition = {
    id: 'crm_bulk_update',
    name: 'Bulk Update Leads',
    nameAr: 'تحديث مجموعة من العملاء',
    description: 'Update multiple leads at once',
    descriptionAr: 'تحديث عدة عملاء محتملين في وقت واحد',
    category: 'crm',
    riskLevel: 'HIGH',
    parameters: [
      {
        name: 'lead_ids',
        type: 'array',
        description: 'Array of lead UUIDs',
        required: true,
        examples: [['uuid1', 'uuid2', 'uuid3']]
      },
      {
        name: 'updates',
        type: 'object',
        description: 'Fields to update',
        required: true,
        examples: [{ stage: 'qualified', assigned_to: 'user_123' }]
      }
    ],
    returns: {
      type: 'object',
      description: 'Number of updated leads',
      descriptionAr: 'عدد العملاء المُحدثين'
    },
    examples: [
      {
        input: {
          lead_ids: ['uuid1', 'uuid2'],
          updates: { stage: 'qualified', assigned_to: 'manager_1' }
        },
        output: { updated: 2 },
        description: 'Move multiple leads to qualified and assign to manager'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = BulkUpdateSchema.safeParse(input);
    if (result.success) {
      return { valid: true };
    }
    return {
      valid: false,
      errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const supabase = createServiceRoleClient();
      const { error } = await supabase.from('vanguard_leads').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async execute(
    input: z.infer<typeof BulkUpdateSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<{ updated: number }>> {
    const startTime = Date.now();

    try {
      const supabase = createServiceRoleClient();

      const { data, error } = await supabase
        .from('vanguard_leads')
        .update(input.updates)
        .in('id', input.lead_ids)
        .select('id');

      if (error) {
        return {
          success: false,
          error: {
            code: 'CRM_BULK_UPDATE_ERROR',
            message: error.message,
            messageAr: 'فشل التحديث الجماعي',
            details: { error }
          },
          metadata: {
            toolId: this.definition.id,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        };
      }

      return {
        success: true,
        data: { updated: data?.length || 0 },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CRM_BULK_UPDATE_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'حدث خطأ أثناء التحديث الجماعي'
        },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export const crmCreateAdapter = new CRMCreateAdapter();
export const crmUpdateAdapter = new CRMUpdateAdapter();
export const crmSearchAdapter = new CRMSearchAdapter();
export const crmGetAdapter = new CRMGetAdapter();
export const crmDeleteAdapter = new CRMDeleteAdapter();
export const crmBulkUpdateAdapter = new CRMBulkUpdateAdapter();

// Register all CRM adapters
export function registerCRMAdapters(registry: { register: (adapter: ToolAdapter) => void }) {
  registry.register(crmCreateAdapter);
  registry.register(crmUpdateAdapter);
  registry.register(crmSearchAdapter);
  registry.register(crmGetAdapter);
  registry.register(crmDeleteAdapter);
  registry.register(crmBulkUpdateAdapter);
}
