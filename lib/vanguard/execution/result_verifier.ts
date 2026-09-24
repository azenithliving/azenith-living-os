/**
 * VANGUARD Result Verification Engine
 * 
 * محرك التحقق من النتائج - التحقق من المخرجات وكشف الهلوسة
 * Validates tool outputs, checks business rules, detects hallucinations
 */

import { z } from 'zod';
import type { ToolExecutionResult } from './tool_registry';

// ============================================================================
// Types
// ============================================================================

export type VerificationLevel = 'none' | 'basic' | 'standard' | 'strict';
export type VerificationStatus = 'passed' | 'warning' | 'failed';

export interface VerificationRule {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  check: (result: unknown, context: VerificationContext) => Promise<VerificationRuleResult>;
}

export interface VerificationContext {
  toolId: string;
  input: unknown;
  metadata?: Record<string, unknown>;
}

export interface VerificationRuleResult {
  passed: boolean;
  message?: string;
  messageAr?: string;
  details?: Record<string, unknown>;
  confidence?: number;
}

export interface VerificationResult {
  status: VerificationStatus;
  confidence: number;
  rules: Array<{
    ruleId: string;
    ruleName: string;
    ruleNameAr: string;
    severity: string;
    passed: boolean;
    message?: string;
    messageAr?: string;
    details?: Record<string, unknown>;
  }>;
  warnings: string[];
  errors: string[];
  suggestions?: string[];
  metadata: {
    verifiedAt: string;
    level: VerificationLevel;
    rulesChecked: number;
    rulesPassed: number;
    rulesFailed: number;
  };
}

// ============================================================================
// Built-in Verification Rules
// ============================================================================

/**
 * Schema Validation Rule
 */
const schemaValidationRule: VerificationRule = {
  id: 'schema_validation',
  name: 'Schema Validation',
  nameAr: 'التحقق من البنية',
  description: 'Validates result structure matches expected schema',
  descriptionAr: 'يتحقق من أن النتيجة تطابق البنية المتوقعة',
  severity: 'high',
  check: async (result: unknown, context: VerificationContext): Promise<VerificationRuleResult> => {
    try {
      // Basic type checking
      if (result === null || result === undefined) {
        return {
          passed: false,
          message: 'Result is null or undefined',
          messageAr: 'النتيجة فارغة'
        };
      }

      // Tool-specific schema validation
      if (context.toolId.startsWith('crm_')) {
        return validateCRMResult(result, context);
      } else if (context.toolId.startsWith('kb_')) {
        return validateKnowledgeResult(result, context);
      } else if (context.toolId.startsWith('search_') || context.toolId === 'web_search') {
        return validateSearchResult(result, context);
      }

      return {
        passed: true,
        confidence: 0.8
      };
    } catch (error) {
      return {
        passed: false,
        message: error instanceof Error ? error.message : 'Schema validation failed',
        messageAr: 'فشل التحقق من البنية'
      };
    }
  }
};

/**
 * Business Rules Validation
 */
const businessRulesRule: VerificationRule = {
  id: 'business_rules',
  name: 'Business Rules',
  nameAr: 'القواعد التجارية',
  description: 'Validates result against business logic',
  descriptionAr: 'يتحقق من توافق النتيجة مع المنطق التجاري',
  severity: 'high',
  check: async (result: unknown, context: VerificationContext): Promise<VerificationRuleResult> => {
    try {
      // CRM business rules
      if (context.toolId === 'crm_create_lead' || context.toolId === 'crm_update_lead') {
        return validateCRMBusinessRules(result as any);
      }

      // Currency conversion rules
      if (context.toolId === 'convert_currency') {
        return validateCurrencyRules(result as any);
      }

      // Calculator rules
      if (context.toolId === 'calculate') {
        return validateCalculationRules(result as any);
      }

      return {
        passed: true,
        confidence: 0.9
      };
    } catch (error) {
      return {
        passed: false,
        message: error instanceof Error ? error.message : 'Business rule validation failed',
        messageAr: 'فشل التحقق من القواعد التجارية'
      };
    }
  }
};

/**
 * Hallucination Detection
 */
const hallucinationDetectionRule: VerificationRule = {
  id: 'hallucination_detection',
  name: 'Hallucination Detection',
  nameAr: 'كشف الهلوسة',
  description: 'Detects potentially fabricated or inconsistent data',
  descriptionAr: 'يكتشف البيانات المختلقة أو غير المتسقة',
  severity: 'critical',
  check: async (result: unknown, context: VerificationContext): Promise<VerificationRuleResult> => {
    try {
      const warnings: string[] = [];

      // Check for placeholder values
      const resultStr = JSON.stringify(result);
      const placeholders = ['example.com', 'placeholder', 'TODO', 'FIXME', 'test@test.com', '123-456-7890'];
      
      for (const placeholder of placeholders) {
        if (resultStr.includes(placeholder)) {
          warnings.push(`Potential placeholder detected: ${placeholder}`);
        }
      }

      // Check for repeated patterns (potential hallucination)
      if (Array.isArray(result)) {
        const uniqueItems = new Set(result.map(item => JSON.stringify(item)));
        if (result.length > 3 && uniqueItems.size === 1) {
          warnings.push('Repeated identical items detected');
        }
      }

      // Check for unrealistic numbers
      if (typeof result === 'object' && result !== null) {
        const obj = result as Record<string, any>;
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'number') {
            // Check for unrealistic prices/amounts
            if (key.includes('price') || key.includes('amount') || key.includes('budget')) {
              if (value < 0) {
                warnings.push(`Negative ${key}: ${value}`);
              }
              if (value > 1000000000) {
                warnings.push(`Unrealistic ${key}: ${value}`);
              }
            }
          }
        }
      }

      return {
        passed: warnings.length === 0,
        message: warnings.length > 0 ? warnings.join('; ') : undefined,
        messageAr: warnings.length > 0 ? 'تم اكتشاف بيانات مشبوهة' : undefined,
        details: { warnings },
        confidence: warnings.length === 0 ? 0.95 : Math.max(0.5, 1 - (warnings.length * 0.15))
      };
    } catch (error) {
      return {
        passed: true,
        confidence: 0.6,
        message: 'Could not verify hallucination',
        messageAr: 'لم نتمكن من التحقق من الهلوسة'
      };
    }
  }
};

/**
 * Data Consistency Rule
 */
const dataConsistencyRule: VerificationRule = {
  id: 'data_consistency',
  name: 'Data Consistency',
  nameAr: 'اتساق البيانات',
  description: 'Checks for internal data consistency',
  descriptionAr: 'يتحقق من اتساق البيانات الداخلي',
  severity: 'medium',
  check: async (result: unknown, context: VerificationContext): Promise<VerificationRuleResult> => {
    try {
      if (typeof result !== 'object' || result === null) {
        return { passed: true, confidence: 0.9 };
      }

      const obj = result as Record<string, any>;
      const issues: string[] = [];

      // Check date consistency
      if (obj.startDate && obj.endDate) {
        const start = new Date(obj.startDate);
        const end = new Date(obj.endDate);
        if (start > end) {
          issues.push('Start date is after end date');
        }
      }

      // Check min/max consistency
      if (obj.budget_min !== undefined && obj.budget_max !== undefined) {
        if (obj.budget_min > obj.budget_max) {
          issues.push('Minimum budget exceeds maximum budget');
        }
      }

      // Check probability ranges
      if (obj.probability !== undefined) {
        if (obj.probability < 0 || obj.probability > 1) {
          issues.push('Probability out of range (0-1)');
        }
      }

      // Check score ranges
      if (obj.score !== undefined) {
        if (obj.score < 0 || obj.score > 100) {
          issues.push('Score out of range (0-100)');
        }
      }

      return {
        passed: issues.length === 0,
        message: issues.join('; '),
        messageAr: issues.length > 0 ? 'تم اكتشاف عدم اتساق في البيانات' : undefined,
        details: { issues },
        confidence: issues.length === 0 ? 0.95 : 0.6
      };
    } catch (error) {
      return {
        passed: true,
        confidence: 0.7
      };
    }
  }
};

/**
 * Completeness Check
 */
const completenessRule: VerificationRule = {
  id: 'completeness',
  name: 'Completeness Check',
  nameAr: 'التحقق من الاكتمال',
  description: 'Ensures all required fields are present',
  descriptionAr: 'يتأكد من وجود جميع الحقول المطلوبة',
  severity: 'medium',
  check: async (result: unknown, context: VerificationContext): Promise<VerificationRuleResult> => {
    try {
      if (typeof result !== 'object' || result === null) {
        return { passed: true, confidence: 0.9 };
      }

      const obj = result as Record<string, any>;
      const missingFields: string[] = [];

      // Tool-specific required fields
      if (context.toolId === 'crm_create_lead' || context.toolId === 'crm_get_lead') {
        const required = ['id', 'session_id', 'stage', 'score'];
        for (const field of required) {
          if (!(field in obj) || obj[field] === null || obj[field] === undefined) {
            missingFields.push(field);
          }
        }
      }

      if (context.toolId === 'web_search' || context.toolId === 'search_domain') {
        const required = ['query', 'results'];
        for (const field of required) {
          if (!(field in obj)) {
            missingFields.push(field);
          }
        }
      }

      return {
        passed: missingFields.length === 0,
        message: missingFields.length > 0 ? `Missing fields: ${missingFields.join(', ')}` : undefined,
        messageAr: missingFields.length > 0 ? `حقول مفقودة: ${missingFields.join('، ')}` : undefined,
        details: { missingFields },
        confidence: missingFields.length === 0 ? 0.95 : 0.5
      };
    } catch (error) {
      return {
        passed: true,
        confidence: 0.7
      };
    }
  }
};

// ============================================================================
// Helper Validation Functions
// ============================================================================

function validateCRMResult(result: unknown, context: VerificationContext): VerificationRuleResult {
  const LeadSchema = z.object({
    id: z.string().uuid(),
    session_id: z.string().min(1),
    stage: z.enum(['new', 'qualified', 'quoted', 'negotiating', 'contracted', 'won', 'lost']),
    score: z.number().min(0).max(100)
  });

  try {
    LeadSchema.parse(result);
    return { passed: true, confidence: 0.95 };
  } catch (error) {
    return {
      passed: false,
      message: error instanceof Error ? error.message : 'Invalid CRM result structure',
      messageAr: 'بنية نتيجة CRM غير صحيحة'
    };
  }
}

function validateKnowledgeResult(result: unknown, context: VerificationContext): VerificationRuleResult {
  if (Array.isArray(result)) {
    // Search results
    if (result.length === 0) {
      return {
        passed: true,
        confidence: 0.9,
        message: 'No results found',
        messageAr: 'لا توجد نتائج'
      };
    }
    return { passed: true, confidence: 0.95 };
  } else if (typeof result === 'object' && result !== null) {
    // Single entity
    const obj = result as Record<string, any>;
    if (obj.id || obj.slug) {
      return { passed: true, confidence: 0.95 };
    }
  }

  return {
    passed: false,
    message: 'Invalid knowledge base result',
    messageAr: 'نتيجة قاعدة المعرفة غير صحيحة'
  };
}

function validateSearchResult(result: unknown, context: VerificationContext): VerificationRuleResult {
  const SearchSchema = z.object({
    query: z.string(),
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string().optional()
    }))
  });

  try {
    SearchSchema.parse(result);
    return { passed: true, confidence: 0.9 };
  } catch (error) {
    return {
      passed: false,
      message: 'Invalid search result structure',
      messageAr: 'بنية نتيجة البحث غير صحيحة'
    };
  }
}

function validateCRMBusinessRules(result: any): VerificationRuleResult {
  const issues: string[] = [];

  // Budget validation
  if (result.budget_min !== undefined && result.budget_min < 0) {
    issues.push('Budget minimum cannot be negative');
  }

  if (result.budget_max !== undefined && result.budget_max < 0) {
    issues.push('Budget maximum cannot be negative');
  }

  // Score validation
  if (result.score !== undefined && (result.score < 0 || result.score > 100)) {
    issues.push('Score must be between 0 and 100');
  }

  // Probability validation
  if (result.probability !== undefined && (result.probability < 0 || result.probability > 1)) {
    issues.push('Probability must be between 0 and 1');
  }

  return {
    passed: issues.length === 0,
    message: issues.join('; '),
    messageAr: issues.length > 0 ? 'انتهاك للقواعد التجارية' : undefined,
    confidence: issues.length === 0 ? 0.95 : 0.5
  };
}

function validateCurrencyRules(result: any): VerificationRuleResult {
  const issues: string[] = [];

  if (result.amount !== undefined && result.amount < 0) {
    issues.push('Amount cannot be negative');
  }

  if (result.convertedAmount !== undefined && result.convertedAmount < 0) {
    issues.push('Converted amount cannot be negative');
  }

  if (result.rate !== undefined && result.rate <= 0) {
    issues.push('Exchange rate must be positive');
  }

  return {
    passed: issues.length === 0,
    message: issues.join('; '),
    messageAr: issues.length > 0 ? 'قواعد العملة غير صحيحة' : undefined,
    confidence: issues.length === 0 ? 0.95 : 0.5
  };
}

function validateCalculationRules(result: any): VerificationRuleResult {
  const issues: string[] = [];

  if (result.result !== undefined) {
    if (!isFinite(result.result)) {
      issues.push('Result is not a finite number');
    }
    if (isNaN(result.result)) {
      issues.push('Result is NaN');
    }
  }

  return {
    passed: issues.length === 0,
    message: issues.join('; '),
    messageAr: issues.length > 0 ? 'نتيجة الحساب غير صحيحة' : undefined,
    confidence: issues.length === 0 ? 0.95 : 0.3
  };
}

// ============================================================================
// Result Verifier
// ============================================================================

export class ResultVerifier {
  private rules: Map<string, VerificationRule> = new Map();

  constructor() {
    // Register built-in rules
    this.registerRule(schemaValidationRule);
    this.registerRule(businessRulesRule);
    this.registerRule(hallucinationDetectionRule);
    this.registerRule(dataConsistencyRule);
    this.registerRule(completenessRule);
  }

  /**
   * Register a verification rule
   */
  registerRule(rule: VerificationRule): void {
    this.rules.set(rule.id, rule);
    console.log(`[ResultVerifier] Registered rule: ${rule.id} (${rule.nameAr})`);
  }

  /**
   * Unregister a rule
   */
  unregisterRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Verify a tool execution result
   */
  async verify(
    result: ToolExecutionResult<unknown>,
    context: VerificationContext,
    level: VerificationLevel = 'standard'
  ): Promise<VerificationResult> {
    const startTime = Date.now();

    // Skip verification if tool failed
    if (!result.success) {
      return {
        status: 'warning',
        confidence: 0,
        rules: [],
        warnings: ['Tool execution failed - verification skipped'],
        errors: [result.error?.message || 'Unknown error'],
        metadata: {
          verifiedAt: new Date().toISOString(),
          level,
          rulesChecked: 0,
          rulesPassed: 0,
          rulesFailed: 0
        }
      };
    }

    // Select rules based on level
    const rulesToCheck = this.selectRules(level);
    
    console.log(`[ResultVerifier] Verifying result with ${rulesToCheck.length} rules (level: ${level})`);

    // Run verification rules
    const ruleResults: Array<{
      ruleId: string;
      ruleName: string;
      ruleNameAr: string;
      severity: string;
      passed: boolean;
      message?: string;
      messageAr?: string;
      details?: Record<string, unknown>;
    }> = [];

    let totalConfidence = 0;
    let rulesPassed = 0;
    let rulesFailed = 0;

    for (const rule of rulesToCheck) {
      try {
        const ruleResult = await rule.check(result.data, context);
        
        ruleResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruleNameAr: rule.nameAr,
          severity: rule.severity,
          passed: ruleResult.passed,
          message: ruleResult.message,
          messageAr: ruleResult.messageAr,
          details: ruleResult.details
        });

        if (ruleResult.passed) {
          rulesPassed++;
          totalConfidence += ruleResult.confidence || 0.8;
        } else {
          rulesFailed++;
        }
      } catch (error) {
        console.error(`[ResultVerifier] Rule ${rule.id} threw exception:`, error);
        rulesFailed++;
      }
    }

    // Calculate overall confidence
    const avgConfidence = rulesToCheck.length > 0 ? totalConfidence / rulesToCheck.length : 0;

    // Determine status
    let status: VerificationStatus;
    const criticalFailed = ruleResults.some(r => r.severity === 'critical' && !r.passed);
    const highFailed = ruleResults.some(r => r.severity === 'high' && !r.passed);

    if (criticalFailed) {
      status = 'failed';
    } else if (highFailed || rulesFailed > rulesPassed) {
      status = 'warning';
    } else {
      status = 'passed';
    }

    // Collect warnings and errors
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const ruleResult of ruleResults) {
      if (!ruleResult.passed) {
        if (ruleResult.severity === 'critical' || ruleResult.severity === 'high') {
          errors.push(ruleResult.message || ruleResult.ruleName);
        } else {
          warnings.push(ruleResult.message || ruleResult.ruleName);
        }
      }
    }

    const verificationTime = Date.now() - startTime;
    console.log(`[ResultVerifier] Verification complete: ${status} (${verificationTime}ms, confidence: ${avgConfidence.toFixed(2)})`);

    return {
      status,
      confidence: avgConfidence,
      rules: ruleResults,
      warnings,
      errors,
      metadata: {
        verifiedAt: new Date().toISOString(),
        level,
        rulesChecked: rulesToCheck.length,
        rulesPassed,
        rulesFailed
      }
    };
  }

  /**
   * Select rules based on verification level
   */
  private selectRules(level: VerificationLevel): VerificationRule[] {
    const allRules = Array.from(this.rules.values());

    switch (level) {
      case 'none':
        return [];
      case 'basic':
        return allRules.filter(r => r.severity === 'critical');
      case 'standard':
        return allRules.filter(r => r.severity === 'critical' || r.severity === 'high');
      case 'strict':
        return allRules;
      default:
        return allRules.filter(r => r.severity === 'critical' || r.severity === 'high');
    }
  }

  /**
   * Get all registered rules
   */
  getRules(): VerificationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): VerificationRule | undefined {
    return this.rules.get(ruleId);
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const resultVerifier = new ResultVerifier();
