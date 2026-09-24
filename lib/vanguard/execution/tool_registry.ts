/**
 * VANGUARD Tool Registry
 * 
 * مسجل الأدوات - يدير جميع الأدوات المتاحة للنظام
 * Manages all available tools and their execution
 */

import { z } from 'zod';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type ToolCategory = 
  | 'crm'           // CRM operations (leads, contacts)
  | 'search'        // Web search
  | 'knowledge'     // Knowledge base access
  | 'calculation'   // Math, dates, currency
  | 'communication' // Send messages, emails
  | 'analysis';     // Data analysis, reporting

export type ToolRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  schema?: z.ZodTypeAny;
  default?: unknown;
  examples?: unknown[];
}

export interface ToolDefinition {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  category: ToolCategory;
  riskLevel: ToolRiskLevel;
  parameters: ToolParameter[];
  returns: {
    type: string;
    description: string;
    descriptionAr: string;
  };
  examples: Array<{
    input: Record<string, unknown>;
    output: unknown;
    description: string;
  }>;
  requiresAuth?: boolean;
  rateLimit?: {
    maxCalls: number;
    windowMs: number;
  };
}

export interface ToolExecutionContext {
  userId?: string;
  sessionId?: string;
  conversationId?: string;
  channel?: 'whatsapp' | 'email' | 'webchat';
  metadata?: Record<string, unknown>;
}

export interface ToolExecutionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    messageAr: string;
    details?: Record<string, unknown>;
  };
  metadata: {
    toolId: string;
    executionTimeMs: number;
    timestamp: string;
    tokensUsed?: number;
    cached?: boolean;
  };
}

export interface ToolAdapter<TInput = unknown, TOutput = unknown> {
  definition: ToolDefinition;
  
  /**
   * Execute the tool with given parameters
   */
  execute(
    input: TInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<TOutput>>;
  
  /**
   * Validate input parameters before execution
   */
  validate(input: unknown): { valid: boolean; errors?: string[] };
  
  /**
   * Check if the tool is available (e.g., API key configured)
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Get usage statistics
   */
  getStats?(): Promise<{
    totalCalls: number;
    successRate: number;
    avgExecutionTimeMs: number;
  }>;
}

// ============================================================================
// Tool Registry
// ============================================================================

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ToolAdapter> = new Map();
  private callCounts: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /**
   * Register a tool adapter
   */
  register(adapter: ToolAdapter): void {
    const { id } = adapter.definition;
    
    if (this.tools.has(id)) {
      throw new Error(`Tool with id "${id}" is already registered`);
    }
    
    this.tools.set(id, adapter);
    this.callCounts.set(id, 0);
    
    console.log(`[ToolRegistry] Registered tool: ${id} (${adapter.definition.nameAr})`);
  }

  /**
   * Unregister a tool
   */
  unregister(toolId: string): boolean {
    const deleted = this.tools.delete(toolId);
    if (deleted) {
      this.callCounts.delete(toolId);
      console.log(`[ToolRegistry] Unregistered tool: ${toolId}`);
    }
    return deleted;
  }

  /**
   * Get a tool adapter by ID
   */
  getTool(toolId: string): ToolAdapter | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(adapter => adapter.definition);
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: ToolCategory): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(adapter => adapter.definition.category === category)
      .map(adapter => adapter.definition);
  }

  /**
   * Get tools by risk level
   */
  getToolsByRiskLevel(maxRisk: ToolRiskLevel): ToolDefinition[] {
    const riskOrder: ToolRiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const maxIndex = riskOrder.indexOf(maxRisk);
    
    return Array.from(this.tools.values())
      .filter(adapter => {
        const toolRiskIndex = riskOrder.indexOf(adapter.definition.riskLevel);
        return toolRiskIndex <= maxIndex;
      })
      .map(adapter => adapter.definition);
  }

  /**
   * Search tools by query
   */
  searchTools(query: string): ToolDefinition[] {
    const lowerQuery = query.toLowerCase();
    
    return Array.from(this.tools.values())
      .filter(adapter => {
        const def = adapter.definition;
        return (
          def.name.toLowerCase().includes(lowerQuery) ||
          def.nameAr.includes(query) ||
          def.description.toLowerCase().includes(lowerQuery) ||
          def.descriptionAr.includes(query)
        );
      })
      .map(adapter => adapter.definition);
  }

  /**
   * Execute a tool
   */
  async executeTool<TInput = unknown, TOutput = unknown>(
    toolId: string,
    input: TInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<TOutput>> {
    const adapter = this.tools.get(toolId);
    
    if (!adapter) {
      return {
        success: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool "${toolId}" not found`,
          messageAr: `الأداة "${toolId}" غير موجودة`
        },
        metadata: {
          toolId,
          executionTimeMs: 0,
          timestamp: new Date().toISOString()
        }
      };
    }

    // Check if tool is available
    const isAvailable = await adapter.isAvailable();
    if (!isAvailable) {
      return {
        success: false,
        error: {
          code: 'TOOL_UNAVAILABLE',
          message: `Tool "${toolId}" is not available`,
          messageAr: `الأداة "${toolId}" غير متاحة حالياً`
        },
        metadata: {
          toolId,
          executionTimeMs: 0,
          timestamp: new Date().toISOString()
        }
      };
    }

    // Validate input
    const validation = adapter.validate(input);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Input validation failed',
          messageAr: 'فشل التحقق من المدخلات',
          details: { errors: validation.errors }
        },
        metadata: {
          toolId,
          executionTimeMs: 0,
          timestamp: new Date().toISOString()
        }
      };
    }

    // Execute
    const startTime = Date.now();
    try {
      const result = await adapter.execute(input, context);
      
      // Increment call count
      const currentCount = this.callCounts.get(toolId) || 0;
      this.callCounts.set(toolId, currentCount + 1);
      
      return result as ToolExecutionResult<TOutput>;
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'حدث خطأ أثناء التنفيذ'
        },
        metadata: {
          toolId,
          executionTimeMs,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTools: number;
    toolsByCategory: Record<ToolCategory, number>;
    toolsByRisk: Record<ToolRiskLevel, number>;
    totalCalls: number;
    callsByTool: Record<string, number>;
  } {
    const toolsByCategory: Record<ToolCategory, number> = {
      crm: 0,
      search: 0,
      knowledge: 0,
      calculation: 0,
      communication: 0,
      analysis: 0
    };
    
    const toolsByRisk: Record<ToolRiskLevel, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0
    };

    for (const adapter of this.tools.values()) {
      const { category, riskLevel } = adapter.definition;
      toolsByCategory[category]++;
      toolsByRisk[riskLevel]++;
    }

    const callsByTool: Record<string, number> = {};
    let totalCalls = 0;
    
    for (const [toolId, count] of this.callCounts.entries()) {
      callsByTool[toolId] = count;
      totalCalls += count;
    }

    return {
      totalTools: this.tools.size,
      toolsByCategory,
      toolsByRisk,
      totalCalls,
      callsByTool
    };
  }

  /**
   * Check if a tool requires approval based on risk level
   */
  requiresApproval(toolId: string, userRole?: string): boolean {
    const adapter = this.tools.get(toolId);
    if (!adapter) return true;

    const { riskLevel } = adapter.definition;

    // CRITICAL always requires admin approval
    if (riskLevel === 'CRITICAL') {
      return userRole !== 'admin';
    }

    // HIGH requires manager or admin approval
    if (riskLevel === 'HIGH') {
      return userRole !== 'admin' && userRole !== 'manager';
    }

    // MEDIUM and LOW don't require approval
    return false;
  }

  /**
   * Reset registry (for testing)
   */
  reset(): void {
    this.tools.clear();
    this.callCounts.clear();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const toolRegistry = ToolRegistry.getInstance();
