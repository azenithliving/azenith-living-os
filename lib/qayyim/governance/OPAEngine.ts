/**
 * OPAEngine - Open Policy Agent integration for Qayyim Swarm
 * Runs Rego policies for real-time policy enforcement
 * Falls back to TypeScript logic if OPA not available
 */

import { ConstitutionEngine, ConstitutionCheckInput, ConstitutionCheckResult, ConstitutionViolation, ConstitutionWarning } from "./ConstitutionEngine";

export interface OPAInput {
  agent_key: string;
  action: string;
  resource: {
    type: string;
    id?: string;
    data?: any;
  };
  context: {
    user_id?: string;
    company_id?: string;
    session_id?: string;
    evidence_urls?: string[];
    approved_by?: string;
    human_approval?: boolean;
  };
  timestamp: string;
}

export interface OPADecision {
  allow: boolean;
  violations: OPAViolation[];
  warnings: OPAWarning[];
  metadata: {
    rules_evaluated: string[];
    decision_id: string;
    timestamp: string;
  };
}

export interface OPAViolation {
  rule_id: string;
  rule_name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  path: string[];
  details?: any;
}

export interface OPAWarning {
  rule_id: string;
  rule_name: string;
  message: string;
  path: string[];
}

export interface RegoPolicy {
  id: string;
  name: string;
  rego: string;
  enabled: boolean;
}

export class OPAEngine {
  private constitutionEngine: ConstitutionEngine;
  private policies: Map<string, RegoPolicy> = new Map();
  private opaAvailable: boolean = false;
  private wasmModule: any = null;

  constructor() {
    this.constitutionEngine = new ConstitutionEngine();
    this.initializePolicies();
    this.checkOPAAvailability();
  }

  /**
   * Initialize built-in Rego policies
   */
  private initializePolicies() {
    // Policy 1: Qayyim Scope Enforcement
    this.policies.set('qayyim_scope', {
      id: 'qayyim_scope',
      name: 'Qayyim Scope Enforcement',
      enabled: true,
      rego: `package qayyim.scope

# Forbidden domains for Qayyim agents
forbidden_domains := {
    "api_keys",
    "backup_operations", 
    "manufacturing_bom",
    "manufacturing_inventory",
    "manufacturing_jobs",
    "sales_orders",
    "customer_leads",
    "revenue_analysis",
    "profit_margins",
    "deployment_vercel",
    "server_management",
    "security_audits",
    "vulnerability_scans",
    "api_endpoints",
    "code_changes",
    "bug_fixes"
}

# Check if action attempts forbidden domain
violations[domain] {
    input.action_data := json.unmarshal(input.action)  # if action is JSON string
    
    # Check action field
    domain := forbidden_domains[_]
    contains(input.action, domain)
}

violations[domain] {
    domain := forbidden_domains[_]
    contains(input.resource.type, domain)
}

violations[domain] {
    domain := forbidden_domains[_]
    contains(input.resource.data, domain)
}

# Allow if agent is qayyim-core and action is coordination
allow {
    input.agent_key == "qayyim-core"
    input.action in ["coordinate", "audit_full_site", "quality_gate"]
}

# Allow if agent is qayyim-cont and action is content-related
allow {
    input.agent_key == "qayyim-cont"
    input.action in ["draft_copy", "unify_tone", "identity_check", "arabic_polish", "copy_review"]
}

# Allow if agent is qayyim-vis and action is visual-related
allow {
    input.agent_key == "qayyim-vis"
    input.action in ["curate_gallery", "select_hero_image", "generate_alt_text", "brand_consistency_check", "image_optimization", "gallery_sequencing"]
}

# Allow if agent is qayyim-seo and action is seo-related
allow {
    input.agent_key == "qayyim-seo"
    input.action in ["audit_seo", "fix_seo", "generate_schema", "content_gap", "keyword_research"]
}

# Allow if agent is qayyim-ux and action is ux-related
allow {
    input.agent_key == "qayyim-ux"
    input.action in ["analyze_behavior", "design_ab_test", "create_goal", "exit_rate_report"]
}

# Allow if agent is qayyim-ana and action is analytics-related
allow {
    input.agent_key == "qayyim-ana"
    input.action in ["revenue_correlation", "predict_impact", "luxury_score", "segment_luxury_buyers", "weekly_report"]
}

# Allow if agent is qayyim-dev and action is dev-related
allow {
    input.agent_key == "qayyim-dev"
    input.action in ["code_review", "bundle_analysis", "dependency_audit", "performance_budgets", "security_code_scan"]
}

# Allow if agent is qayyim-qa and action is qa-related
allow {
    input.agent_key == "qayyim-qa"
    input.action in ["full_qa_suite", "e2e_smoke", "visual_regression", "accessibility_audit", "load_test", "security_scan", "cross_browser"]
}

# Default deny
default allow = false

# Decision output
decision = {
    "allow": allow,
    "violations": violations,
    "warnings": warnings
}

warnings = [w | w := sprintf("Agent %s attempting %s", [input.agent_key, input.action]); not allow]`,
    });

    // Policy 2: Human Approval for Publish
    this.policies.set('human_approval', {
      id: 'human_approval',
      name: 'Human Approval Required for Publish',
      enabled: true,
      rego: `package qayyim.approval

# Publish actions require human approval
publish_actions := ["publish", "publish_draft", "deploy", "deploy_trigger"]

requires_approval {
    input.action in publish_actions
}

# Approval must be explicit
approval_valid {
    requires_approval
    input.context.human_approval == true
    input.context.approved_by != ""
}

# Violation if approval required but not valid
violations["human_approval_required"] {
    requires_approval
    not approval_valid
}

warnings["approval_missing"] {
    requires_approval
    not approval_valid
}

decision = {
    "allow": not requires_approval or approval_valid,
    "violations": violations,
    "warnings": warnings
}`,
    });

    // Policy 3: Evidence Coverage
    this.policies.set('evidence_coverage', {
      id: 'evidence_coverage',
      name: 'Evidence Coverage for Audit/Draft',
      enabled: true,
      rego: `package qayyim.evidence

# Audit and draft actions require evidence URLs
evidence_required_actions := ["audit", "draft", "audit_full_site", "draft_copy", "brand_consistency_check"]

evidence_required {
    input.action in evidence_required_actions
}

evidence_provided {
    evidence_required
    input.context.evidence_urls
    count(input.context.evidence_urls) > 0
}

violations["evidence_missing"] {
    evidence_required
    not evidence_provided
}

warnings["low_evidence"] {
    evidence_provided
    count(input.context.evidence_urls) < 2
}

decision = {
    "allow": not evidence_required or evidence_provided,
    "violations": violations,
    "warnings": warnings
}`,
    });

    // Policy 4: Identity Law Compliance
    this.policies.set('identity_law', {
      id: 'identity_law',
      name: 'Identity Law Compliance',
      enabled: true,
      rego: `package qayyim.identity

# Forbidden terms in Arabic luxury content
forbidden_terms := [
    "عرض", "خصم", "اشتري الآن", "سعر", "رخيص", 
    "صفقة", "عرض محدود", "تخفيض", "وفر", "مجاني",
    "buy now", "discount", "sale", "cheap", "deal",
    "limited offer", "save", "free"
]

# Check for English in Arabic content
contains_english(text) {
    contains_arabic(text)
    regex.match("[A-Za-z]{4,}", text)
}

contains_arabic(text) {
    regex.match("[\\u0600-\\u06FF]", text)
}

# Check for cheap marketing terms
cheap_term_found(term) {
    input.resource.data := input.resource.data
    content_str := json.marshal(input.resource.data)
    regex.match(term, content_str)
}

cheap_terms_detected[term] {
    term := forbidden_terms[_]
    cheap_term_found(term)
}

violations["arabic_english_mix"] {
    input.resource.data
    content_str := json.marshal(input.resource.data)
    contains_arabic(content_str)
    contains_english(content_str)
}

violations["cheap_marketing"] {
    cheap_terms_detected[_]
}

decision = {
    "allow": count(violations) == 0,
    "violations": violations,
    "warnings": warnings
}

warnings = [w | w := sprintf("Identity check: %s", [v]); v := violations[_]]`,
    });

    // Policy 5: Version Traceability
    this.policies.set('version_traceability', {
      id: 'version_traceability',
      name: 'Version Traceability for Publish/Rollback',
      enabled: true,
      rego: `package qayyim.version

# Publish and rollback require version tracking
version_actions := ["publish", "publish_draft", "rollback", "rollback_draft"]

version_required {
    input.action in version_actions
}

version_provided {
    version_required
    input.context.version_number
    input.context.version_number > 0
}

draft_id_provided {
    version_required
    input.context.draft_id
    input.context.draft_id != ""
}

version_or_draft_provided {
    version_provided
}

version_or_draft_provided {
    draft_id_provided
}

violations["version_missing"] {
    input.action in version_actions
    not version_or_draft_provided
}

decision = {
    "allow": not input.action in version_actions or version_or_draft_provided,
    "violations": violations,
    "warnings": warnings
}

warnings = [w | w := "Version tracking recommended for audit trail"; input.action in version_actions]`,
    });
  }

  /**
   * Check if OPA WASM is available
   * Disabled: package not installed, using TypeScript fallback only
   */
  private async checkOPAAvailability() {
    // OPA WASM is optional and not installed (zero-cost constraint)
    // ConstitutionEngine (TypeScript) handles all policy checks
    this.opaAvailable = false;
    console.log('[OPAEngine] Using TypeScript fallback (OPA WASM not installed)');
  }

  /**
   * Evaluate policies against input
   */
  async evaluate(input: OPAInput): Promise<OPADecision> {
    // First run Constitution Engine (TypeScript - always available)
    const constitutionInput = {
      agentKey: input.agent_key,
      actionType: input.action as any,
      content: input.resource.data,
      proposedChanges: input.resource.data,
      targetPage: input.resource.id,
      evidenceUrls: input.context.evidence_urls,
      humanApproval: input.context.human_approval,
      approvedBy: input.context.approved_by,
    };

    const constitutionReport = await this.constitutionEngine.checkAll(constitutionInput);

    // Convert ConstitutionEngine results to OPA format
    const violations: OPADecision['violations'] = constitutionReport.results.flatMap(r => 
      r.violations.map(v => ({
        rule_id: v.ruleId,
        rule_name: v.ruleName,
        severity: v.severity,
        message: v.message,
        path: v.location ? [v.location] : ['content'],
        details: { suggestedFix: v.suggestedFix },
      }))
    );

    const warnings: OPADecision['warnings'] = constitutionReport.results.flatMap(r => 
      r.warnings.map(w => ({
        rule_id: w.ruleId,
        rule_name: w.ruleName,
        message: w.message,
        path: w.location ? [w.location] : ['content'],
      }))
    );

    // If OPA WASM is available, also run Rego policies
    let regoViolations: OPADecision['violations'] = [];
    let regoWarnings: OPADecision['warnings'] = [];

    if (this.opaAvailable && this.wasmModule) {
      try {
        const regoResult = await this.evaluateRego(input);
        regoViolations = regoResult.violations;
        regoWarnings = regoResult.warnings;
      } catch (e) {
        console.warn('[OPAEngine] Rego evaluation failed, using ConstitutionEngine only:', e);
      }
    }

    // Merge results
    const allViolations = [...violations, ...regoViolations];
    const allWarnings = [...warnings, ...regoWarnings];

    const allow = allViolations.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0;

    return {
      allow,
      violations: allViolations,
      warnings: allWarnings,
      metadata: {
        rules_evaluated: ['constitution_engine', ...(this.opaAvailable ? Array.from(this.policies.keys()) : [])],
        decision_id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Evaluate Rego policies (when OPA WASM available)
   * Currently disabled - returns empty, ConstitutionEngine is primary
   */
  private async evaluateRego(input: OPAInput): Promise<{ violations: OPADecision['violations']; warnings: OPADecision['warnings'] }> {
    // OPA WASM not installed - skip Rego evaluation
    // All policies are evaluated via ConstitutionEngine (TypeScript)
    if (true) {
      return { violations: [], warnings: [] };
    }
    if (!this.wasmModule) {
      // @ts-ignore - optional dependency placeholder
      const opaWasm: any = null;
      this.wasmModule = await opaWasm?.default?.();
    }

    const violations: OPADecision['violations'] = [];
    const warnings: OPADecision['warnings'] = [];

    for (const [id, policy] of this.policies) {
      if (!policy.enabled) continue;

      try {
        // Compile and evaluate policy
        const module = await this.wasmModule.compile({
          entrypoints: ['qayyim/scope', 'qayyim/approval', 'qayyim/evidence', 'qayyim/identity', 'qayyim/version'],
          modules: {
            [id]: policy.rego,
          },
        });

        const instance = await module.instantiate();
        const result = await instance.evaluate(input);

        if (result.result?.allow === false) {
          violations.push(...(result.result.violations || []));
        }
        warnings.push(...(result.result.warnings || []));
      } catch (e) {
        console.warn(`[OPAEngine] Policy ${id} evaluation failed:`, e);
      }
    }

    return { violations, warnings };
  }

  /**
   * Quick check for blocking violations only
   */
  async checkBlocking(input: OPAInput): Promise<{ passed: boolean; violations: OPADecision['violations'] }> {
    const decision = await this.evaluate(input);
    const blockingViolations = decision.violations.filter(v => 
      v.severity === 'critical' || v.severity === 'high'
    );
    return {
      passed: blockingViolations.length === 0,
      violations: blockingViolations,
    };
  }

  /**
   * Evaluate single policy
   */
  async evaluatePolicy(policyId: string, input: OPAInput): Promise<OPADecision> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy ${policyId} not found`);
    }

    // For now, delegate to full evaluation
    // In production, could optimize to run only specific policy
    return this.evaluate(input);
  }

  /**
   * Add custom Rego policy
   */
  addPolicy(policy: RegoPolicy) {
    this.policies.set(policy.id, policy);
  }

  /**
   * Get all policies
   */
  getPolicies(): RegoPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Enable/disable policy
   */
  setPolicyEnabled(policyId: string, enabled: boolean) {
    const policy = this.policies.get(policyId);
    if (policy) {
      policy.enabled = enabled;
    }
  }

  /**
   * Get Constitution Engine for direct access
   */
  getConstitutionEngine(): ConstitutionEngine {
    return this.constitutionEngine;
  }
}

export const opaEngine = new OPAEngine();