package qayyim

# Qayyim Swarm Rego Policies
# Open Policy Agent policies for constitutional enforcement
# Used by OPAEngine for real-time policy evaluation

# Default deny
default allow = false

# Allow if all hard block rules pass
allow {
    not hard_block_violation
}

# Hard block violations
hard_block_violation {
    some rule in data.rules
    rule.enforcement == "hard_block"
    violation := check_rule(rule, input)
    violation == true
}

# Check individual rule
check_rule(rule, input) {
    rule.id == "no_hallucination"
    check_no_hallucination(input)
}

check_rule(rule, input) {
    rule.id == "identity_law"
    check_identity_law(input)
}

check_rule(rule, input) {
    rule.id == "human_approval"
    check_human_approval(input)
}

check_rule(rule, input) {
    rule.id == "scope_boundary"
    check_scope_boundary(input)
}

check_rule(rule, input) {
    rule.id == "evidence_coverage"
    check_evidence_coverage(input)
}

check_rule(rule, input) {
    rule.id == "no_fabricated_numbers"
    check_no_fabricated_numbers(input)
}

check_rule(rule, input) {
    rule.id == "preview_accuracy"
    check_preview_accuracy(input)
}

check_rule(rule, input) {
    rule.id == "version_traceability"
    check_version_traceability(input)
}

# Soft warnings (don't block but flag)
warnings := [warning |
    some rule in data.rules
    rule.enforcement == "soft_warn"
    warning := check_soft_rule(rule, input)
    warning != ""
]

check_soft_rule(rule, input) := warning {
    rule.id == "scope_declaration"
    warning := check_scope_declaration(input)
}

check_soft_rule(rule, input) := warning {
    rule.id == "honest_limitation"
    warning := check_honest_limitation(input)
}

# ============================================
# Rule Implementations
# ============================================

# 1. No Hallucination - Claims must have evidence URLs
check_no_hallucination(input) {
    input.action in {"publish", "draft"}
    content := input.resource.data
    has_numbers := contains_numbers(content)
    has_evidence := count(input.context.evidence_urls) > 0
    has_numbers and not has_evidence
}

contains_numbers(content) {
    content_str := sprintf("%v", [content])
    regex.match(".*\\d+.*[%٪].*", content_str)
}

contains_numbers(content) {
    content_str := sprintf("%v", [content])
    regex.match(".*\\d+(,\\d{3})*(\\.\\d+)?\\s*(جنيه|ريال|دولار|EGP|USD|SAR).*", content_str)
}

# 2. Identity Law - Arabic luxury only
check_identity_law(input) {
    input.action in {"draft", "publish"}
    content := input.resource.data
    content_str := sprintf("%v", [content])
    
    # English in Arabic content
    has_english_in_arabic := regex.match(".*[A-Za-z]{4,}.*", content_str) and regex.match(".*[\\u0600-\\u06FF].*", content_str)
    
    # Forbidden cheap terms
    forbidden_terms := ["عرض", "خصم", "اشتري الآن", "سعر", "رخيص", "صفقة", "عرض محدود", "تخفيض", "وفر", "مجاني"]
    found_forbidden := [term | term := forbidden_terms[_]; regex.match(sprintf(".*%s.*", [term]), content_str)]
    count(found_forbidden) > 0
    
    # Missing luxury indicators for content > 50 chars
    missing_luxury := not regex_match_luxury(content_str)
    length(content_str) > 50 and missing_luxury
    
    has_english_in_arabic or count(found_forbidden) > 0 or (length(content_str) > 50 and missing_luxury)
}

regex_match_luxury(content) {
    luxury_terms := ["ملكية", "فاخر", "ملكي", "إطلالة", "صُنعت", "إتقان", "أصالة", "تراث", "حرفية", "ذهبي", "أسود"]
    some term in luxury_terms
    regex.match(sprintf(".*%s.*", [term]), content)
}

# 3. Human Approval Required for Publish
check_human_approval(input) {
    input.action == "publish"
    not input.context.human_approval
    not input.context.approved_by
}

# 4. Scope Boundary - No touching forbidden domains
check_scope_boundary(input) {
    content := input.resource.data
    content_str := sprintf("%v", [content])
    
    forbidden_domains := [
        {"pattern": "api[_\s]?key|secret[_\s]?key|password|token", "domain": "API/Keys"},
        {"pattern": "backup|restore|snapshot", "domain": "Backup/Server"},
        {"pattern": "manufactur|bom|inventory[_\s]?item|production[_\s]?job", "domain": "Manufacturing"},
        {"pattern": "lead[_\s]?list|customer[_\s]?list|sales[_\s]?order|revenue|profit|margin", "domain": "Sales/Financial"},
        {"pattern": "deploy|vercel|serverless|infrastructure", "domain": "Infrastructure/Deploy"},
        {"pattern": "security[_\s]?audit|vulnerability|penetration", "domain": "Security"},
    ]
    
    some fd in forbidden_domains
    regex.match(fd.pattern, content_str)
}

# 5. Evidence Coverage
check_evidence_coverage(input) {
    input.action in {"audit", "draft"}
    count(input.context.evidence_urls) == 0
}

# 6. No Fabricated Numbers
check_no_fabricated_numbers(input) {
    content := input.resource.data
    content_str := sprintf("%v", [content])
    
    percentage_claims := regex.findall("\\d+(?:\\.\\d+)?\\s*[%٪]", content_str)
    currency_claims := regex.findall("\\d+(?:,\\d{3})*(?:\\.\\d+)?\\s*(?:جنيه|ريال|دولار|EGP|USD|SAR)", content_str)
    all_claims := concat(percentage_claims, currency_claims)
    
    count(all_claims) > 0
    count(input.context.evidence_urls) == 0
}

# 7. Preview Accuracy
check_preview_accuracy(input) {
    input.action == "publish"
    not input.content.preview_verified
}

# 8. Version Traceability
check_version_traceability(input) {
    input.action in {"publish", "rollback"}
    not input.content.version_number
    not input.content.draft_id
}

# Soft Rules

# Scope Declaration
check_scope_declaration(input) := warning {
    content := input.resource.data
    content_str := sprintf("%v", [content])
    
    scope_violations := [
        {"pattern": "backup|restore", "agent": "Ops"},
        {"pattern": "manufactur|bom", "agent": "Coder/Manufacturing"},
        {"pattern": "lead|sales|revenue", "agent": "Vanguard/Analyst"},
        {"pattern": "security|audit|vulnerability", "agent": "Security"},
        {"pattern": "deploy|vercel|server", "agent": "Ops/Coder"},
        {"pattern": "api|endpoint|code|bug", "agent": "Coder"},
    ]
    
    some sv in scope_violations
    regex.match(sv.pattern, content_str)
    warning := sprintf("الطلب متعلق بـ %s. يجب توجيهه صراحة: \"هذا خارج اختصاصي، يوجه لـ %s\"", [sv.agent, sv.agent])
}

# Honest Limitation
check_honest_limitation(input) := warning {
    content := input.resource.data
    content_str := sprintf("%v", [content])
    
    overconfident_patterns := [
        "بالتأكيد|أكيد|مئة بالمئة|بلا شك|بلا تردد",
        "سأحل|سأصلح|سأفعل|سأنفذ.*كل.*شيء",
    ]
    
    some pattern in overconfident_patterns
    regex.match(pattern, content_str)
    warning := "اللغة توحي بثقة مطلقة. تذكر: إذا لم تستطع قل \"مش قادر على الصفحة دي\""
}

# ============================================
# Data Definitions (from constitution.yaml)
# ============================================

data.rules = [
    {"id": "no_hallucination", "enforcement": "hard_block"},
    {"id": "identity_law", "enforcement": "hard_block"},
    {"id": "human_approval", "enforcement": "hard_block"},
    {"id": "scope_boundary", "enforcement": "hard_block"},
    {"id": "evidence_coverage", "enforcement": "hard_block"},
    {"id": "no_fabricated_numbers", "enforcement": "hard_block"},
    {"id": "preview_accuracy", "enforcement": "hard_block"},
    {"id": "version_traceability", "enforcement": "hard_block"},
    {"id": "scope_declaration", "enforcement": "soft_warn"},
    {"id": "honest_limitation", "enforcement": "soft_warn"},
]

# Agent scope data
data.agent_scopes = {
    "qayyim-core": ["site_audit", "swarm_coordination", "publish_management", "rollback_management", "quality_gate"],
    "qayyim-cont": ["luxury_copywriting", "tone_unification", "identity_enforcement", "arabic_polishing"],
    "qayyim-vis": ["image_curation", "hero_selection", "alt_text_generation", "brand_consistency_check"],
    "qayyim-seo": ["technical_seo_audit", "schema_generation", "content_gap_analysis", "competitor_research"],
    "qayyim-ux": ["telemetry_analysis", "conversion_funnel", "ab_test_design", "exit_rate_analysis"],
    "qayyim-ana": ["revenue_correlation", "predictive_modeling", "customer_segmentation", "luxury_score"],
    "qayyim-dev": ["code_review", "bundle_analysis", "dependency_audit", "type_safety_check"],
    "qayyim-qa": ["e2e_testing", "visual_regression", "accessibility_audit", "load_testing"],
}

# Forbidden domains per agent
data.forbidden_domains = {
    "qayyim-core": ["backup", "manufacturing", "sales", "financial", "deploy", "security", "agent_learning"],
    "qayyim-cont": ["images", "seo", "speed", "revenue"],
    "qayyim-vis": ["content", "seo", "revenue"],
    "qayyim-seo": ["content", "images", "revenue"],
    "qayyim-ux": ["content", "images", "seo"],
    "qayyim-ana": ["content", "images", "seo", "deploy"],
    "qayyim-dev": ["content", "deploy", "project_evolve"],
    "qayyim-qa": ["content", "deploy", "project_evolve"],
}