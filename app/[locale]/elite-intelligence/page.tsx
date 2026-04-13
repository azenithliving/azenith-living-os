"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale, useTranslations } from 'next-intl';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { EliteIntelligenceForm, FormData, LeadQualification } from "@/components/elite/EliteIntelligenceForm";
import { AestheticAdvisor, AestheticAdvice } from "@/components/elite/AestheticAdvisor";
import { InvestmentBrackets, InvestmentTier } from "@/components/elite/InvestmentBrackets";
import { LanguageSwitcher } from "@/components/elite/LanguageSwitcher";
import { getOfficeStatus, formatNextOpening, OfficeStatus } from "@/lib/office-hours";
import { getViewedImageUrls } from "@/lib/image-tracking";

/**
 * Elite Intelligence Page - Unified Creative Visionary Suite
 * Integrates: Multi-step Form, Aesthetic Advisor, Investment Brackets
 */

type Language = 'ar' | 'en';

type SubmissionStage = 
  | "form" 
  | "investment" 
  | "aesthetic" 
  | "submitting" 
  | "success";

interface CompleteSubmissionData {
  form: FormData & { qualification: LeadQualification };
  investmentTier: InvestmentTier | null;
  aestheticAdvice: AestheticAdvice | null;
  language: Language;
  viewedImages: string[];
}

function EliteIntelligenceContent() {
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<SubmissionStage>("form");
  const [language, setLanguage] = useState<Language>("en");
  const [officeStatus, setOfficeStatus] = useState<OfficeStatus | null>(null);
  const [formData, setFormData] = useState<(FormData & { qualification: LeadQualification }) | null>(null);
  const [investmentTier, setInvestmentTier] = useState<InvestmentTier | null>(null);
  const [aestheticAdvice, setAestheticAdvice] = useState<AestheticAdvice | null>(null);
  const [viewedImages, setViewedImages] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initialize
  useEffect(() => {
    setOfficeStatus(getOfficeStatus());
    setViewedImages(getViewedImageUrls());
    
    // Detect language preference from URL or browser
    const langParam = searchParams.get("lang") as Language;
    if (langParam === "ar" || langParam === "en") {
      setLanguage(langParam);
    } else if (typeof navigator !== "undefined" && navigator.language.startsWith("ar")) {
      setLanguage("ar");
    }

    const interval = setInterval(() => setOfficeStatus(getOfficeStatus()), 60000);
    return () => clearInterval(interval);
  }, [searchParams]);

  const handleFormComplete = async (data: FormData & { qualification: LeadQualification }) => {
    setFormData(data);
    
    // If client is Diamond tier, show investment brackets
    if (data.qualification.tier === "Diamond" || data.qualification.tier === "Gold") {
      setStage("investment");
    } else {
      // Skip to submission for lower tiers
      await submitLead(data, null, null);
    }
  };

  const handleInvestmentSelect = (tier: InvestmentTier) => {
    setInvestmentTier(tier);
    setStage("aesthetic");
  };

  const handleAestheticComplete = async (advice: AestheticAdvice | null) => {
    setAestheticAdvice(advice);
    if (formData) {
      await submitLead(formData, investmentTier, advice);
    }
  };

  const submitLead = async (
    form: FormData & { qualification: LeadQualification },
    investment: InvestmentTier | null,
    aesthetic: AestheticAdvice | null
  ) => {
    setStage("submitting");
    setSubmitError(null);

    try {
      // Admin translation feature temporarily disabled (multilingual-engine removed)
      // Future: Re-implement using next-intl or direct API calls
      const adminTranslation = undefined;

      const payload = {
        sessionId: crypto.randomUUID(),
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
        roomType: form.scope,
        budget: investment?.rangeEGP || form.budget,
        style: "elite-intelligence",
        serviceType: form.timeline,
        notes: form.specialRequests,
        viewedImages,
        qualification: form.qualification,
        blueprintAvailable: form.blueprintAvailable,
        specialRequests: form.specialRequests,
        score: form.qualification.score,
        // New Creative Visionary fields
        language,
        investmentTier: investment ? {
          tier: investment.level,
          rangeEGP: investment.rangeEGP,
          description: investment.description,
        } : null,
        aestheticAdvice: aesthetic,
        adminTranslation,
      };

      const response = await fetch("/api/elite-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.message || "Failed to submit");
      }

      // Clear viewed images after successful submission
      if (typeof window !== "undefined") {
        localStorage.removeItem("azenith_viewed_images");
      }

      setStage("success");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Submission failed");
      setStage("form");
    }
  };

  const isRTL = language === "ar";

  return (
    <main className={`min-h-screen bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] ${isRTL ? "rtl" : "ltr"}`}>
      {/* Language Switcher */}
      <div className="fixed right-4 top-4 z-50">
        <LanguageSwitcher currentLang={language} onChange={setLanguage} />
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <p className="text-sm uppercase tracking-[0.28em] text-amber-400/70">
            {language === "ar" ? "الاستخبارات المتميزة" : "Elite Intelligence"}
          </p>
          <h1 className="mt-4 font-serif text-4xl text-white md:text-5xl lg:text-6xl">
            {language === "ar" ? "صمم رؤيتك" : "Design Your Vision"}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
            {language === "ar" 
              ? "أكمل نموذج المشروع وسنقوم بإعداد تصميم مخصص لك"
              : "Complete the project brief and we'll craft a personalized design concept"
            }
          </p>
        </motion.div>

        {/* Office Hours Status */}
        {officeStatus && !officeStatus.isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mb-8 max-w-2xl rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
          >
            <p 
              className={`text-sm text-amber-200/90 ${
                language === "ar" 
                  ? "text-right leading-relaxed" 
                  : "text-left leading-relaxed"
              }`}
              dir={language === "ar" ? "rtl" : "ltr"}
            >
              {language === "ar" 
                ? `فريق الاستشارات يستعد للإبداع. نراجع طلبك عند ${formatNextOpening(officeStatus)}`
                : officeStatus.message
              }
            </p>
          </motion.div>
        )}

        {/* Error Display */}
        {submitError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-auto mb-6 max-w-2xl rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-center"
          >
            <p className="text-red-300">{submitError}</p>
          </motion.div>
        )}

        {/* Stage Content */}
        <AnimatePresence mode="wait">
          {stage === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="mx-auto max-w-2xl"
            >
              {/* Viewed Images Summary */}
              {viewedImages.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mb-8 rounded-xl border border-amber-400/20 bg-amber-500/5 p-4"
                >
                  <p className="text-sm text-amber-300/80">
                    {language === "ar" 
                      ? `📸 مصدر DNA الأسلوب: شاهدت ${viewedImages.length} صورة تصميم`
                      : `📸 Style DNA Source: You viewed ${viewedImages.length} design images`
                    }
                  </p>
                </motion.div>
              )}

              <EliteIntelligenceForm
                onSubmit={handleFormComplete}
                viewedImages={viewedImages}
                language={language}
              />
            </motion.div>
          )}

          {stage === "investment" && formData?.scope && (
            <motion.div
              key="investment"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="mx-auto max-w-xl"
            >
              <InvestmentBrackets
                scope={formData.scope}
                selectedTier={investmentTier?.level || null}
                onSelect={handleInvestmentSelect}
              />
              <button
                onClick={() => setStage("aesthetic")}
                className="mt-4 w-full rounded-xl border border-white/20 bg-white/[0.05] px-6 py-3 text-white transition-colors hover:bg-white/10"
              >
                {language === "ar" ? "تخطي هذه الخطوة" : "Skip This Step"}
              </button>
            </motion.div>
          )}

          {stage === "aesthetic" && formData?.scope && (
            <motion.div
              key="aesthetic"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="mx-auto max-w-xl"
            >
              <AestheticAdvisor
                scope={formData.scope}
                onComplete={handleAestheticComplete}
                onRequestSurvey={() => {
                  if (formData) {
                    submitLead(formData, investmentTier, aestheticAdvice);
                  }
                }}
              />
            </motion.div>
          )}

          {stage === "submitting" && (
            <motion.div
              key="submitting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" />
              <p className="mt-4 text-white/60">
                {language === "ar" ? "جاري تحليل DNA الأسلوب..." : "Analyzing your Style DNA..."}
              </p>
            </motion.div>
          )}

          {stage === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mx-auto max-w-xl rounded-2xl border border-amber-400/30 bg-gradient-to-b from-amber-500/10 to-yellow-400/5 p-8 text-center"
            >
              <div className="mb-4 text-6xl">✨</div>
              <h2 className="text-2xl font-semibold text-white">
                {language === "ar" ? "تم إرسال طلبك بنجاح" : "Brief Submitted Successfully"}
              </h2>
              <p className="mt-4 text-white/70">
                {language === "ar" 
                  ? "فريقنا يقوم بتحليل DNA الأسلوب وإعداد باقة التصاميم المخصصة لك"
                  : "Our team is analyzing your Style DNA and preparing your personalized concept portfolio"
                }
              </p>
              
              {investmentTier && (
                <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4">
                  <p className="text-sm text-amber-300">
                    {language === "ar" ? "الفئة المختارة:" : "Selected Tier:"}{" "}
                    <span className="font-semibold">{investmentTier.level}</span>
                  </p>
                  <p className="text-xs text-amber-200/70">{investmentTier.rangeEGP}</p>
                </div>
              )}

              {aestheticAdvice && (
                <div className="mt-4 rounded-xl border border-purple-400/20 bg-purple-500/10 p-4">
                  <p className="text-sm text-purple-300">
                    {language === "ar" ? "✓ تم تحليل الصور" : "✓ Images Analyzed"}
                  </p>
                  <p className="text-xs text-purple-200/70 line-clamp-2">
                    {aestheticAdvice.inspirationalSummary}
                  </p>
                </div>
              )}

              <div className="mt-8 flex justify-center gap-4">
                <a
                  href="/"
                  className="rounded-xl bg-white/10 px-6 py-3 text-white transition-colors hover:bg-white/20"
                >
                  {language === "ar" ? "العودة للرئيسية" : "Back to Home"}
                </a>
                <a
                  href="/rooms"
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 px-6 py-3 font-medium text-black transition-all hover:from-amber-400 hover:to-yellow-300"
                >
                  {language === "ar" ? "استكشف المزيد" : "Explore More"}
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

export default function EliteIntelligencePage() {
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" />
          </main>
        }
      >
        <EliteIntelligenceContent />
      </Suspense>
      <Footer />
    </>
  );
}
