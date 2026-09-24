/**
 * VANGUARD Knowledge Base Tool Adapter
 * 
 * أداة قاعدة المعرفة - البحث في المواد والمنتجات والتعلم
 * Search materials, products, and learnings from internal knowledge base
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

export interface Material {
  id: string;
  slug: string;
  name_ar: string;
  name_en?: string;
  category: string;
  sub_category?: string;
  properties: Record<string, unknown>;
  compatible_with: string[];
  use_cases: string[];
  certifications: string[];
  source_country?: string;
  is_active: boolean;
  confidence: number;
}

export interface Product {
  id: string;
  slug: string;
  name_ar: string;
  name_en?: string;
  category: string;
  sub_category?: string;
  style?: string;
  materials: string[];
  dimensions: Record<string, unknown>;
  features: string[];
  customizable: boolean;
  lead_time_days?: number;
  is_active: boolean;
  confidence: number;
}

export interface Learning {
  id: string;
  domain: string;
  claim: string;
  correction?: string;
  evidence: Record<string, unknown>;
  lesson_type: string;
  is_active: boolean;
  confidence: number;
  success_count: number;
  failure_count: number;
}

export interface KnowledgeRelation {
  id: string;
  from_type: string;
  from_id: string;
  relation_type: string;
  to_type: string;
  to_id: string;
  properties: Record<string, unknown>;
  confidence: number;
  source: string;
}

// ============================================================================
// Schemas
// ============================================================================

const SearchMaterialsSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  use_case: z.string().optional(),
  limit: z.number().min(1).max(50).optional()
});

const GetMaterialSchema = z.object({
  slug: z.string().min(1)
});

const SearchProductsSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  style: z.string().optional(),
  material: z.string().optional(),
  customizable: z.boolean().optional(),
  limit: z.number().min(1).max(50).optional()
});

const GetProductSchema = z.object({
  slug: z.string().min(1)
});

const SearchLearningsSchema = z.object({
  query: z.string().optional(),
  domain: z.string().optional(),
  lesson_type: z.string().optional(),
  limit: z.number().min(1).max(50).optional()
});

const GetRelationsSchema = z.object({
  entity_type: z.string().min(1),
  entity_id: z.string().min(1),
  relation_type: z.string().optional(),
  direction: z.enum(['outgoing', 'incoming', 'both']).optional()
});

// ============================================================================
// Search Materials Adapter
// ============================================================================

class SearchMaterialsAdapter implements ToolAdapter<z.infer<typeof SearchMaterialsSchema>, Material[]> {
  definition: ToolDefinition = {
    id: 'kb_search_materials',
    name: 'Search Materials',
    nameAr: 'البحث في المواد',
    description: 'Search the materials knowledge base',
    descriptionAr: 'البحث في قاعدة بيانات المواد (خشب، معادن، أقمشة)',
    category: 'knowledge',
    riskLevel: 'LOW',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query (name or properties)',
        required: false,
        examples: ['خشب زان', 'metal finish']
      },
      {
        name: 'category',
        type: 'string',
        description: 'Material category',
        required: false,
        examples: ['wood', 'metal', 'fabric']
      },
      {
        name: 'use_case',
        type: 'string',
        description: 'Use case filter',
        required: false,
        examples: ['bedroom', 'living_room']
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Maximum results',
        required: false,
        default: 20
      }
    ],
    returns: {
      type: 'Material[]',
      description: 'Array of matching materials',
      descriptionAr: 'قائمة المواد المطابقة'
    },
    examples: [
      {
        input: { category: 'wood', use_case: 'bedroom', limit: 10 },
        output: [{ slug: 'beech-wood', name_ar: 'خشب الزان', category: 'wood' }],
        description: 'Find wood materials suitable for bedrooms'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = SearchMaterialsSchema.safeParse(input);
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
      const { error } = await supabase.from('vanguard_materials').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async execute(
    input: z.infer<typeof SearchMaterialsSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<Material[]>> {
    const startTime = Date.now();

    try {
      const supabase = createServiceRoleClient();
      let query = supabase
        .from('vanguard_materials')
        .select('*')
        .eq('is_active', true);

      // Apply filters
      if (input.category) {
        query = query.eq('category', input.category);
      }

      if (input.use_case) {
        query = query.contains('use_cases', [input.use_case]);
      }

      // Text search on name_ar and name_en
      if (input.query) {
        query = query.or(`name_ar.ilike.%${input.query}%,name_en.ilike.%${input.query}%`);
      }

      // Limit and order
      const limit = input.limit || 20;
      query = query.order('confidence', { ascending: false }).limit(limit);

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          error: {
            code: 'KB_SEARCH_MATERIALS_ERROR',
            message: error.message,
            messageAr: 'فشل البحث في المواد'
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
        data: (data || []) as Material[],
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
          code: 'KB_SEARCH_MATERIALS_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'حدث خطأ أثناء البحث في المواد'
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
// Get Material Adapter
// ============================================================================

class GetMaterialAdapter implements ToolAdapter<z.infer<typeof GetMaterialSchema>, Material> {
  definition: ToolDefinition = {
    id: 'kb_get_material',
    name: 'Get Material',
    nameAr: 'استرجاع مادة',
    description: 'Get a specific material by slug',
    descriptionAr: 'استرجاع معلومات مادة محددة',
    category: 'knowledge',
    riskLevel: 'LOW',
    parameters: [
      {
        name: 'slug',
        type: 'string',
        description: 'Material slug',
        required: true,
        examples: ['beech-wood', 'stainless-steel']
      }
    ],
    returns: {
      type: 'Material',
      description: 'Material details',
      descriptionAr: 'تفاصيل المادة'
    },
    examples: [
      {
        input: { slug: 'beech-wood' },
        output: { slug: 'beech-wood', name_ar: 'خشب الزان', category: 'wood' },
        description: 'Get beech wood material details'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = GetMaterialSchema.safeParse(input);
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
      const { error } = await supabase.from('vanguard_materials').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async execute(
    input: z.infer<typeof GetMaterialSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<Material>> {
    const startTime = Date.now();

    try {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from('vanguard_materials')
        .select('*')
        .eq('slug', input.slug)
        .single();

      if (error || !data) {
        return {
          success: false,
          error: {
            code: 'MATERIAL_NOT_FOUND',
            message: `Material with slug "${input.slug}" not found`,
            messageAr: 'المادة غير موجودة'
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
        data: data as Material,
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
          code: 'KB_GET_MATERIAL_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'حدث خطأ أثناء استرجاع المادة'
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
// Search Products Adapter
// ============================================================================

class SearchProductsAdapter implements ToolAdapter<z.infer<typeof SearchProductsSchema>, Product[]> {
  definition: ToolDefinition = {
    id: 'kb_search_products',
    name: 'Search Products',
    nameAr: 'البحث في المنتجات',
    description: 'Search the products knowledge base',
    descriptionAr: 'البحث في قاعدة بيانات المنتجات',
    category: 'knowledge',
    riskLevel: 'LOW',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query',
        required: false,
        examples: ['غرفة نوم كلاسيك', 'modern sofa']
      },
      {
        name: 'category',
        type: 'string',
        description: 'Product category',
        required: false,
        examples: ['bedroom', 'living_room']
      },
      {
        name: 'style',
        type: 'string',
        description: 'Product style',
        required: false,
        examples: ['classic', 'modern']
      },
      {
        name: 'material',
        type: 'string',
        description: 'Material slug',
        required: false,
        examples: ['beech-wood']
      }
    ],
    returns: {
      type: 'Product[]',
      description: 'Array of matching products',
      descriptionAr: 'قائمة المنتجات المطابقة'
    },
    examples: [
      {
        input: { category: 'bedroom', style: 'classic', limit: 10 },
        output: [{ slug: 'classic-bedroom-set', name_ar: 'غرفة نوم كلاسيك', category: 'bedroom' }],
        description: 'Find classic bedroom products'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = SearchProductsSchema.safeParse(input);
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
      const { error } = await supabase.from('vanguard_products').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async execute(
    input: z.infer<typeof SearchProductsSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<Product[]>> {
    const startTime = Date.now();

    try {
      const supabase = createServiceRoleClient();
      let query = supabase
        .from('vanguard_products')
        .select('*')
        .eq('is_active', true);

      // Apply filters
      if (input.category) {
        query = query.eq('category', input.category);
      }

      if (input.style) {
        query = query.eq('style', input.style);
      }

      if (input.material) {
        query = query.contains('materials', [input.material]);
      }

      if (input.customizable !== undefined) {
        query = query.eq('customizable', input.customizable);
      }

      // Text search
      if (input.query) {
        query = query.or(`name_ar.ilike.%${input.query}%,name_en.ilike.%${input.query}%`);
      }

      // Limit and order
      const limit = input.limit || 20;
      query = query.order('sort_order', { ascending: true }).limit(limit);

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          error: {
            code: 'KB_SEARCH_PRODUCTS_ERROR',
            message: error.message,
            messageAr: 'فشل البحث في المنتجات'
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
        data: (data || []) as Product[],
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
          code: 'KB_SEARCH_PRODUCTS_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'حدث خطأ أثناء البحث في المنتجات'
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
// Get Product Adapter
// ============================================================================

class GetProductAdapter implements ToolAdapter<z.infer<typeof GetProductSchema>, Product> {
  definition: ToolDefinition = {
    id: 'kb_get_product',
    name: 'Get Product',
    nameAr: 'استرجاع منتج',
    description: 'Get a specific product by slug',
    descriptionAr: 'استرجاع معلومات منتج محدد',
    category: 'knowledge',
    riskLevel: 'LOW',
    parameters: [
      {
        name: 'slug',
        type: 'string',
        description: 'Product slug',
        required: true,
        examples: ['classic-bedroom-set', 'modern-sofa']
      }
    ],
    returns: {
      type: 'Product',
      description: 'Product details',
      descriptionAr: 'تفاصيل المنتج'
    },
    examples: [
      {
        input: { slug: 'classic-bedroom-set' },
        output: { slug: 'classic-bedroom-set', name_ar: 'غرفة نوم كلاسيك', category: 'bedroom' },
        description: 'Get classic bedroom set details'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = GetProductSchema.safeParse(input);
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
      const { error } = await supabase.from('vanguard_products').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async execute(
    input: z.infer<typeof GetProductSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<Product>> {
    const startTime = Date.now();

    try {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from('vanguard_products')
        .select('*')
        .eq('slug', input.slug)
        .single();

      if (error || !data) {
        return {
          success: false,
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: `Product with slug "${input.slug}" not found`,
            messageAr: 'المنتج غير موجود'
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
        data: data as Product,
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
          code: 'KB_GET_PRODUCT_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'حدث خطأ أثناء استرجاع المنتج'
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
// Search Learnings Adapter
// ============================================================================

class SearchLearningsAdapter implements ToolAdapter<z.infer<typeof SearchLearningsSchema>, Learning[]> {
  definition: ToolDefinition = {
    id: 'kb_search_learnings',
    name: 'Search Learnings',
    nameAr: 'البحث في التعلم',
    description: 'Search admin-verified learnings and corrections',
    descriptionAr: 'البحث في المعرفة المُصححة والمُتحقق منها',
    category: 'knowledge',
    riskLevel: 'LOW',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query',
        required: false,
        examples: ['سياسة التسليم', 'pricing policy']
      },
      {
        name: 'domain',
        type: 'string',
        description: 'Learning domain',
        required: false,
        examples: ['pricing_policy', 'process', 'materials']
      },
      {
        name: 'lesson_type',
        type: 'string',
        description: 'Type of learning',
        required: false,
        examples: ['fact', 'anti_pattern', 'pricing_rule']
      }
    ],
    returns: {
      type: 'Learning[]',
      description: 'Array of matching learnings',
      descriptionAr: 'قائمة التعلم المطابقة'
    },
    examples: [
      {
        input: { domain: 'pricing_policy', lesson_type: 'pricing_rule' },
        output: [{ domain: 'pricing_policy', claim: 'لا نعطي أسعار عبر الهاتف', lesson_type: 'pricing_rule' }],
        description: 'Find pricing policy rules'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = SearchLearningsSchema.safeParse(input);
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
      const { error } = await supabase.from('vanguard_learnings').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async execute(
    input: z.infer<typeof SearchLearningsSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<Learning[]>> {
    const startTime = Date.now();

    try {
      const supabase = createServiceRoleClient();
      let query = supabase
        .from('vanguard_learnings')
        .select('*')
        .eq('is_active', true);

      // Apply filters
      if (input.domain) {
        query = query.eq('domain', input.domain);
      }

      if (input.lesson_type) {
        query = query.eq('lesson_type', input.lesson_type);
      }

      // Text search
      if (input.query) {
        query = query.or(`claim.ilike.%${input.query}%,correction.ilike.%${input.query}%`);
      }

      // Limit and order by confidence
      const limit = input.limit || 20;
      query = query.order('confidence', { ascending: false }).limit(limit);

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          error: {
            code: 'KB_SEARCH_LEARNINGS_ERROR',
            message: error.message,
            messageAr: 'فشل البحث في التعلم'
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
        data: (data || []) as Learning[],
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
          code: 'KB_SEARCH_LEARNINGS_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'حدث خطأ أثناء البحث في التعلم'
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
// Get Relations Adapter
// ============================================================================

class GetRelationsAdapter implements ToolAdapter<z.infer<typeof GetRelationsSchema>, KnowledgeRelation[]> {
  definition: ToolDefinition = {
    id: 'kb_get_relations',
    name: 'Get Knowledge Relations',
    nameAr: 'استرجاع العلاقات',
    description: 'Get knowledge graph relations for an entity',
    descriptionAr: 'استرجاع العلاقات في الرسم البياني للمعرفة',
    category: 'knowledge',
    riskLevel: 'LOW',
    parameters: [
      {
        name: 'entity_type',
        type: 'string',
        description: 'Entity type',
        required: true,
        examples: ['material', 'product']
      },
      {
        name: 'entity_id',
        type: 'string',
        description: 'Entity ID or slug',
        required: true,
        examples: ['beech-wood', 'classic-bedroom-set']
      },
      {
        name: 'relation_type',
        type: 'string',
        description: 'Relation type filter',
        required: false,
        examples: ['used_in', 'compatible_with']
      },
      {
        name: 'direction',
        type: 'string',
        description: 'Relation direction',
        required: false,
        default: 'both',
        examples: ['outgoing', 'incoming', 'both']
      }
    ],
    returns: {
      type: 'KnowledgeRelation[]',
      description: 'Array of knowledge graph relations',
      descriptionAr: 'قائمة العلاقات'
    },
    examples: [
      {
        input: { entity_type: 'material', entity_id: 'beech-wood', relation_type: 'used_in' },
        output: [{ from_type: 'material', from_id: 'beech-wood', relation_type: 'used_in', to_type: 'product', to_id: 'classic-bedroom-set' }],
        description: 'Find products that use beech wood'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = GetRelationsSchema.safeParse(input);
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
      const { error } = await supabase.from('vanguard_knowledge_relations').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async execute(
    input: z.infer<typeof GetRelationsSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<KnowledgeRelation[]>> {
    const startTime = Date.now();

    try {
      const supabase = createServiceRoleClient();
      const direction = input.direction || 'both';
      const relations: KnowledgeRelation[] = [];

      // Outgoing relations (from this entity)
      if (direction === 'outgoing' || direction === 'both') {
        let outQuery = supabase
          .from('vanguard_knowledge_relations')
          .select('*')
          .eq('from_type', input.entity_type)
          .eq('from_id', input.entity_id);

        if (input.relation_type) {
          outQuery = outQuery.eq('relation_type', input.relation_type);
        }

        const { data: outData } = await outQuery;
        if (outData) {
          relations.push(...(outData as KnowledgeRelation[]));
        }
      }

      // Incoming relations (to this entity)
      if (direction === 'incoming' || direction === 'both') {
        let inQuery = supabase
          .from('vanguard_knowledge_relations')
          .select('*')
          .eq('to_type', input.entity_type)
          .eq('to_id', input.entity_id);

        if (input.relation_type) {
          inQuery = inQuery.eq('relation_type', input.relation_type);
        }

        const { data: inData } = await inQuery;
        if (inData) {
          relations.push(...(inData as KnowledgeRelation[]));
        }
      }

      return {
        success: true,
        data: relations,
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
          code: 'KB_GET_RELATIONS_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'حدث خطأ أثناء استرجاع العلاقات'
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

export const searchMaterialsAdapter = new SearchMaterialsAdapter();
export const getMaterialAdapter = new GetMaterialAdapter();
export const searchProductsAdapter = new SearchProductsAdapter();
export const getProductAdapter = new GetProductAdapter();
export const searchLearningsAdapter = new SearchLearningsAdapter();
export const getRelationsAdapter = new GetRelationsAdapter();

// Register all knowledge base adapters
export function registerKnowledgeAdapters(registry: { register: (adapter: ToolAdapter) => void }) {
  registry.register(searchMaterialsAdapter);
  registry.register(getMaterialAdapter);
  registry.register(searchProductsAdapter);
  registry.register(getProductAdapter);
  registry.register(searchLearningsAdapter);
  registry.register(getRelationsAdapter);
}
