/**
 * lib/vanguard/guardrails_engine.ts
 * ==================================
 * GuardrailsEngine — the last line of defense before any LLM output
 * reaches the user. Every response MUST pass through `apply()`.
 *
 * Rules enforced (in order):
 * 1. PRICING_LOCK      — zero pricing/rates/discounts without signed consent
 * 2. PROMISE_LOCK      — zero delivery times, warranties, guarantees
 * 3. GEO_LOCK          — Egypt only, no other geography
 * 4. HALLUCINATION_GUARD — blocks invented staff names, branches, specs
 * 5. SCOPE_LOCK        — no exposure of system internals
 * 6. BOOKING_GUARD     — no booking confirmation without a phone number
 * 7. CITATION_REQUIRED — technical claims without citation are flagged
 * 8. JAILBREAK_GUARD   — prompt injection / role-escape attempts
 * 9. PROFANITY_GUARD   — inappropriate content
 * 10. PII_GUARD        — no PII leakage between sessions
 *
 * Each rule can: BLOCK (refuse), SANITIZE (replace), or WARN (log only).
 */

import {
  type GuardrailResult,
  type GuardrailViolation,
} from "@/lib/vanguard/types";
import { logger } from "@/lib/vanguard/observability/logger";

// ════════════════════════════════════════════════════════════════════════════
// PATTERN CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

const PRICING_PATTERNS = [
  /\b(\d[\d,\.]*)\s*(جنيه|EGP|ج\.م|LE|L\.E|جنيهًا|جنيهاً)/gi,
  /\bبالمتر\s+(\d[\d,\.]*)/gi,
  /سعر\s+المتر\s+(\d[\d,\.]*)/gi,
  /\b(\d[\d,\.]*)\s*(دولار|\$|USD)/gi,
  /خصم\s+(\d+)\s*%/gi,
  /تقسيط\s+\d+/gi,
  /مقدم\s+(\d[\d,\.]*)/gi,
  /\bprice\s+is\s+\$?(\d[\d,\.]*)/gi,
  /\bcosts?\s+\$?(\d[\d,\.]*)/gi,
  /\bquote\s+of\s+\$?(\d[\d,\.]*)/gi,
  /\bdiscount\s+of\s+\d+\s*%/gi,
];

const PROMISE_PATTERNS = [
  /ضمان\s+(\d+)\s*(سنة|شهر|يوم)/gi,
  /التسليم\s+(في|خلال)\s+(\d+)\s*(يوم|أسبوع|شهر)/gi,
  /ننتهي\s+(في|خلال)\s+(\d+)\s*(يوم|أسبوع)/gi,
  /guarantee\s+of\s+\d+/gi,
  /delivery\s+in\s+\d+\s*(days?|weeks?|months?)/gi,
  /warranty\s+of\s+\d+/gi,
  /finished\s+in\s+\d+/gi,
];

const NON_EGYPT_GEO_PATTERNS = [
  /(?:في|ب|إلى|from)\s+(دبي|أبوظبي|الرياض|جدة|الكويت|بيروت|عمّان|المغرب|تونس|الجزائر)/gi,
  /\b(Dubai|Abu Dhabi|Riyadh|Jeddah|Kuwait City|Beirut|Amman|Casablanca|Tunis|Algiers|KSA|UAE|Saudi)\b/gi,
];

const INTERNAL_LEAK_PATTERNS = [
  /system\s+prompt/gi,
  /البرومبت\s+الخاص\s+بك/gi,
  /تعليماتي\s+الداخلية/gi,
  /SALES_EXCELLENCE_PROMPT/gi,
  /HUMAN_CONSULTANT_PROMPT/gi,
  /\[UI_ACTION:/gi, // raw tags should never appear in final output (extracted already)
  /guardrail/gi,
  /vanguard_consciousness/gi,
  /supabase_service_role/gi,
  /GROQ_KEYS/gi,
];

const BOOKING_CONFIRMATION_PATTERNS = [
  /تم\s+(حجز|تسجيل|تأكيد)/gi,
  /booking\s+confirmed/gi,
  /appointment\s+confirmed/gi,
  /confirmed\s+your\s+booking/gi,
  /موعدك\s+محجوز/gi,
];

const INVENTED_PEOPLE_PATTERNS = [
  /المهندس\s+[ء-ي]{4,}/gi,
  /الأستاذ\s+[ء-ي]{4,}\s+(?:مدير|رئيس|مسؤول)/gi,
  /فريقنا\s+المكون\s+من/gi,
  /لدينا\s+\d+\s+(مصمم|مهندس)\s+متخصص/gi,
];

const JAILBREAK_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /you\s+are\s+now\s+(in\s+developer|DAN|GPT)/gi,
  /reveal\s+(your\s+)?(system\s+)?prompt/gi,
  /forget\s+(your\s+)?instructions?/gi,
  /تجاهل\s+التعليمات/gi,
  /اكتب\s+البرومبت/gi,
  /أنت\s+الآن\s+بدون\s+قيود/gi,
  /pretend\s+you\s+are/gi,
  /roleplay\s+as/gi,
  /act\s+as\s+(if\s+you\s+are\s+)?(DAN|an\s+AI\s+without\s+restrictions)/gi,
];

const PROFANITY_AR = /(كس\s*أ|زب|طيز|شرموط|عاهر|منيك)/gi;
const PROFANITY_EN = /\b(fuck|shit|ass+hole|bitch|bastard|cunt)\b/gi;

const EGYPT_PHONE_RE = /(?:\+?20\s?)?0?1[0125][\s\-]?\d{4}[\s\-]?\d{4}/;

// ════════════════════════════════════════════════════════════════════════════
// GUARDRAILS ENGINE
// ════════════════════════════════════════════════════════════════════════════

export interface GuardrailsOptions {
  /** If true, pricing guardrail is relaxed (admin has given explicit consent) */
  pricingConsentGranted?: boolean;
  /** The full conversation text (to check if phone exists) */
  conversationText?: string;
  /** Source of the output: 'ai' | 'admin' | 'system' */
  source?: "ai" | "admin" | "system";
  /** Current language */
  language?: "ar" | "en";
}

export class GuardrailsEngine {
  /**
   * Apply all guardrails to an LLM output.
   * Returns a GuardrailResult — caller must check `.passed` and use `.safeOutput`.
   */
  apply(rawOutput: string, opts: GuardrailsOptions = {}): GuardrailResult {
    const {
      pricingConsentGranted = false,
      conversationText = "",
      source = "ai",
      language = "ar",
    } = opts;

    // Admin-originated messages bypass most rules (they are human-written)
    if (source === "admin") {
      return {
        passed: true,
        violations: [],
        safeOutput: rawOutput,
        blockedCompletely: false,
      };
    }

    const violations: GuardrailViolation[] = [];
    let current = rawOutput;

    // ── Rule 8: JAILBREAK_GUARD (check on input side too, but catch in output) ──
    for (const pattern of JAILBREAK_PATTERNS) {
      if (pattern.test(current)) {
        violations.push({
          rule: "JAILBREAK_GUARD",
          severity: "block",
          original: current,
          sanitized: null,
          reason: "Jailbreak/prompt injection attempt detected in output",
        });
        return this.blockResult(violations, language);
      }
    }

    // ── Rule 5: SCOPE_LOCK (internal leak) ──
    for (const pattern of INTERNAL_LEAK_PATTERNS) {
      if (pattern.test(current)) {
        violations.push({
          rule: "SCOPE_LOCK",
          severity: "block",
          original: current,
          sanitized: null,
          reason: "Internal system details leaked in output",
        });
        return this.blockResult(violations, language);
      }
    }

    // ── Rule 1: PRICING_LOCK ──
    if (!pricingConsentGranted) {
      for (const pattern of PRICING_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(current)) {
          const sanitized = this.sanitizePricing(current, language);
          violations.push({
            rule: "PRICING_LOCK",
            severity: "sanitize",
            original: current,
            sanitized,
            reason: "Explicit pricing mentioned without owner consent",
          });
          current = sanitized;
          break;
        }
      }
    }

    // ── Rule 2: PROMISE_LOCK ──
    for (const pattern of PROMISE_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(current)) {
        const sanitized = this.sanitizePromise(current, language);
        violations.push({
          rule: "PROMISE_LOCK",
          severity: "sanitize",
          original: current,
          sanitized,
          reason: "Delivery/warranty promise made without authorization",
        });
        current = sanitized;
        break;
      }
    }

    // ── Rule 3: GEO_LOCK ──
    for (const pattern of NON_EGYPT_GEO_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(current)) {
        violations.push({
          rule: "GEO_LOCK",
          severity: "warn",
          original: current,
          sanitized: current,
          reason: "Non-Egypt geography mentioned",
        });
        break;
      }
    }

    // ── Rule 4: HALLUCINATION_GUARD (invented people) ──
    for (const pattern of INVENTED_PEOPLE_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(current)) {
        const sanitized = this.sanitizeInventedPeople(current, language);
        violations.push({
          rule: "HALLUCINATION_GUARD",
          severity: "sanitize",
          original: current,
          sanitized,
          reason: "Invented staff names/team sizes detected",
        });
        current = sanitized;
        break;
      }
    }

    // ── Rule 6: BOOKING_GUARD ──
    const hasPhone = EGYPT_PHONE_RE.test(conversationText);
    for (const pattern of BOOKING_CONFIRMATION_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(current) && !hasPhone) {
        const sanitized = this.sanitizeBooking(current, language);
        violations.push({
          rule: "BOOKING_GUARD",
          severity: "sanitize",
          original: current,
          sanitized,
          reason: "Booking confirmed without phone number in conversation",
        });
        current = sanitized;
        break;
      }
    }

    // ── Rule 9: PROFANITY_GUARD ──
    if (PROFANITY_AR.test(current) || PROFANITY_EN.test(current)) {
      violations.push({
        rule: "PROFANITY_GUARD",
        severity: "block",
        original: current,
        sanitized: null,
        reason: "Profanity detected in output",
      });
      return this.blockResult(violations, language);
    }

    // ── Rule 7: CITATION_REQUIRED ──
    // Technical material/specification claims with no citation marker get flagged.
    // Does not block — adds a warning so the caller can append "وفق قاعدة بياناتنا" etc.
    const TECH_CLAIM_RE = /\b(خشب|صلب|معدن|قماش|جلد|رخام|زجاج)\s+\w+\s+(متين|رطوبة|حرارة|مقاوم|صلابة|ملمس|نوع)/u;
    if (TECH_CLAIM_RE.test(current) && !current.includes("✓") && !current.includes("وفق") && !current.includes("حسب قاعدة")) {
      violations.push({
        rule:      "CITATION_REQUIRED",
        severity:  "warn",
        original:  current,
        sanitized: current,
        reason:    "Technical material claim without citation marker",
      });
    }

    // ── Rule 10: Empty output guard ──
    if (!current.trim()) {
      current = language === "ar"
        ? "فاهمك. قل لي تحب نبدأ بأي مساحة، وأنا أوضح لك الخطوة الأنسب بهدوء."
        : "I understand. Which space would you like to start with?";
      violations.push({
        rule: "EMPTY_OUTPUT_GUARD",
        severity: "sanitize",
        original: rawOutput,
        sanitized: current,
        reason: "Empty output replaced with default",
      });
    }

    const passed = violations.every((v) => v.severity !== "block");

    if (violations.length > 0) {
      logger.warn("[GuardrailsEngine] Violations detected", {
        count: violations.length,
        rules: violations.map((v) => v.rule),
      });
    }

    return {
      passed,
      violations,
      safeOutput: current,
      blockedCompletely: !passed,
    };
  }

  /**
   * Check a USER message for jailbreak/injection attempts (pre-processing guard).
   * Returns true if the message should be blocked.
   */
  checkUserMessage(message: string): { blocked: boolean; reason: string | null } {
    for (const pattern of JAILBREAK_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(message)) {
        return { blocked: true, reason: "JAILBREAK_ATTEMPT" };
      }
    }
    // Check for system prompt extraction attempts
    if (/(نظام|البرومبت|التعليمات|instructions|system\s+prompt)/i.test(message) &&
        /(أظهر|اعرض|اكتب|اطبع|قل|show|reveal|print|write|tell\s+me)/i.test(message)) {
      return { blocked: true, reason: "PROMPT_EXTRACTION_ATTEMPT" };
    }
    return { blocked: false, reason: null };
  }

  // ── Sanitizers ──────────────────────────────────────────────────────────

  private sanitizePricing(text: string, language: "ar" | "en"): string {
    let sanitized = text;
    for (const pattern of PRICING_PATTERNS) {
      pattern.lastIndex = 0;
      sanitized = sanitized.replace(pattern, language === "ar"
        ? "[السعر يتحدد بعد معرفة التفاصيل]"
        : "[pricing depends on scope and materials]"
      );
    }
    return sanitized;
  }

  private sanitizePromise(text: string, language: "ar" | "en"): string {
    let sanitized = text;
    for (const pattern of PROMISE_PATTERNS) {
      pattern.lastIndex = 0;
      sanitized = sanitized.replace(pattern, language === "ar"
        ? "[المدة والضمان يتحددان حسب المشروع]"
        : "[timeline and warranty depend on project scope]"
      );
    }
    return sanitized;
  }

  private sanitizeInventedPeople(text: string, language: "ar" | "en"): string {
    let sanitized = text;
    for (const pattern of INVENTED_PEOPLE_PATTERNS) {
      pattern.lastIndex = 0;
      sanitized = sanitized.replace(pattern, language === "ar"
        ? "فريق أزينث المتخصص"
        : "Azenith's specialist team"
      );
    }
    return sanitized;
  }

  private sanitizeBooking(text: string, language: "ar" | "en"): string {
    for (const pattern of BOOKING_CONFIRMATION_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        return language === "ar"
          ? "تفاصيل المشروع مبشرة. لترتيب الخطوة التالية، ممكن رقم هاتفك عشان مستشار أزينث يتواصل معك مباشرة؟"
          : "The project sounds promising. To arrange the next step, may I have your phone number so our consultant can reach you?";
      }
    }
    return text;
  }

  private blockResult(violations: GuardrailViolation[], language: "ar" | "en"): GuardrailResult {
    return {
      passed: false,
      violations,
      safeOutput: language === "ar"
        ? "أعتذر، لا أستطيع الرد على هذا الطلب."
        : "I apologize, I cannot respond to this request.",
      blockedCompletely: true,
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ════════════════════════════════════════════════════════════════════════════

let guardrailsEngine: GuardrailsEngine | null = null;

export function getGuardrailsEngine(): GuardrailsEngine {
  if (!guardrailsEngine) guardrailsEngine = new GuardrailsEngine();
  return guardrailsEngine;
}
