"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { EliteIntelligenceForm, FormData, LeadQualification } from "@/components/elite/EliteIntelligenceForm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { isArabic, useSiteLanguage } from "@/hooks/useSiteLanguage";
import { arabicNumerals } from "@/lib/arabic";

/**
 * The brief's own words. Measured 2026-10-09 on the published store: an Egyptian customer who came
 * from an Arabic page walked into an English screen — the form underneath had an Arabic layer all
 * along, and this page never asked the store which language he reads in.
 */
const COPY = {
  ar: {
    eyebrow: "أزينث — تجربة النخبة",
    title: "صمم رؤيتك",
    line: "كمّل كراسة الطلب وهنجهّز تصميم على مقاسك: المساحة والميزانية والذوق.",
    inspiration: (count: number) => `📸 مصدر ذوقك: شفت ${arabicNumerals(count)} صورة تصميم`,
    savedTitle: "تم استلام طلبك بنجاح",
    savedLine: "اللي كتبته اتسجّل، وهيراجعه فريق التصميم.",
    failed: "في مشكلة مؤقتة في حفظ طلبك، جرّب بعد شوية.",
    home: "العودة للرئيسية",
    rooms: "شوف المزيد من التصاميم",
  },
  en: {
    eyebrow: "Azenith — Elite Experience",
    title: "Design Your Vision",
    line: "Complete this brief so the design team can review your space, budget, and preferences.",
    inspiration: (count: number) => `📸 Your taste source: you viewed ${count} designs`,
    savedTitle: "Brief Submitted Successfully",
    savedLine: "Your brief has been saved for the design team to review.",
    failed: "We could not save your brief just now — please try again.",
    home: "Back to Home",
    rooms: "Explore More Designs",
  },
};

/**
 * Elite Brief Page
 * Context-Aware Multi-Step Form with Egyptian Market Adaptation
 */

function EliteBriefContent() {
  const searchParams = useSearchParams();
  // One owner for the language he reads in — the store's setting, which the header switcher writes
  // and every other page obeys. See `hooks/useSiteLanguage`.
  const language = useSiteLanguage();
  const ar = isArabic(language);
  const L = ar ? COPY.ar : COPY.en;
  const [sessionId] = useState(() => crypto.randomUUID());
  const [viewedImages, setViewedImages] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Get viewed images from URL params (passed from gallery)
  useEffect(() => {
    const images = searchParams?.get("viewed");
    if (images) {
      setViewedImages(images.split(",").filter(Boolean));
    }

    // Also check localStorage for viewed images
    const stored = localStorage.getItem("azenith_viewed_images");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setViewedImages((prev) => [...new Set([...prev, ...parsed])].slice(0, 20));
      } catch {
        // Ignore parse errors
      }
    }
  }, [searchParams]);

  const handleSubmit = async (
    data: FormData & { qualification: LeadQualification }
  ) => {
    setSubmitError(null);

    try {
      const response = await fetch("/api/elite-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          fullName: data.fullName,
          phone: data.phone,
          email: data.email,
          roomType: data.scope,
          budget: data.budget,
          style: data.style ?? "",
          area: data.area ?? "",
          serviceType: data.timeline,
          notes: data.specialRequests,
          viewedImages,
          qualification: data.qualification,
          blueprintAvailable: data.blueprintAvailable,
          specialRequests: data.specialRequests,
          score: data.qualification.score,
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.message || L.failed);
      }

      setSubmitted(true);

      // Clear viewed images after successful submission
      localStorage.removeItem("azenith_viewed_images");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : L.failed);
    }
  };

  return (
    <main dir={ar ? "rtl" : "ltr"} className={`min-h-screen bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] ${ar ? "rtl" : "ltr"}`}>
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <p className={`text-sm text-amber-400/70 ${ar ? "text-base" : "uppercase tracking-[0.28em]"}`}>
            {L.eyebrow}
          </p>
          <h1 className="mt-4 font-serif text-4xl text-white md:text-5xl lg:text-6xl">
            {L.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
            {L.line}
          </p>
        </motion.div>

        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-auto max-w-xl rounded-2xl border border-amber-400/30 bg-gradient-to-b from-amber-500/10 to-yellow-400/5 p-8 text-center"
          >
            <div className="mb-4 text-6xl">✨</div>
            <h2 className="text-2xl font-semibold text-white">{L.savedTitle}</h2>
            <p className="mt-4 text-white/70">
              {L.savedLine}
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <a
                href="/"
                className="rounded-xl bg-white/10 px-6 py-3 text-white transition-colors hover:bg-white/20"
              >
                {L.home}
              </a>
              <a
                href="/rooms"
                className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 px-6 py-3 font-medium text-black transition-all hover:from-amber-400 hover:to-yellow-300"
              >
                {L.rooms}
              </a>
            </div>
          </motion.div>
        ) : (
          <>
            {submitError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-center"
              >
                <p className="text-red-300">{submitError}</p>
              </motion.div>
            )}

            {/* Viewed Images Summary */}
            {viewedImages.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mx-auto mb-8 max-w-2xl rounded-xl border border-amber-400/20 bg-amber-500/5 p-4"
              >
                <p className="text-sm text-amber-300/80">
                  {L.inspiration(viewedImages.length)}
                </p>
              </motion.div>
            )}

            <EliteIntelligenceForm
              onSubmit={handleSubmit}
              viewedImages={viewedImages}
              language={language}
              className="mx-auto"
            />
          </>
        )}
      </div>
    </main>
  );
}

export default function EliteBriefPage() {
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
        <EliteBriefContent />
      </Suspense>
      <Footer />
    </>
  );
}
