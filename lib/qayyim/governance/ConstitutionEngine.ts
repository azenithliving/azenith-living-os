/**
 * ConstitutionEngine - Constitutional AI Engine for Qayyim Swarm
 * Enforces identity laws, prevents hallucinations, ensures human approval
 */

import { askOrchestratorMessages } from "@/lib/ai-orchestrator";

export interface ConstitutionRule {
  id: string;
  name: string;
  description: string;
  weight: number; // 0-1
  enforcement: 'hard_block' | 'soft_warn' | 'audit_only';
  check: (input: ConstitutionCheckInput) => Promise<ConstitutionCheckResult>;
}

export interface ConstitutionCheckInput {
  agentKey: string;
  actionType: 'draft' | 'publish' | 'audit' | 'analyze' | 'review';
  content?: any;
  proposedChanges?: any;
  targetPage?: string;
  targetSection?: string;
  evidenceUrls?: string[];
  humanApproval?: boolean;
  approvedBy?: string;
}

export interface ConstitutionCheckResult {
  passed: boolean;
  violations: ConstitutionViolation[];
  warnings: ConstitutionWarning[];
  score: number; // 0-1
}

export interface ConstitutionViolation {
  ruleId: string;
  ruleName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  location?: string;
  evidenceUrl?: string;
  suggestedFix?: string;
}

export interface ConstitutionWarning {
  ruleId: string;
  ruleName: string;
  message: string;
  location?: string;
}

export interface ConstitutionReport {
  overallPassed: boolean;
  overallScore: number;
  results: ConstitutionCheckResult[];
  summary: string;
  timestamp: string;
}

export class ConstitutionEngine {
  private rules: ConstitutionRule[] = [];

  constructor() {
    this.initializeRules();
  }

  /**
   * Initialize all constitutional rules
   */
  private initializeRules() {
    // Rule 1: No Hallucination - Every claim must have evidence
    this.rules.push({
      id: 'no_hallucination',
      name: 'لا وهم - كل ادعاء بدليل',
      description: 'كل ملاحظة/رقم/ادعاء يجب أن يحتوي على evidenceUrl يفتح الصفحة على العيب',
      weight: 1.0,
      enforcement: 'hard_block',
      check: this.checkNoHallucination.bind(this),
    });

    // Rule 2: Identity Law - Arabic luxury only
    this.rules.push({
      id: 'identity_law',
      name: 'قانون الهوية - عربي فاخر فقط',
      description: 'ممنوع إنجليزي وسط العربي، ممنوع مصطلحات رخيصة، مطلوب: ذهبي/أسود، خط GE_SS_Two، نبرة ملكية',
      weight: 1.0,
      enforcement: 'hard_block',
      check: this.checkIdentityLaw.bind(this),
    });

    // Rule 3: Human Approval Required for Publish
    this.rules.push({
      id: 'human_approval',
      name: 'موافقة بشرية للنشر',
      description: 'لا نشر بلا موافقة بشرية صريحة (approvedBy != null)',
      weight: 1.0,
      enforcement: 'hard_block',
      check: this.checkHumanApproval.bind(this),
    });

    // Rule 4: Scope Boundary - No touching other agents' domains
    this.rules.push({
      id: 'scope_boundary',
      name: 'حدود الاختصاص - لا تلمس مجالات تانية',
      description: 'قيّم الدار لا يلمس: API، سيرفر، مخزن، عملاء، أرباح، مفاتيح، تعلم وكلاء آخرين',
      weight: 1.0,
      enforcement: 'hard_block',
      check: this.checkScopeBoundary.bind(this),
    });

    // Rule 5: Evidence Coverage - Every finding must have URL
    this.rules.push({
      id: 'evidence_coverage',
      name: 'تغطية الأدلة - كل ملاحظة برابط',
      description: 'كل ملاحظة في التدقيق يجب أن تحتوي evidenceUrl يفتح الصفحة على العيب',
      weight: 1.0,
      enforcement: 'hard_block',
      check: this.checkEvidenceCoverage.bind(this),
    });

    // Rule 6: No Fabricated Numbers
    this.rules.push({
      id: 'no_fabricated_numbers',
      name: 'لا أرقام من الخيال',
      description: 'لا أرقام/إحصائيات/نسب من خيال الوكيل، كل رقم له مصدر قابل للتحقق',
      weight: 0.9,
      enforcement: 'hard_block',
      check: this.checkNoFabricatedNumbers.bind(this),
    });

    // Rule 7: Scope Declaration - Agent must declare out-of-scope
    this.rules.push({
      id: 'scope_declaration',
      name: 'إعلان خارج الاختصاص',
      description: 'إذا طُلب من الوكيل ما خارج اختصاصه، يجب أن يوجه للوكلاء المختصين صراحة',
      weight: 0.8,
      enforcement: 'soft_warn',
      check: this.checkScopeDeclaration.bind(this),
    });

    // Rule 8: Honest Limitation - Admit when can't do
    this.rules.push({
      id: 'honest_limitation',
      name: 'الاعتراف بالعجز بصراحة',
      description: 'إذا لم يستطع الوكيل التنفيذ: يقول "مش قادر على الصفحة دي" مش يخترع',
      weight: 0.8,
      enforcement: 'soft_warn',
      check: this.checkHonestLimitation.bind(this),
    });

    // Rule 9: Preview Accuracy - Preview matches published
    this.rules.push({
      id: 'preview_accuracy',
      name: 'دقة المعاينة - المعاينة = المنشور',
      description: 'ما في المعاينة يجب أن يكون مطابقاً تماماً لما ينشر على الموقع',
      weight: 1.0,
      enforcement: 'hard_block',
      check: this.checkPreviewAccuracy.bind(this),
    });

    // Rule 10: Version Traceability - Every change has version
    this.rules.push({
      id: 'version_traceability',
      name: 'تتبع النسخ - كل تغيير برقم نسخة',
      description: 'كل نشر/تراجع يجب أن يظهر رقم النسخة في الشات والسجل',
      weight: 0.9,
      enforcement: 'hard_block',
      check: this.checkVersionTraceability.bind(this),
    });
  }

  /**
   * Check all rules against input
   */
  async checkAll(input: ConstitutionCheckInput): Promise<ConstitutionReport> {
    const results = await Promise.all(
      this.rules.map(rule => rule.check(input))
    );

    const overallScore = results.reduce((sum, r) => sum + r.score * (this.rules.find(rule => rule.id === r.violations[0]?.ruleId || '')?.weight ?? 1), 0) / 
      this.rules.reduce((sum, r) => sum + r.weight, 0);

    const hardBlockViolations = results.flatMap(r => 
      r.violations.filter(v => {
        const rule = this.rules.find(rr => rr.id === v.ruleId);
        return rule?.enforcement === 'hard_block';
      })
    );

    const overallPassed = hardBlockViolations.length === 0;

    return {
      overallPassed,
      overallScore: Math.round(overallScore * 100) / 100,
      results,
      summary: this.generateSummary(overallPassed, overallScore, results),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Quick check for blocking violations only
   */
  async checkBlocking(input: ConstitutionCheckInput): Promise<{ passed: boolean; violations: ConstitutionViolation[] }> {
    const report = await this.checkAll(input);
    const blockingViolations = report.results.flatMap(r => 
      r.violations.filter(v => {
        const rule = this.rules.find(rr => rr.id === v.ruleId);
        return rule?.enforcement === 'hard_block';
      })
    );
    return {
      passed: blockingViolations.length === 0,
      violations: blockingViolations,
    };
  }

  // ============================================
  // Individual Rule Checks
  // ============================================

  private async checkNoHallucination(input: ConstitutionCheckInput): Promise<ConstitutionCheckResult> {
    const violations: ConstitutionViolation[] = [];
    const warnings: ConstitutionWarning[] = [];
    
    if (input.actionType === 'publish' || input.actionType === 'draft') {
      const content = input.proposedChanges || input.content;
      if (content) {
        const contentStr = JSON.stringify(content);
        // Check for claims without evidence URLs
        const hasEvidenceUrls = input.evidenceUrls && input.evidenceUrls.length > 0;
        const makesClaims = /\d+%|\d+\.\d+|\d+\s*(مليون|ألف|مئة|%|جنيه|ريال)/.test(contentStr);
        
        if (makesClaims && !hasEvidenceUrls) {
          violations.push({
            ruleId: 'no_hallucination',
            ruleName: 'لا وهم',
            severity: 'critical',
            message: 'محتوى يحتوي على أرقام/نسب بدون evidenceUrls',
            suggestedFix: 'أضف evidenceUrls لكل رقم/نسبة/ادعاء',
          });
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      warnings,
      score: violations.length === 0 ? 1 : 0,
    };
  }

  private async checkIdentityLaw(input: ConstitutionCheckInput): Promise<ConstitutionCheckResult> {
    const violations: ConstitutionViolation[] = [];
    const warnings: ConstitutionWarning[] = [];
    
    if (input.actionType === 'draft' || input.actionType === 'publish') {
      const content = input.proposedChanges || input.content;
      if (content) {
        const contentStr = JSON.stringify(content);
        
        // Check for English in Arabic content
        const englishInArabic = /[A-Za-z]{4,}/.test(contentStr) && /[\u0600-\u06FF]/.test(contentStr);
        if (englishInArabic) {
          violations.push({
            ruleId: 'identity_law',
            ruleName: 'قانون الهوية',
            severity: 'critical',
            message: 'نص عربي يحتوي على كلمات إنجليزية (ممنوع)',
            suggestedFix: 'استبدل الكلمات الإنجليزية بمقابلها العربي الفاخر',
          });
        }

        // Check for forbidden cheap marketing terms
        const cheapTerms = ['عرض', 'خصم', 'اشتري الآن', 'سعر', 'رخيص', 'صفقة', 'عرض محدود', 'تخفيض', 'وفر', 'مجاني'];
        const foundCheap = cheapTerms.filter(term => contentStr.includes(term));
        if (foundCheap.length > 0) {
          violations.push({
            ruleId: 'identity_law',
            ruleName: 'قانون الهوية',
            severity: 'critical',
            message: `مصطلحات تسويقية رخيصة ممنوعة: ${foundCheap.join('، ')}`,
            suggestedFix: 'استبدل بمصطلحات فاخرة: "اختر مساحتك بلمسة ملكية"، "صُنعت لتدوم"، "إطلالة لا تُضاهى"',
          });
        }

        // Check for luxury indicators
        const hasLuxuryIndicators = /ملكية|فاخر|ملكي|إطلالة|صُنعت|إتقان|أصالة|تراث|حرفية|ذهبي|أسود/.test(contentStr);
        if (!hasLuxuryIndicators && contentStr.length > 50) {
          warnings.push({
            ruleId: 'identity_law',
            ruleName: 'قانون الهوية',
            message: 'النص يفتقر لمصطلحات الفخامة المميزة لأزينث',
            location: 'المحتوى المقترح',
          });
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      warnings,
      score: violations.length === 0 ? 1 : 0,
    };
  }

  private async checkHumanApproval(input: ConstitutionCheckInput): Promise<ConstitutionCheckResult> {
    const violations: ConstitutionViolation[] = [];
    
    if (input.actionType === 'publish') {
      if (!input.humanApproval || !input.approvedBy) {
        violations.push({
          ruleId: 'human_approval',
          ruleName: 'موافقة بشرية للنشر',
          severity: 'critical',
          message: 'محاولة نشر بلا موافقة بشرية صريحة',
          suggestedFix: 'أضف approvedBy مع معرف المستخدم الذي وافق',
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      warnings: [],
      score: violations.length === 0 ? 1 : 0,
    };
  }

  private async checkScopeBoundary(input: ConstitutionCheckInput): Promise<ConstitutionCheckResult> {
    const violations: ConstitutionViolation[] = [];
    const content = input.proposedChanges || input.content;
    
    if (content) {
      const contentStr = JSON.stringify(content);
      
      // Forbidden domains for Qayyim
      const forbiddenDomains = [
        { pattern: /api[_\s]?key|secret[_\s]?key|password|token/i, domain: 'API/Keys' },
        { pattern: /backup|restore|snapshot/i, domain: 'Backup/Server' },
        { pattern: /manufactur|bom|inventory[_\s]?item|production[_\s]?job/i, domain: 'Manufacturing' },
        { pattern: /lead[_\s]?list|customer[_\s]?list|sales[_\s]?order|revenue|profit|margin/i, domain: 'Sales/Financial' },
        { pattern: /deploy|vercel|serverless|infrastructure/i, domain: 'Infrastructure/Deploy' },
        { pattern: /security[_\s]?audit|vulnerability|penetration/i, domain: 'Security' },
      ];

      for (const { pattern, domain } of forbiddenDomains) {
        if (pattern.test(contentStr)) {
          violations.push({
            ruleId: 'scope_boundary',
            ruleName: 'حدود الاختصاص',
            severity: 'critical',
            message: `محاولة الوصول لمجال محظور: ${domain}`,
            suggestedFix: `هذا المجال يخص وكيل مختص آخر. وجه الطلب للوكلاء: Coder/Ops/Security/Vanguard/Analyst`,
          });
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      warnings: [],
      score: violations.length === 0 ? 1 : 0,
    };
  }

  private async checkEvidenceCoverage(input: ConstitutionCheckInput): Promise<ConstitutionCheckResult> {
    const violations: ConstitutionViolation[] = [];
    
    if (input.actionType === 'audit' || input.actionType === 'draft') {
      const hasEvidenceUrls = input.evidenceUrls && input.evidenceUrls.length > 0;
      if (!hasEvidenceUrls) {
        violations.push({
          ruleId: 'evidence_coverage',
          ruleName: 'تغطية الأدلة',
          severity: 'critical',
          message: 'تدقيق/مسودة بلا evidenceUrls',
          suggestedFix: 'أضف evidenceUrl لكل ملاحظة/تغيير يشير للصفحة/السكشن المعني',
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      warnings: [],
      score: violations.length === 0 ? 1 : 0,
    };
  }

  private async checkNoFabricatedNumbers(input: ConstitutionCheckInput): Promise<ConstitutionCheckResult> {
    const violations: ConstitutionViolation[] = [];
    const warnings: ConstitutionWarning[] = [];
    
    const content = input.proposedChanges || input.content;
    if (content) {
      const contentStr = JSON.stringify(content);
      // Find percentage/number claims
      const numberClaims = contentStr.match(/\d+(?:\.\d+)?\s*[%٪]/g) || [];
      const currencyClaims = contentStr.match(/\d+(?:,\d{3})*(?:\.\d+)?\s*(?:جنيه|ريال|دولار|EGP|USD|SAR)/gi) || [];
      const allClaims = [...numberClaims, ...currencyClaims];
      
      if (allClaims.length > 0) {
        const hasEvidence = input.evidenceUrls && input.evidenceUrls.length > 0;
        if (!hasEvidence) {
          violations.push({
            ruleId: 'no_fabricated_numbers',
            ruleName: 'لا أرقام من الخيال',
            severity: 'critical',
            message: `أرقام/نسب/مبالغ مالية بدون مصدر: ${allClaims.slice(0, 5).join('، ')}`,
            suggestedFix: 'أضف evidenceUrl يشير لصفحة/تقرير يحتوي هذه الأرقام',
          });
        } else {
          warnings.push({
            ruleId: 'no_fabricated_numbers',
            ruleName: 'لا أرقام من الخيال',
            message: `تأكد أن evidenceUrls تدعم الأرقام: ${allClaims.join('، ')}`,
          });
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      warnings,
      score: violations.length === 0 ? 1 : 0,
    };
  }

  private async checkScopeDeclaration(input: ConstitutionCheckInput): Promise<ConstitutionCheckResult> {
    const violations: ConstitutionViolation[] = [];
    const warnings: ConstitutionWarning[] = [];
    
    // Check if agent is attempting out-of-scope action without delegation
    if (input.content) {
      const contentStr = JSON.stringify(input.content);
      const scopeViolations = [
        { pattern: /backup|restore/i, agent: 'Ops' },
        { pattern: /manufactur|bom/i, agent: 'Coder/Manufacturing' },
        { pattern: /lead|sales|revenue/i, agent: 'Vanguard/Analyst' },
        { pattern: /security|audit|vulnerability/i, agent: 'Security' },
        { pattern: /deploy|vercel|server/i, agent: 'Ops/Coder' },
        { pattern: /api|endpoint|code|bug/i, agent: 'Coder' },
      ];

      for (const { pattern, agent } of scopeViolations) {
        if (pattern.test(contentStr)) {
          warnings.push({
            ruleId: 'scope_declaration',
            ruleName: 'إعلان خارج الاختصاص',
            message: `الطلب متعلق بـ ${agent}. يجب توجيهه صراحة: "هذا خارج اختصاصي، يوجه لـ ${agent}"`,
            location: 'الطلب الموجه للوكيل',
          });
        }
      }
    }

    return {
      passed: true, // warnings don't fail
      violations,
      warnings,
      score: 1,
    };
  }

  private async checkHonestLimitation(input: ConstitutionCheckInput): Promise<ConstitutionCheckResult> {
    const warnings: ConstitutionWarning[] = [];
    
    // This is more of a behavioral check - hard to validate programmatically
    // But we can warn if response suggests overconfidence
    if (input.content) {
      const contentStr = JSON.stringify(input.content);
      const overconfidentPatterns = [
        /بالتأكيد|أكيد|مئة بالمئة|بلا شك|بلا تردد/i,
        /سأحل|سأصلح|سأفعل|سأنفذ.*كل.*شيء/i,
      ];

      for (const pattern of overconfidentPatterns) {
        if (pattern.test(contentStr)) {
          warnings.push({
            ruleId: 'honest_limitation',
            ruleName: 'الاعتراف بالعجز بصراحة',
            message: 'اللغة توحي بثقة مطلقة. تذكر: إذا لم تستطع قل "مش قادر على الصفحة دي"',
            location: 'رد الوكيل',
          });
        }
      }
    }

    return {
      passed: true,
      violations: [],
      warnings,
      score: 1,
    };
  }

  private async checkPreviewAccuracy(input: ConstitutionCheckInput): Promise<ConstitutionCheckResult> {
    const violations: ConstitutionViolation[] = [];
    
    if (input.actionType === 'publish' && input.proposedChanges) {
      // This would need integration with preview system
      // For now, we check if preview was done
      if (!input.content?.previewVerified) {
        violations.push({
          ruleId: 'preview_accuracy',
          ruleName: 'دقة المعاينة',
          severity: 'critical',
          message: 'نشر بدون التحقق من المعاينة',
          suggestedFix: 'تأكد من معاينة المسودة على /preview?draft=... قبل النشر',
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      warnings: [],
      score: violations.length === 0 ? 1 : 0,
    };
  }

  private async checkVersionTraceability(input: ConstitutionCheckInput): Promise<ConstitutionCheckResult> {
    const violations: ConstitutionViolation[] = [];
    
    if (input.actionType === 'publish') {
      if (!input.content?.versionNumber && !input.content?.draftId) {
        violations.push({
          ruleId: 'version_traceability',
          ruleName: 'تتبع النسخ',
          severity: 'critical',
          message: 'نشر/تراجع بلا رقم نسخة أو معرف مسودة',
          suggestedFix: 'أضف versionNumber أو draftId للمسودة',
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      warnings: [],
      score: violations.length === 0 ? 1 : 0,
    };
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(passed: boolean, score: number, results: ConstitutionCheckResult[]): string {
    const violationCount = results.reduce((sum, r) => sum + r.violations.length, 0);
    const warningCount = results.reduce((sum, r) => sum + r.warnings.length, 0);
    
    if (passed) {
      return `✅ دستوري 100% - درجة ${Math.round(score * 100)}% - ${warningCount} تحذيرات`;
    } else {
      return `❌ مخالفات دستورية: ${violationCount} مخالفة حاسمة، ${warningCount} تحذيرات - درجة ${Math.round(score * 100)}%`;
    }
  }

  /**
   * Get all rules for inspection
   */
  getRules(): ConstitutionRule[] {
    return this.rules;
  }

  /**
   * Add custom rule
   */
  addRule(rule: ConstitutionRule) {
    this.rules.push(rule);
  }
}

export const constitutionEngine = new ConstitutionEngine();
