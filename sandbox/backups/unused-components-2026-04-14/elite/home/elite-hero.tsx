"use client";

/**
 * ELITE HERO COMPONENT
 * Premium hero section for Elite Homepage
 * 
 * CLASSIFICATION: EXTEND
 * Extends existing Hero component with Elite-specific features
 * - Personalized greeting
 * - Smart CTA buttons
 * - Project status preview
 * - Premium visual treatment
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Zap, Sparkles } from "lucide-react";
import type { SmartCTA, ProjectInsight } from "@/lib/elite/feature-engine";

interface EliteHeroProps {
  greeting: string;
  primaryCTA: SmartCTA;
  secondaryCTAs: SmartCTA[];
  alertMessage: string | null;
  encouragementMessage: string | null;
  showUrgency: boolean;
  showImpact: boolean;
  showCelebration: boolean;
  insight?: ProjectInsight;
}

export function EliteHero({
  greeting,
  primaryCTA,
  secondaryCTAs,
  alertMessage,
  encouragementMessage,
  showUrgency,
  showImpact,
  showCelebration,
  insight,
}: EliteHeroProps) {
  const getCTAIcon = (type: SmartCTA["type"]) => {
    switch (type) {
      case "continue_project":
        return <ArrowLeft className="h-5 w-5" />;
      case "view_progress":
        return <Sparkles className="h-5 w-5" />;
      case "pay_installment":
        return <Zap className="h-5 w-5" />;
      default:
        return <ArrowLeft className="h-5 w-5" />;
    }
  };

  const getCTALink = (type: SmartCTA["type"]) => {
    switch (type) {
      case "continue_project":
        return "/elite/dashboard";
      case "view_progress":
        return "/elite/dashboard";
      case "pay_installment":
        return "/elite/dashboard?tab=payments";
      case "schedule_meeting":
        return "/elite/dashboard?tab=meetings";
      case "contact_support":
        return "/contact";
      default:
        return "/elite/dashboard";
    }
  };

  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden pt-20">
      {/* Premium Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A] via-[#1A1A1B] to-[#0A0A0A]" />
      
      {/* Animated Gold Accent */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(197,160,89,0.15) 0%, transparent 70%)",
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(229,193,112,0.1) 0%, transparent 70%)",
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />

      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        {/* Personalized Greeting */}
        <motion.h1
          initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-4xl md:text-6xl lg:text-7xl font-serif text-white font-bold mb-6 leading-tight"
        >
          {greeting}
        </motion.h1>

        {/* Alert Message (if any) */}
        {alertMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className={`mb-8 p-4 rounded-2xl inline-flex items-center gap-3 ${
              showUrgency 
                ? "bg-red-500/10 border border-red-500/30 text-red-200" 
                : showImpact
                ? "bg-amber-500/10 border border-amber-500/30 text-amber-200"
                : "bg-[#C5A059]/10 border border-[#C5A059]/30 text-[#E5C170]"
            }`}
          >
            <AlertCircle className={`h-5 w-5 ${showUrgency ? "text-red-400" : showImpact ? "text-amber-400" : "text-[#C5A059]"}`} />
            <span className="font-medium">{alertMessage}</span>
          </motion.div>
        )}

        {/* Project Status Preview (if available) */}
        {insight && insight.progressPercentage > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mb-8 max-w-md mx-auto"
          >
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex justify-between text-white/60 text-sm mb-2">
                <span>تقدم المشروع</span>
                <span>{insight.progressPercentage}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    showCelebration 
                      ? "bg-gradient-to-r from-[#C5A059] via-[#E5C170] to-[#C5A059]" 
                      : "bg-gradient-to-r from-[#C5A059] to-[#E5C170]"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${insight.progressPercentage}%` }}
                  transition={{ duration: 1.2, delay: 0.6, ease: "easeOut" }}
                />
              </div>
              {insight.nextMilestone && (
                <p className="text-white/50 text-sm mt-3">المرحلة القادمة: {insight.nextMilestone}</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Encouragement Message */}
        {encouragementMessage && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-white/70 text-lg md:text-xl mb-10 max-w-2xl mx-auto"
          >
            {encouragementMessage}
          </motion.p>
        )}

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <Link
            href={getCTALink(primaryCTA.type)}
            className={`group inline-flex items-center gap-3 px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 ${
              primaryCTA.urgency
                ? "bg-gradient-to-r from-red-500 to-red-600 text-white hover:shadow-[0_0_30px_rgba(239,68,68,0.4)]"
                : showCelebration
                ? "bg-gradient-to-r from-[#C5A059] via-[#E5C170] to-[#C5A059] text-black hover:shadow-[0_0_30px_rgba(197,160,89,0.4)]"
                : "bg-gradient-to-r from-[#C5A059] to-[#E5C170] text-black hover:shadow-[0_0_30px_rgba(197,160,89,0.4)]"
            }`}
          >
            {getCTAIcon(primaryCTA.type)}
            <span>{primaryCTA.label}</span>
          </Link>
          <p className="text-white/50 text-sm mt-3">{primaryCTA.description}</p>
        </motion.div>

        {/* Secondary CTAs */}
        {secondaryCTAs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="flex flex-wrap justify-center gap-4 mt-8"
          >
            {secondaryCTAs.slice(0, 2).map((cta, index) => (
              <Link
                key={cta.type}
                href={getCTALink(cta.type)}
                className="px-6 py-3 rounded-full border border-white/20 text-white/80 hover:border-[#C5A059]/50 hover:text-white transition-all duration-300 text-sm font-medium"
              >
                {cta.label}
              </Link>
            ))}
          </motion.div>
        )}
      </div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0A0A0A] to-transparent" />
    </section>
  );
}
