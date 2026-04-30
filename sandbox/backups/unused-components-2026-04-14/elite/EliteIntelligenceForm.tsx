"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOfficeStatus, getOfficeStatus, formatNextOpening, OfficeStatus } from "@/lib/office-hours";
import { 
  ALL_FURNITURE_SCOPES, 
  BUDGET_RANGES as CENTRALIZED_BUDGET_RANGES,
  TIMELINE_OPTIONS as CENTRALIZED_TIMELINE_OPTIONS,
  type FurnitureScope,
  type TimelineOption
} from "@/lib/constants/furniture-data";

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
}): string {
  const adminWhatsApp = "201001234567"; // Admin WhatsApp number - should come from env/config
  
  const message = `🚨 LEAD MASI - استفسار جديد

👤 الاسم: ${leadData.fullName}
📍 النطاق: ${leadData.scope || "غير محدد"}
💰 ميزانية: ${leadData.budget || "غير محدد"}
⭐ الفئة: ${leadData.tier}
🎨 التحليل: ${leadData.styleAnalysis || "يحتاج استشارة"}

📞 رقم العميل: ${leadData.phone || "غير متوفر"}

عرض التفاصيل الكاملة في لوحة التحكم.`;

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${adminWhatsApp}?text=${encodedMessage}`;
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
  language?: "ar" | "en";
}

export function EliteIntelligenceForm({ onSubmit, viewedImages = [], className = "", language = "en" }: EliteIntelligenceFormProps) {
  const [step, setStep] = useState(1);
  const [officeStatus, setOfficeStatus] = useState<OfficeStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    scope: null,
    budget: null,
    timeline: null,
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

  // Update office status on client side
  useEffect(() => {
    setOfficeStatus(getOfficeStatus());
    const interval = setInterval(() => setOfficeStatus(getOfficeStatus()), 60000);
    return () => clearInterval(interval);
  }, []);

  const qualification = calculateLeadQualification(formData.scope, formData.budget, formData.timeline);

  const updateField = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleNext = () => setStep((s) => Math.min(s + 1, 5));
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
  
  const handleWhatsAppFallback = () => {
    if (typeof window !== "undefined") {
      const whatsappLink = generateWhatsAppLink({
        fullName: formData.fullName,
        scope: formData.scope,
        budget: formData.budget,
        tier: qualification.tier,
        styleAnalysis: formData.specialRequests || undefined,
        phone: formData.phone || undefined,
      });
      window.open(whatsappLink, "_blank");
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
        return true; // Optional special requests
      case 5:
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

  // Success screen - Luxury Success View with Manual WhatsApp Trigger (Anchor Tag)
  if (isSuccess) {
    // Generate WhatsApp link for anchor tag href - guaranteed to work with user click
    const whatsappLink = typeof window !== "undefined" 
      ? generateWhatsAppLink({
          fullName: formData.fullName,
          scope: formData.scope,
          budget: formData.budget,
          tier: qualification.tier,
          styleAnalysis: formData.specialRequests || undefined,
          phone: formData.phone || undefined,
        })
      : "#";
    
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
          
          {/* AI Analysis Message */}
          <h2 className="mb-3 text-2xl font-bold text-white">
            تم استلام طلبك بنجاح!
          </h2>
          <p className="mb-2 text-amber-300 text-lg">
            🤖 حلل الذكاء الاصطناعي ذوقك الخاص
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
          
          {/* WhatsApp Anchor Link - Guaranteed to work with user click */}
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 px-8 py-5 font-bold text-black shadow-lg shadow-amber-500/25 transition-all hover:from-amber-400 hover:to-yellow-300 hover:shadow-amber-500/40 active:scale-[0.98]"
          >
            <svg className="h-7 w-7 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span className="text-lg">إرسال التفاصيل وبدء الاستشارة (WhatsApp)</span>
          </a>
          
          {/* Note */}
          <p className="mt-4 text-sm text-white/50">
            سيتم فتح محادثة مباشرة مع استشاري Azenith لتلقي عرض السعر
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-2xl ${className}`} suppressHydrationWarning>
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-white/60">
          {["Scope", "Budget", "Timeline", "Details", "Contact"].map((label, i) => (
            <span key={label} className={step > i ? "text-amber-400" : ""}>
              {label}
            </span>
          ))}
        </div>
        <div className="mt-2 h-1 rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400"
            initial={{ width: 0 }}
            animate={{ width: `${(step / 5) * 100}%` }}
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
            <span className="font-semibold">Our consultants are currently preparing masterpieces.</span>
            <br />
            We will review your brief as a priority at {formatNextOpening(officeStatus)}.
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
              <p className="font-semibold text-amber-300">Diamond Lead Detected</p>
              <p className="text-sm text-amber-200/80">
                Priority: {qualification.priority.toUpperCase()} | Score: {qualification.score}/100
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
              <h3 className="text-xl font-semibold text-white">Select Your Project Scope</h3>
              <p className="text-sm text-white/60">Choose the space you want to transform</p>
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
                    <span className="font-medium text-white">{scope}</span>
                    {formData.scope === scope && <span className="text-amber-400">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && formData.scope && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white">Investment Range</h3>
              <p className="text-sm text-white/60">Select your budget for {formData.scope}</p>
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
                    <span className="font-medium text-white">{budget.label}</span>
                    {formData.budget === budget.value && <span className="text-amber-400">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-white">Project Timeline</h3>
                <p className="text-sm text-white/60">When do you need this completed?</p>
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
                      <span className="font-medium text-white">{option.label}</span>
                      {formData.timeline === option.value && <span className="text-amber-400">✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white">Blueprint Available?</h3>
                <p className="text-sm text-white/60">Do you have architectural plans?</p>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => updateField("blueprintAvailable", true)}
                    className={`flex-1 rounded-xl border p-4 transition-all ${
                      formData.blueprintAvailable === true
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <span className="font-medium text-white">Yes, I have plans</span>
                  </button>
                  <button
                    onClick={() => updateField("blueprintAvailable", false)}
                    className={`flex-1 rounded-xl border p-4 transition-all ${
                      formData.blueprintAvailable === false
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <span className="font-medium text-white">No, need consultation</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white">Special Requests</h3>
              <p className="text-sm text-white/60">
                Tell us about specific materials, brands, or design preferences (optional)
              </p>
              <textarea
                value={formData.specialRequests}
                onChange={(e) => updateField("specialRequests", e.target.value)}
                placeholder="e.g., I prefer Italian marble, smart home integration, specific color scheme..."
                className="min-h-[120px] w-full rounded-xl border border-white/10 bg-white/[0.05] p-4 text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none"
                maxLength={1000}
              />
              <p className="text-right text-xs text-white/40">{formData.specialRequests.length}/1000</p>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white">Contact Information</h3>
              <p className="text-sm text-white/60">How should we reach you?</p>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-white/60">Full Name *</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => updateField("fullName", e.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.05] p-4 text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-white/60">Phone Number *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="e.g., 0100 123 4567"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.05] p-4 text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-white/60">Email (optional)</label>
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
                <h4 className="mb-3 text-sm font-semibold text-white/80">Brief Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/50">Scope:</span>
                    <span className="text-white">{formData.scope || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Budget:</span>
                    <span className="text-white">{formData.budget || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Timeline:</span>
                    <span className="text-white">{formData.timeline || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Lead Tier:</span>
                    <span className={qualification.isDiamond ? "text-amber-400 font-semibold" : "text-white"}>
                      {qualification.tier}
                    </span>
                  </div>
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
            Back
          </button>
        )}
        <button
          onClick={step === 5 ? handleSubmit : handleNext}
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
              Processing...
            </span>
          ) : step === 5 ? (
            "Submit Brief"
          ) : (
            "Continue"
          )}
        </button>
      </div>
    </div>
  );
}

export { calculateLeadQualification };
