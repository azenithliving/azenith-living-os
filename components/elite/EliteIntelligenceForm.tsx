"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getOfficeStatus, fetchRecordedHours, formatNextOpening, formatNextOpeningAr, type OfficeHours, type OfficeStatus } from "@/lib/office-hours";
import { arabicNumerals } from "@/lib/arabic";
import { roomNameAr } from "@/lib/rooms-catalog";
import { AREA_CHIPS } from "@/lib/regions";
import { STYLE_LABELS } from "@/lib/constants/rooms";
import { 
  ALL_FURNITURE_SCOPES, 
  BUDGET_RANGES as CENTRALIZED_BUDGET_RANGES,
  TIMELINE_OPTIONS as CENTRALIZED_TIMELINE_OPTIONS,
  type FurnitureScope,
  type TimelineOption
} from "@/lib/constants/furniture-data";

/**
 * What the qualification form says out loud. The form has always taken a `language` prop and never
 * read it, so an Arabic customer walked from an Arabic page into an English form — measured on the
 * published store 2026-10-07: 23 English strings, and a summary that printed the stored keys
 * («100k-200k») instead of the range he had chosen.
 */
const COPY = {
  ar: {
    steps: ["المساحة", "الميزانية", "التوقيت", "الذوق والمنطقة", "التفاصيل", "التواصل"],
    closedTitle: "فريقنا دلوقتي بيشتغل على مشاريعه",
    closedLine: (when: string) => `هنراجع طلبك على الأول ${when}.`,
    diamondTitle: "طلبك مميز",
    diamondLine: "هيتابعى الأول من فريق التصميم.",
    scopeTitle: "اختار المساحة اللي عايز تطوّرها",
    scopeLine: "قولي أنهي مكان في البيت هو المطلوب",
    budgetTitle: "نطاق الاستثمار",
    budgetLine: (scope: string) => `الميزانية المتوقعة لـ${scope}`,
    timelineTitle: "التوقيت",
    timelineLine: "عايز الشغل يخلص امتى؟",
    blueprintTitle: "عندك مخططات؟",
    blueprintLine: "لو معاكي رسومات معمارية للمكان اذكريها.",
    blueprintYes: "أيوه، عندي مخططات",
    blueprintNo: "لأ، محتاج استشارة",
    requestsTitle: "طلباتك الخاصة",
    requestsLine: "قولي على الخامات أو الألوان أو أي تفصيل مهمك (اختياري)",
    styleTitle: "ذوقك ومنطقتك",
    styleLine: "اختار الطراز اللي بيحبك — هو اللي بيحدد الصور اللي هنجهزها لطلبك",
    styleNone: "مش محدد دلوقتي",
    areaTitle: "منطقتك",
    areaLine: "هنقرب اختياراتنا من ذوق الناس في منطقتك",
    requestsPlaceholder: "مثلاً: رخام إيطالي، منزل ذكي، ألوان هادية…",
    contactTitle: "بيانات التواصل",
    contactLine: "نقدر نوصلك إزاي؟",
    name: "الاسم بالكامل",
    namePlaceholder: "اكتب اسمك",
    phone: "رقم الموبايل",
    phonePlaceholder: "مثلاً: ٠١٠٠ ١٢٣ ٤٥٦٧",
    email: "البريد الإلكتروني (اختياري)",
    summaryTitle: "ملخص طلبك",
    summaryScope: "المساحة",
    summaryBudget: "الميزانية",
    summaryTimeline: "التوقيت",
    back: "رجوع",
    processing: "جارٍ الإرسال…",
    submit: "أرسل طلبك",
    next: "التالي",
    none: "لسه ما اتحددتش",
  },
  en: {
    steps: ["Scope", "Budget", "Timeline", "Taste & Area", "Details", "Contact"],
    closedTitle: "Our consultants are currently preparing masterpieces.",
    closedLine: (when: string) => `We will review your brief as a priority at ${when}.`,
    diamondTitle: "Diamond Lead Detected",
    diamondLine: `Priority: {priority} | Score: {score}/100`,
    scopeTitle: "Select Your Project Scope",
    scopeLine: "Choose the space you want to transform",
    budgetTitle: "Investment Range",
    budgetLine: (scope: string) => `Select your budget for ${scope}`,
    timelineTitle: "Project Timeline",
    timelineLine: "When do you need this completed?",
    blueprintTitle: "Blueprint Available?",
    blueprintLine: "Do you have architectural plans?",
    blueprintYes: "Yes, I have plans",
    blueprintNo: "No, need consultation",
    requestsTitle: "Special Requests",
    requestsLine: "Tell us about specific materials, brands, or design preferences (optional)",
    styleTitle: "Your taste and your area",
    styleLine: "Pick the style you love — it decides which designs we prepare for your brief",
    styleNone: "Not sure yet",
    areaTitle: "Your area",
    areaLine: "We shape the sheet around what people like in your neighbourhood",
    requestsPlaceholder: "e.g., I prefer Italian marble, smart home integration, specific color scheme...",
    contactTitle: "Contact Information",
    contactLine: "How should we reach you?",
    name: "Full Name *",
    namePlaceholder: "Your name",
    phone: "Phone Number *",
    phonePlaceholder: "e.g., 0100 123 4567",
    email: "Email (optional)",
    summaryTitle: "Brief Summary",
    summaryScope: "Scope:",
    summaryBudget: "Budget:",
    summaryTimeline: "Timeline:",
    back: "Back",
    processing: "Processing...",
    submit: "Submit Brief",
    next: "Continue",
    none: "-",
  },
};

/**
 * The styles the picture bank really files, in the store's own Arabic words — the same names
 * `STYLE_LABELS` gives the catalogue, so the brief and the bank cannot drift into two vocabularies.
 * The Arabic word is what gets stored in every language: it is the shape his own sheet and the
 * owner's pre-call paper can print.
 */
const TASTE_CHIPS = Object.entries(STYLE_LABELS).map(([key, label]) => ({
  key,
  label,
  en: key.replace(/^./, (letter) => letter.toUpperCase()),
}));

/**
 * Azenith Elite Intelligence & Lead Qualification System
 * Context-Aware Multi-Step Form with Egyptian Market Adaptation
 */

// Re-export types for backward compatibility
export type ScopeType = FurnitureScope;
export type BudgetOption = {
  label: string;
  value: string;
  min: number;
  max: number | null;
};
export { TimelineOption };

export type FormData = {
  scope: ScopeType | null;
  budget: string | null;
  timeline: TimelineOption | null;
  /** His taste in the store's own Arabic word, or null when he said he is not sure. */
  style: string | null;
  /** His area, tapped off the store's map, or null. */
  area: string | null;
  blueprintAvailable: boolean | null;
  specialRequests: string;
  fullName: string;
  phone: string;
  email: string;
};

// WhatsApp link generator for client-side redirect
export function generateWhatsAppLink(leadData: {
  fullName: string;
  scope: string | null;
  budget: string | null;
  tier: string;
  styleAnalysis?: string;
  phone?: string;
}, adminWhatsApp: string | null | undefined): string | null {
  const normalizedWhatsApp = adminWhatsApp?.replace(/\D/g, "") || "";
  if (normalizedWhatsApp.length < 8) {
    return null;
  }
  
  const message = `🚨 LEAD MASI - استفسار جديد

👤 الاسم: ${leadData.fullName}
📍 النطاق: ${leadData.scope || "غير محدد"}
💰 ميزانية: ${leadData.budget || "غير محدد"}
⭐ الفئة: ${leadData.tier}
🎨 التحليل: ${leadData.styleAnalysis || "يحتاج استشارة"}

📞 رقم العميل: ${leadData.phone || "غير متوفر"}

عرض التفاصيل الكاملة في لوحة التحكم.`;

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${normalizedWhatsApp}?text=${encodedMessage}`;
}

export type LeadQualification = {
  isDiamond: boolean;
  score: number;
  tier: "Diamond" | "Gold" | "Silver";
  priority: "urgent" | "high" | "medium" | "low";
};

// Use centralized budget ranges and timeline options
const BUDGET_RANGES = CENTRALIZED_BUDGET_RANGES;
const TIMELINE_OPTIONS = CENTRALIZED_TIMELINE_OPTIONS;

// Calculate lead qualification
function calculateLeadQualification(
  scope: ScopeType | null,
  budget: string | null,
  timeline: TimelineOption | null
): LeadQualification {
  let score = 0;
  let tier: LeadQualification["tier"] = "Silver";
  let priority: LeadQualification["priority"] = "low";

  // Budget scoring with safety check
  if (!scope) {
    // Return default "Standard" qualification if no scope selected
    return { isDiamond: false, score: 0, tier: "Silver", priority: "low" };
  }
  
  // Additional safety check - ensure scope exists in BUDGET_RANGES
  if (!BUDGET_RANGES[scope]) {
    console.warn(`[EliteIntelligenceForm] Unknown scope: ${scope}. Returning default qualification.`);
    return { isDiamond: false, score: 10, tier: "Silver", priority: "low" };
  }
  
  const budgetOption = BUDGET_RANGES[scope].find((b) => b.value === budget);
  if (budgetOption) {
    if (budgetOption.max === null) score += 40; // Highest tier budget
    else if (budgetOption.min >= 300000) score += 30;
    else if (budgetOption.min >= 150000) score += 20;
    else score += 10;
  }

  // Timeline scoring
  const timelineOption = TIMELINE_OPTIONS.find((t) => t.value === timeline);
  if (timelineOption) {
    score += timelineOption.priority;
  }

  // Scope scoring
  if (scope === "Full Unit") score += 25;
  else if (scope === "Kitchen" || scope === "Living Room") score += 20;
  else if (scope === "Master Bedroom" || scope === "Dining Room") score += 15;
  else score += 10;

  // Determine tier and priority
  if (score >= 60) {
    tier = "Diamond";
    priority = "urgent";
  } else if (score >= 45) {
    tier = "Gold";
    priority = "high";
  } else if (score >= 30) {
    tier = "Silver";
    priority = "medium";
  } else {
    tier = "Silver";
    priority = "low";
  }

  return { isDiamond: tier === "Diamond", score, tier, priority };
}

interface EliteIntelligenceFormProps {
  onSubmit: (data: FormData & { qualification: LeadQualification }) => Promise<void>;
  viewedImages?: string[];
  className?: string;
  /**
   * The customer's language, from the store's own setting. The floor is Arabic — the same default
   * the session store opens with — so a screen that forgets to pass it fails toward his language.
   * Measured 2026-10-09: the brief screen never passed it and the old floor was English, so an
   * Egyptian customer walked from an Arabic page into an English form.
   */
  language?: "ar" | "en";
}

export function EliteIntelligenceForm({ onSubmit, viewedImages = [], className = "", language = "ar" }: EliteIntelligenceFormProps) {
  const ar = language !== "en";
  const L = ar ? COPY.ar : COPY.en;
  const [step, setStep] = useState(1);
  const [officeStatus, setOfficeStatus] = useState<OfficeStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [whatsAppNumber, setWhatsAppNumber] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    scope: null,
    budget: null,
    timeline: null,
    style: null,
    area: null,
    blueprintAvailable: null,
    specialRequests: "",
    fullName: "",
    phone: "",
    email: "",
  });

  // Mount effect to prevent hydration mismatch
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // The contact number is a runtime setting. Never fall back to a demo number
  // or open a WhatsApp link when the deployment has not configured one.
  useEffect(() => {
    let cancelled = false;

    void fetch("/api/config", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ whatsappNumber?: unknown }>;
      })
      .then((config) => {
        if (cancelled || typeof config?.whatsappNumber !== "string") return;
        const normalized = config.whatsappNumber.replace(/\D/g, "");
        setWhatsAppNumber(normalized.length >= 8 ? normalized : null);
      })
      .catch(() => {
        if (!cancelled) setWhatsAppNumber(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Update office status on client side — from the store's own recorded hours when they can be read.
  useEffect(() => {
    let cancelled = false;
    let override: OfficeHours | null = null;
    const refresh = () => setOfficeStatus(getOfficeStatus(override));
    refresh();
    void fetchRecordedHours().then((recorded) => {
      if (cancelled || !recorded) return;
      override = recorded;
      refresh();
    });
    const interval = setInterval(refresh, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const qualification = calculateLeadQualification(formData.scope, formData.budget, formData.timeline);

  const updateField = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleNext = () => setStep((s) => Math.min(s + 1, 6));
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({ ...formData, qualification });
      
      // Show success screen - WhatsApp will be triggered via manual button click
      setIsSuccess(true);
    } catch (error) {
      console.error("[EliteIntelligenceForm] Submit error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const canProceed = () => {
    switch (step) {
      case 1:
        return !!formData.scope;
      case 2:
        return !!formData.budget;
      case 3:
        return !!formData.timeline && formData.blueprintAvailable !== null;
      case 4:
        return true; // Optional taste and area — nobody is stopped for not naming them
      case 5:
        return true; // Optional special requests
      case 6:
        return formData.fullName.length >= 2 && formData.phone.length >= 8;
      default:
        return false;
    }
  };

  // Prevent hydration mismatch - render minimal content until mounted
  if (!hasMounted) {
    return (
      <div className={`mx-auto max-w-2xl ${className}`} suppressHydrationWarning>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm">
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" />
          </div>
        </div>
      </div>
    );
  }

  // Success screen. A WhatsApp CTA appears only when the deployed runtime has
  // a real number configured; the submitted brief is already stored by onSubmit.
  if (isSuccess) {
    const whatsappLink = generateWhatsAppLink({
      fullName: formData.fullName,
      scope: formData.scope,
      budget: formData.budget,
      tier: qualification.tier,
      styleAnalysis: formData.specialRequests || undefined,
      phone: formData.phone || undefined,
    }, whatsAppNumber);
    
    return (
      <div className={`mx-auto max-w-2xl ${className}`} suppressHydrationWarning>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/20 to-yellow-400/10 p-10 text-center backdrop-blur-sm"
        >
          {/* Success Icon */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-yellow-400 shadow-lg shadow-amber-500/30">
            <svg className="h-10 w-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h2 className="mb-3 text-2xl font-bold text-white">
            تم استلام طلبك بنجاح!
          </h2>
          <p className="mb-2 text-amber-300 text-lg">
            سيراجع فريق Azenith تفاصيل مشروعك وبيانات التواصل التي أدخلتها.
          </p>
          
          {/* Scope & Details */}
          <div className="mb-8 mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-white/80">
              <span className="text-amber-400">📍</span> {formData.scope}
            </p>
            {formData.budget && (
              <p className="mt-1 text-white/60 text-sm">
                الميزانية: {formData.budget}
              </p>
            )}
          </div>
          
          {whatsappLink ? (
            <>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 px-8 py-5 font-bold text-black shadow-lg shadow-amber-500/25 transition-all hover:from-amber-400 hover:to-yellow-300 hover:shadow-amber-500/40 active:scale-[0.98]"
              >
                <svg className="h-7 w-7 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span className="text-lg">إرسال تفاصيل إضافية عبر واتساب</span>
              </a>
              <p className="mt-4 text-sm text-white/50">سيُفتح تطبيق واتساب برسالة اختيارية إلى فريق Azenith.</p>
            </>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/65">
              تم حفظ طلبك. سيتواصل الفريق باستخدام بيانات الاتصال التي قدمتها.
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-2xl ${className}`} suppressHydrationWarning>
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-white/60">
          {L.steps.map((label, i) => (
            <span key={label} className={step > i ? "text-amber-400" : ""}>
              {label}
            </span>
          ))}
        </div>
        <div className="mt-2 h-1 rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400"
            initial={{ width: 0 }}
            animate={{ width: `${(step / 6) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Office Hours Status */}
      {officeStatus && !officeStatus.isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
        >
          <p className="text-sm text-amber-200/90">
            <span className="font-semibold">{L.closedTitle}</span>
            <br />
            {L.closedLine(ar ? formatNextOpeningAr(officeStatus) : formatNextOpening(officeStatus))}
          </p>
        </motion.div>
      )}

      {/* Diamond Lead Indicator */}
      {qualification.isDiamond && step >= 3 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-500/20 to-yellow-400/10 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/30 text-2xl">💎</div>
            <div>
              <p className="font-semibold text-amber-300">{L.diamondTitle}</p>
              <p className="text-sm text-amber-200/80">
                {ar
                  ? L.diamondLine
                  : `Priority: ${qualification.priority.toUpperCase()} | Score: ${qualification.score}/100`}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Form Steps */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm"
        >
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white">{L.scopeTitle}</h3>
              <p className="text-sm text-white/60">{L.scopeLine}</p>
              <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
                {ALL_FURNITURE_SCOPES.map((scope) => (
                  <button
                    key={scope}
                    onClick={() => {
                      updateField("scope", scope);
                      updateField("budget", null); // Reset budget on scope change
                    }}
                    className={`flex items-center justify-between rounded-xl border p-4 transition-all ${
                      formData.scope === scope
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <span className="font-medium text-white">{ar ? roomNameAr(scope) || scope : scope}</span>
                    {formData.scope === scope && <span className="text-amber-400">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && formData.scope && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white">{L.budgetTitle}</h3>
              <p className="text-sm text-white/60">{L.budgetLine(ar ? roomNameAr(formData.scope) || formData.scope : formData.scope)}</p>
              <div className="grid gap-3">
                {BUDGET_RANGES[formData.scope].map((budget) => (
                  <button
                    key={budget.value}
                    onClick={() => updateField("budget", budget.value)}
                    className={`flex items-center justify-between rounded-xl border p-4 transition-all ${
                      formData.budget === budget.value
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <span className="font-medium text-white">{arabicNumerals(budget.label)}</span>
                    {formData.budget === budget.value && <span className="text-amber-400">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-white">{L.timelineTitle}</h3>
                <p className="text-sm text-white/60">{L.timelineLine}</p>
                <div className="mt-4 grid gap-3">
                  {TIMELINE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => updateField("timeline", option.value)}
                      className={`flex items-center justify-between rounded-xl border p-4 transition-all ${
                        formData.timeline === option.value
                          ? "border-amber-500/50 bg-amber-500/10"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                      }`}
                    >
                      <span className="font-medium text-white">{ar ? option.labelAr : option.label}</span>
                      {formData.timeline === option.value && <span className="text-amber-400">✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white">{L.blueprintTitle}</h3>
                <p className="text-sm text-white/60">{L.blueprintLine}</p>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => updateField("blueprintAvailable", true)}
                    className={`flex-1 rounded-xl border p-4 transition-all ${
                      formData.blueprintAvailable === true
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <span className="font-medium text-white">{L.blueprintYes}</span>
                  </button>
                  <button
                    onClick={() => updateField("blueprintAvailable", false)}
                    className={`flex-1 rounded-xl border p-4 transition-all ${
                      formData.blueprintAvailable === false
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <span className="font-medium text-white">{L.blueprintNo}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-white">{L.styleTitle}</h3>
                <p className="text-sm text-white/60">{L.styleLine}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {TASTE_CHIPS.map((taste) => (
                    <button
                      key={taste.key}
                      type="button"
                      onClick={() => updateField("style", formData.style === taste.label ? null : taste.label)}
                      data-elite-taste-chip={taste.label}
                      data-elite-taste-chip-selected={formData.style === taste.label ? "1" : "0"}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                        formData.style === taste.label
                          ? "border-amber-500/60 bg-amber-500/15 text-white"
                          : "border-white/10 bg-white/[0.02] text-white/70 hover:border-white/30"
                      }`}
                    >
                      {ar ? taste.label : taste.en}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => updateField("style", null)}
                  data-elite-taste-none="1"
                  className={`mt-3 rounded-full border px-4 py-2 text-sm transition-all ${
                    formData.style === null
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                      : "border-white/10 text-white/50 hover:border-white/25"
                  }`}
                >
                  {L.styleNone}
                </button>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-white">{L.areaTitle}</h4>
                <p className="text-sm text-white/60">{L.areaLine}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {AREA_CHIPS.map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => updateField("area", formData.area === area ? null : area)}
                      data-elite-area-chip={area}
                      data-elite-area-chip-selected={formData.area === area ? "1" : "0"}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                        formData.area === area
                          ? "border-amber-500/60 bg-amber-500/15 text-white"
                          : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/25"
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white">{L.requestsTitle}</h3>
              <p className="text-sm text-white/60">
                {L.requestsLine}
              </p>
              <textarea
                value={formData.specialRequests}
                onChange={(e) => updateField("specialRequests", e.target.value)}
                placeholder={L.requestsPlaceholder}
                className="min-h-[120px] w-full rounded-xl border border-white/10 bg-white/[0.05] p-4 text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none"
                maxLength={1000}
              />
              <p className="text-right text-xs text-white/40">{arabicNumerals(`${formData.specialRequests.length}/1000`)}</p>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white">{L.contactTitle}</h3>
              <p className="text-sm text-white/60">{L.contactLine}</p>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-white/60">{L.name}</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => updateField("fullName", e.target.value)}
                    placeholder={L.namePlaceholder}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.05] p-4 text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-white/60">{L.phone}</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder={L.phonePlaceholder}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.05] p-4 text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-white/60">{L.email}</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="your@email.com"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.05] p-4 text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
              </div>

              {/* Summary Preview */}
              <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h4 className="mb-3 text-sm font-semibold text-white/80">{L.summaryTitle}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/50">{L.summaryScope}</span>
                    <span className="text-white">{ar ? roomNameAr(formData.scope) || L.none : formData.scope || L.none}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">{L.summaryBudget}</span>
                    <span className="text-white">
                      {arabicNumerals(
                        (formData.scope && CENTRALIZED_BUDGET_RANGES[formData.scope]?.find((b) => b.value === formData.budget)?.label) || L.none,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">{L.summaryTimeline}</span>
                    <span className="text-white">
                      {(() => {
                        const chosen = TIMELINE_OPTIONS.find((t) => t.value === formData.timeline);
                        return chosen ? (ar ? chosen.labelAr : chosen.label) : L.none;
                      })()}
                    </span>
                  </div>
                  {!ar && (
                    <div className="flex justify-between">
                      <span className="text-white/50">Lead Tier:</span>
                      <span className={qualification.isDiamond ? "text-amber-400 font-semibold" : "text-white"}>
                        {qualification.tier}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="mt-6 flex gap-3">
        {step > 1 && (
          <button
            onClick={handleBack}
            className="rounded-xl border border-white/20 bg-white/[0.05] px-6 py-3 text-white transition-colors hover:bg-white/10"
          >
            {L.back}
          </button>
        )}
        <button
          onClick={step === 6 ? handleSubmit : handleNext}
          disabled={!canProceed() || isSubmitting}
          className={`flex-1 rounded-xl px-6 py-3 font-medium transition-all ${
            canProceed() && !isSubmitting
              ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black hover:from-amber-400 hover:to-yellow-300"
              : "cursor-not-allowed bg-white/10 text-white/40"
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              {L.processing}
            </span>
          ) : step === 6 ? (
            L.submit
          ) : (
            L.next
          )}
        </button>
      </div>
    </div>
  );
}

export { calculateLeadQualification };
