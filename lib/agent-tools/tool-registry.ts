/**
 * Tool Registry - Unified Tool System
 * 
 * المصدر الوحيد للحقيقة لجميع أدوات الوكيل التنفيذي
 * - Defines all available tools with metadata
 * - Provides execution handlers
 * - Manages approval requirements
 * - Supports rollback operations
 */

import { z } from "zod";
import type { Json } from "@/lib/supabase/database.types";

// ============================================
// Types & Interfaces
// ============================================

export type ToolCategory = 
  | "content" 
  | "seo" 
  | "backup" 
  | "analytics" 
  | "system" 
  | "revenue" 
  | "speed";

export type RiskLevel = "low" | "medium" | "high" | "destructive";

export interface ToolExecutionContext {
  companyId?: string;
  actorUserId?: string;
  executionId?: string;
  commandLogId?: string;
  suggestionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
  requiresApproval?: boolean;
  approvalId?: string;
  executionId?: string;
  canRollback?: boolean;
  rollbackId?: string;
}

export type ToolHandler = (
  params: Record<string, unknown>,
  context: ToolExecutionContext
) => Promise<ToolExecutionResult>;

export type RollbackHandler = (
  originalParams: Record<string, unknown>,
  originalResult: ToolExecutionResult,
  context: ToolExecutionContext
) => Promise<ToolExecutionResult>;

export interface ToolParameterSchema {
  type: "object";
  properties: Record<string, {
    type: "string" | "number" | "boolean" | "array" | "object";
    description: string;
    required?: boolean;
    enum?: string[];
    items?: { type: string };
  }>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  displayName: string;
  description: string;
  category: ToolCategory;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  parameters: ToolParameterSchema;
  handler: ToolHandler;
  rollbackHandler?: RollbackHandler;
  examples?: string[];
}

// ============================================
// Parameter Schemas
// ============================================

const SectionCreateSchema: ToolParameterSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "اسم القسم", required: true },
    type: { type: "string", description: "نوع القسم", required: true, enum: ["hero", "features", "testimonials", "cta", "content", "pricing", "contact", "custom"] },
    pagePlacement: { type: "string", description: "مكان القسم في الصفحة", enum: ["home", "about", "contact", "custom"] },
    placementPosition: { type: "string", description: "الموضع في الصفحة", enum: ["header", "body_top", "body_middle", "body_bottom", "footer"] },
    config: { type: "object", description: "إعدادات القسم (JSON)" },
    content: { type: "object", description: "محتوى القسم (JSON)" },
  },
  required: ["name", "type"],
};

const SectionUpdateSchema: ToolParameterSchema = {
  type: "object",
  properties: {
    sectionId: { type: "string", description: "معرف القسم", required: true },
    name: { type: "string", description: "الاسم الجديد" },
    config: { type: "object", description: "إعدادات جديدة" },
    content: { type: "object", description: "محتوى جديد" },
    isActive: { type: "boolean", description: "حالة التفعيل" },
    isVisible: { type: "boolean", description: "حالة الظهور" },
    sortOrder: { type: "number", description: "ترتيب الفرز" },
  },
  required: ["sectionId"],
};

const SEOAnalyzeSchema: ToolParameterSchema = {
  type: "object",
  properties: {
    url: { type: "string", description: "الرابط للتحليل", required: true },
    deepAnalysis: { type: "boolean", description: "تحليل عميق شامل" },
    competitorUrls: { type: "array", description: "روابط المنافسين للمقارنة", items: { type: "string" } },
  },
  required: ["url"],
};

const BackupCreateSchema: ToolParameterSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "اسم النسخة الاحتياطية", required: true },
    description: { type: "string", description: "وصف النسخة" },
    tables: { type: "array", description: "الجداول المطلوبة (افتراضي: الكل)", items: { type: "string" } },
    includeFiles: { type: "boolean", description: "تضمين الملفات" },
    retentionDays: { type: "number", description: "فترة الاحتفاظ بالأيام" },
  },
  required: ["name"],
};

const BackupRestoreSchema: ToolParameterSchema = {
  type: "object",
  properties: {
    backupId: { type: "string", description: "معرف النسخة الاحتياطية", required: true },
    tables: { type: "array", description: "جداول محددة للاستعادة", items: { type: "string" } },
    conflictResolution: { type: "string", description: "طريقة حل التعارض", enum: ["overwrite", "skip", "merge"] },
    validateOnly: { type: "boolean", description: "فقط التحقق بدون استعادة" },
  },
  required: ["backupId"],
};

const SettingUpdateSchema: ToolParameterSchema = {
  type: "object",
  properties: {
    key: { type: "string", description: "مفتاح الإعداد", required: true },
    value: { type: "object", description: "القيمة الجديدة", required: true },
    category: { type: "string", description: "فئة الإعداد", enum: ["general", "appearance", "seo", "analytics", "integrations"] },
    reason: { type: "string", description: "سبب التغيير" },
    autoApprove: { type: "boolean", description: "الموافقة التلقائية" },
  },
  required: ["key", "value"],
};

const ContentUpdateSchema: ToolParameterSchema = {
  type: "object",
  properties: {
    entityType: { type: "string", description: "نوع الكيان", required: true, enum: ["site_section", "room", "product", "blog_post", "page"] },
    entityId: { type: "string", description: "معرف الكيان", required: true },
    fieldPath: { type: "array", description: "مسار الحقل (متداخل)", items: { type: "string" } },
    newValue: { type: "object", description: "القيمة الجديدة", required: true },
    reason: { type: "string", description: "سبب التغيير" },
    createRevision: { type: "boolean", description: "إنشاء مراجعة" },
  },
  required: ["entityType", "entityId", "newValue"],
};

const RevenueAnalyzeSchema: ToolParameterSchema = {
  type: "object",
  properties: {
    period: { type: "string", description: "الفترة", enum: ["7d", "30d", "90d", "1y", "all"] },
    segmentBy: { type: "string", description: "التقسيم حسب", enum: ["source", "campaign", "product", "region"] },
    includeForecast: { type: "boolean", description: "تضمين التوقعات" },
  },
};

const SpeedOptimizeSchema: ToolParameterSchema = {
  type: "object",
  properties: {
    url: { type: "string", description: "الرابط", required: true },
    applyFixes: { type: "boolean", description: "تطبيق الإصلاحات تلقائياً" },
    priority: { type: "string", description: "الأولوية", enum: ["critical", "high", "medium", "low"] },
  },
  required: ["url"],
};

const GoalCreateSchema: ToolParameterSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "عنوان الهدف", required: true },
    description: { type: "string", description: "وصف الهدف" },
    targetMetric: { type: "string", description: "المقياس المستهدف", required: true },
    targetValue: { type: "number", description: "القيمة المستهدفة", required: true },
    deadline: { type: "string", description: "الموعد النهائي (ISO date)" },
    priority: { type: "number", description: "الأولوية (1-10)", enum: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] },
    autoCheck: { type: "boolean", description: "فحص تلقائي" },
    checkFrequency: { type: "string", description: "تكرار الفحص", enum: ["hourly", "daily", "weekly"] },
  },
  required: ["title", "targetMetric", "targetValue"],
};

// ============================================
// Import Tool Handlers (will be implemented)
// ============================================

// These will be imported from real-tool-executor and enhanced
import {
  executeSectionCreate as sectionCreateHandler,
  executeSectionUpdate as sectionUpdateHandler,
  executeSectionDelete as sectionDeleteHandler,
  executeBackupCreate as backupCreateHandler,
  executeSettingUpdate as settingUpdateHandler,
  executeSEOAnalysis as seoAnalyzeHandler,
  executeRevenueAnalysis as revenueAnalyzeHandler,
  executeSpeedOptimization as speedOptimizeHandler,
} from "./tool-handlers";

// ============================================
// Tool Registry Definition
// ============================================

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  // ============================================
  // Content Management Tools
  // ============================================
  
  section_create: {
    name: "section_create",
    displayName: "إنشاء قسم",
    description: "إنشاء قسم جديد في الموقع مع إعداداته ومحتواه",
    category: "content",
    riskLevel: "medium",
    requiresApproval: true,
    parameters: SectionCreateSchema,
    handler: sectionCreateHandler,
    rollbackHandler: sectionDeleteHandler,
    examples: [
      "أنشئ قسم Hero جديد",
      "أضف قسم مميزات للصفحة الرئيسية",
      "create new testimonials section",
    ],
  },

  section_update: {
    name: "section_update",
    displayName: "تحديث قسم",
    description: "تحديث إعدادات أو محتوى قسم موجود",
    category: "content",
    riskLevel: "medium",
    requiresApproval: true,
    parameters: SectionUpdateSchema,
    handler: sectionUpdateHandler,
    examples: [
      "حدث قسم البطولة",
      "غيّر عنوان القسم X",
      "Update section Y content",
    ],
  },

  section_delete: {
    name: "section_delete",
    displayName: "حذف قسم",
    description: "حذف قسم من الموقع (soft delete مع إمكانية الاستعادة)",
    category: "content",
    riskLevel: "destructive",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        sectionId: { type: "string", description: "معرف القسم", required: true },
        permanent: { type: "boolean", description: "حذف نهائي" },
        reason: { type: "string", description: "سبب الحذف" },
      },
      required: ["sectionId"],
    },
    handler: sectionDeleteHandler,
    examples: [
      "احذف القسم X",
      "قم بإزالة القسم Y",
    ],
  },

  content_update: {
    name: "content_update",
    displayName: "تحديث محتوى",
    description: "تحديث محتوى أي كيان (قسم، غرفة، منتج، مقالة) مع نظام مراجعات",
    category: "content",
    riskLevel: "medium",
    requiresApproval: true,
    parameters: ContentUpdateSchema,
    handler: async () => ({ 
      success: false, 
      message: "content_update handler not yet implemented" 
    }),
    examples: [
      "غيّر عنوان المنتج X",
      "حدث وصف الغرفة Y",
    ],
  },

  // ============================================
  // SEO Tools
  // ============================================

  seo_analyze: {
    name: "seo_analyze",
    displayName: "تحليل SEO",
    description: "تحليل SEO حقيقي للصفحة مع درجات ومشاكل وتوصيات",
    category: "seo",
    riskLevel: "low",
    requiresApproval: false,
    parameters: SEOAnalyzeSchema,
    handler: seoAnalyzeHandler,
    examples: [
      "حلل SEO للموقع",
      "تحليل SEO لـ https://example.com",
      "ما درجة SEO للصفحة الرئيسية؟",
    ],
  },

  seo_fix_issues: {
    name: "seo_fix_issues",
    displayName: "إصلاح مشاكل SEO",
    description: "إصلاح المشاكل المكتشفة تلقائياً",
    category: "seo",
    riskLevel: "high",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        analysisId: { type: "string", description: "معرف التحليل", required: true },
        issueCodes: { type: "array", description: "رموز المشاكل للإصلاح", items: { type: "string" } },
        autoFixAll: { type: "boolean", description: "إصلاح الكل" },
      },
      required: ["analysisId"],
    },
    handler: async () => ({ 
      success: false, 
      message: "seo_fix_issues handler not yet implemented" 
    }),
    examples: [
      "أصلح مشاكل SEO المكتشفة",
      "فقد المشاكل الحرجة",
    ],
  },

  // ============================================
  // Backup Tools
  // ============================================

  backup_create: {
    name: "backup_create",
    displayName: "إنشاء نسخة احتياطية",
    description: "إنشاء نسخة احتياطية حقيقية قابلة للتحميل والاستعادة",
    category: "backup",
    riskLevel: "low",
    requiresApproval: false,
    parameters: BackupCreateSchema,
    handler: backupCreateHandler,
    examples: [
      "اعمل نسخة احتياطية",
      "backup the database",
      "حفظ نسخة أمان",
    ],
  },

  backup_restore: {
    name: "backup_restore",
    displayName: "استعادة نسخة احتياطية",
    description: "استعادة بيانات من نسخة احتياطية",
    category: "backup",
    riskLevel: "destructive",
    requiresApproval: true,
    parameters: BackupRestoreSchema,
    handler: async () => ({ 
      success: false, 
      message: "backup_restore handler not yet implemented" 
    }),
    examples: [
      "استعادة النسخة الاحتياطية X",
      "ارجع للنسخة Y",
    ],
  },

  backup_list: {
    name: "backup_list",
    displayName: "قائمة النسخ الاحتياطية",
    description: "عرض جميع النسخ الاحتياطية المتاحة",
    category: "backup",
    riskLevel: "low",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        includeExpired: { type: "boolean", description: "تضمين المنقضية" },
        limit: { type: "number", description: "عدد النتائج" },
      },
    },
    handler: async () => ({ 
      success: false, 
      message: "backup_list handler not yet implemented" 
    }),
    examples: [
      "اعرض النسخ الاحتياطية",
      "قائمة backups",
    ],
  },

  // ============================================
  // System/Settings Tools
  // ============================================

  setting_update: {
    name: "setting_update",
    displayName: "تحديث إعداد",
    description: "تحديث إعداد مع نظام مراجعات وتراجع",
    category: "system",
    riskLevel: "high",
    requiresApproval: true,
    parameters: SettingUpdateSchema,
    handler: settingUpdateHandler,
    examples: [
      "غيّر اللون الأساسي إلى ذهبي",
      "غيّر الاعداد X إلى Y",
      "update setting key to value",
    ],
  },

  system_health_check: {
    name: "system_health_check",
    displayName: "فحص صحة النظام",
    description: "فحص شامل لصحة النظام والأداء",
    category: "system",
    riskLevel: "low",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        deepCheck: { type: "boolean", description: "فحص عميق" },
        includeRecommendations: { type: "boolean", description: "تضمين التوصيات" },
      },
    },
    handler: async () => ({ 
      success: false, 
      message: "system_health_check handler not yet implemented" 
    }),
    examples: [
      "فحص صحة النظام",
      "system health check",
    ],
  },

  // ============================================
  // Analytics/Revenue Tools
  // ============================================

  revenue_analyze: {
    name: "revenue_analyze",
    displayName: "تحليل الإيرادات",
    description: "تحليل الإيرادات والتحويلات من البيانات الحقيقية",
    category: "revenue",
    riskLevel: "low",
    requiresApproval: false,
    parameters: RevenueAnalyzeSchema,
    handler: revenueAnalyzeHandler,
    examples: [
      "حلل الإيرادات",
      "ما معدل التحويل؟",
      "revenue analysis",
    ],
  },

  metrics_realtime: {
    name: "metrics_realtime",
    displayName: "مؤشرات لحظية",
    description: "عرض المؤشرات الحقيقية بدون estimates",
    category: "analytics",
    riskLevel: "low",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        metrics: { type: "array", description: "المؤشرات المطلوبة", items: { type: "string" } },
        timeRange: { type: "string", description: "النطاق الزمني", enum: ["1h", "24h", "7d", "30d"] },
      },
    },
    handler: async () => ({ 
      success: false, 
      message: "metrics_realtime handler not yet implemented" 
    }),
    examples: [
      "المؤشرات الحالية",
      "realtime metrics",
    ],
  },

  // ============================================
  // Speed/Performance Tools
  // ============================================

  speed_analyze: {
    name: "speed_analyze",
    displayName: "تحليل السرعة",
    description: "تحليل سرعة الموقع مع مؤشرات حقيقية",
    category: "speed",
    riskLevel: "low",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "الرابط", required: true },
        deviceType: { type: "string", description: "نوع الجهاز", enum: ["mobile", "desktop"] },
      },
      required: ["url"],
    },
    handler: speedOptimizeHandler,
    examples: [
      "حلل سرعة الموقع",
      "site speed check",
      "measure performance",
    ],
  },

  speed_optimize: {
    name: "speed_optimize",
    displayName: "تحسين السرعة",
    description: "تحسين سرعة الموقع تلقائياً",
    category: "speed",
    riskLevel: "high",
    requiresApproval: true,
    parameters: SpeedOptimizeSchema,
    handler: speedOptimizeHandler,
    examples: [
      "حسّن سرعة الموقع",
      "optimize site speed",
    ],
  },

  // ============================================
  // Goal Management Tools
  // ============================================

  goal_create: {
    name: "goal_create",
    displayName: "إنشاء هدف",
    description: "إنشاء هدف جديد مع تتبع تلقائي",
    category: "system",
    riskLevel: "low",
    requiresApproval: false,
    parameters: GoalCreateSchema,
    handler: async () => ({ 
      success: false, 
      message: "goal_create handler not yet implemented" 
    }),
    examples: [
      "أنشئ هدف جديد",
      "create goal increase conversion by 10%",
    ],
  },

  goal_list: {
    name: "goal_list",
    displayName: "قائمة الأهداف",
    description: "عرض جميع الأهداف النشطة والمكتملة",
    category: "system",
    riskLevel: "low",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "الحالة", enum: ["active", "completed", "failed", "all"] },
        includeProgress: { type: "boolean", description: "تضمين التقدم" },
      },
    },
    handler: async () => ({ 
      success: false, 
      message: "goal_list handler not yet implemented" 
    }),
    examples: [
      "اعرض الأهداف",
      "list goals",
    ],
  },

  goal_check_progress: {
    name: "goal_check_progress",
    displayName: "فحص تقدم الهدف",
    description: "فحص التقدم نحو تحقيق الهدف",
    category: "system",
    riskLevel: "low",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        goalId: { type: "string", description: "معرف الهدف", required: true },
      },
      required: ["goalId"],
    },
    handler: async () => ({ 
      success: false, 
      message: "goal_check_progress handler not yet implemented" 
    }),
    examples: [
      "فحص تقدم الهدف X",
      "check goal progress",
    ],
  },
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get tool definition by name
 */
export function getTool(name: string): ToolDefinition | undefined {
  return TOOL_REGISTRY[name];
}

/**
 * Get all tools in a category
 */
export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return Object.values(TOOL_REGISTRY).filter((tool) => tool.category === category);
}

/**
 * Get all tools requiring approval
 */
export function getToolsRequiringApproval(): ToolDefinition[] {
  return Object.values(TOOL_REGISTRY).filter((tool) => tool.requiresApproval);
}

/**
 * Validate tool parameters against schema
 */
export function validateToolParams(
  toolName: string,
  params: Record<string, unknown>
): { valid: boolean; errors?: string[] } {
  const tool = getTool(toolName);
  if (!tool) {
    return { valid: false, errors: [`Unknown tool: ${toolName}`] };
  }

  const errors: string[] = [];
  const schema = tool.parameters;

  // Check required fields
  for (const required of schema.required || []) {
    if (!(required in params) || params[required] === undefined || params[required] === null) {
      errors.push(`Missing required parameter: ${required}`);
    }
  }

  // Check types (basic validation)
  for (const [key, value] of Object.entries(params)) {
    const prop = schema.properties[key];
    if (!prop) {
      errors.push(`Unknown parameter: ${key}`);
      continue;
    }

    const actualType = Array.isArray(value) ? "array" : typeof value;
    if (actualType !== prop.type && !(prop.type === "object" && actualType === "object")) {
      errors.push(`Invalid type for ${key}: expected ${prop.type}, got ${actualType}`);
    }

    // Check enum values
    if (prop.enum && !prop.enum.includes(String(value))) {
      errors.push(`Invalid value for ${key}: must be one of ${prop.enum.join(", ")}`);
    }
  }

  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
}

/**
 * Execute a tool with full tracking
 */
export async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const tool = getTool(toolName);
  if (!tool) {
    return {
      success: false,
      message: `Tool "${toolName}" not found`,
      error: `Unknown tool: ${toolName}`,
    };
  }

  // Validate parameters
  const validation = validateToolParams(toolName, params);
  if (!validation.valid) {
    return {
      success: false,
      message: `Invalid parameters: ${validation.errors?.join(", ")}`,
      error: validation.errors?.join(", "),
    };
  }

  // Execute the tool
  try {
    const result = await tool.handler(params, context);
    return {
      ...result,
      executionId: context.executionId,
      canRollback: !!tool.rollbackHandler && result.success,
    };
  } catch (error) {
    return {
      success: false,
      message: `Tool execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      error: error instanceof Error ? error.message : "Unknown error",
      executionId: context.executionId,
    };
  }
}

/**
 * Rollback a tool execution
 */
export async function rollbackTool(
  toolName: string,
  originalParams: Record<string, unknown>,
  originalResult: ToolExecutionResult,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const tool = getTool(toolName);
  if (!tool) {
    return {
      success: false,
      message: `Tool "${toolName}" not found`,
      error: `Unknown tool: ${toolName}`,
    };
  }

  if (!tool.rollbackHandler) {
    return {
      success: false,
      message: `Tool "${toolName}" does not support rollback`,
      error: "Rollback not supported",
    };
  }

  try {
    return await tool.rollbackHandler(originalParams, originalResult, context);
  } catch (error) {
    return {
      success: false,
      message: `Rollback failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Export all tool names for type safety
export type ToolName = keyof typeof TOOL_REGISTRY;
