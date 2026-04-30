"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { EliteIntelligenceForm, FormData, LeadQualification } from "@/components/elite/EliteIntelligenceForm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

/**
 * Elite Brief Page
 * Context-Aware Multi-Step Form with Egyptian Market Adaptation
 */

function EliteBriefContent() {
  const searchParams = useSearchParams();
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
          style: "elite-brief",
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
        throw new Error(result.message || "Failed to submit brief");
      }

      setSubmitted(true);

      // Clear viewed images after successful submission
      localStorage.removeItem("azenith_viewed_images");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Submission failed");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a]">
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <p className="text-sm uppercase tracking-[0.28em] text-amber-400/70">
            Azenith Elite Intelligence
          </p>
          <h1 className="mt-4 font-serif text-4xl text-white md:text-5xl lg:text-6xl">
            Design Your Vision
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
            Complete this brief and our consultants will craft a personalized concept
            portfolio based on your Style DNA
          </p>
        </motion.div>

        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-auto max-w-xl rounded-2xl border border-amber-400/30 bg-gradient-to-b from-amber-500/10 to-yellow-400/5 p-8 text-center"
          >
            <div className="mb-4 text-6xl">✨</div>
            <h2 className="text-2xl font-semibold text-white">Brief Submitted Successfully</h2>
            <p className="mt-4 text-white/70">
              Our consultants are analyzing your Style DNA and preparing your
              personalized concept portfolio.
            </p>
            <p className="mt-4 text-sm text-amber-300/80">
              You will receive your "Azenith Design Concepts" PDF within 24 hours.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <a
                href="/"
                className="rounded-xl bg-white/10 px-6 py-3 text-white transition-colors hover:bg-white/20"
              >
                Back to Home
              </a>
              <a
                href="/rooms"
                className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 px-6 py-3 font-medium text-black transition-all hover:from-amber-400 hover:to-yellow-300"
              >
                Explore More Designs
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
                  <span className="font-semibold">📸 Style DNA Source:</span> You viewed{" "}
                  {viewedImages.length} design images. Our AI will analyze your
                  preferences to generate personalized recommendations.
                </p>
              </motion.div>
            )}

            <EliteIntelligenceForm
              onSubmit={handleSubmit}
              viewedImages={viewedImages}
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
