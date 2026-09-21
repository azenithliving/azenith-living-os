"use client";
import React, { useEffect, useState, useCallback } from "react";
import useSessionStore from "@/stores/useSessionStore";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";

type SlideStat = {
  label: string;
  value: string;
  labelEn?: string;
  valueEn?: string;
};

export type VideoStateChangeDetail = {
  currentIndex: number;
  videoReady: boolean;
  isExiting: boolean;
  pillar: string;
  poeticTitle: string;
  subtitle: string;
  stats: ReadonlyArray<SlideStat>;
  cta: string;
  ariaLabel: string;
};

declare global {
  interface WindowEventMap {
    videoStateChange: CustomEvent<VideoStateChangeDetail>;
  }
}

// Vercel Blob URLs for production, local paths for development
const isDev = process.env.NODE_ENV === 'development';
const BLOB_BASE = "https://ovnuuxdhjjkfsk6k.public.blob.vercel-storage.com/videos";

export const slides = [
  {
    id: 1,
    video: `${BLOB_BASE}/hero-1.mp4`,
    pillar: "DISCOVERY",
    title: "ابدأ من فهم المساحة",
    poeticTitle: "ابدأ من فهم المساحة",
    poeticTitleEn: "Start by Understanding Your Space",
    description: "شارك احتياجاتك وطابع المساحة والميزانية التقريبية لننظم طلب التصميم.",
    descriptionEn: "Share your needs, space style, and approximate budget to organize your design request.",
    cta: "ابدأ طلب تصميم",
    ctaEn: "Start a Design Request",
    ariaLabel: "ابدأ من فهم المساحة",
    ariaLabelEn: "Start by Understanding Your Space",
    stats: [
      { label: "الخطوة", value: "فهم المساحة", labelEn: "Step", valueEn: "Understand the space" },
      { label: "المدخلات", value: "طابع وميزانية", labelEn: "Inputs", valueEn: "Style and budget" },
      { label: "النتيجة", value: "طلب منظم", labelEn: "Outcome", valueEn: "An organized request" },
    ],
  },
  {
    id: 2,
    video: `${BLOB_BASE}/hero-2.mp4`,
    pillar: "MATERIALS",
    title: "اختيارات واضحة للخامات",
    poeticTitle: "اختيارات واضحة للخامات",
    poeticTitleEn: "Clear Material Choices",
    description: "نناقش خيارات الخامات والتشطيبات المناسبة ضمن نطاق العمل المتفق عليه.",
    descriptionEn: "We discuss material and finish options that fit the agreed scope of work.",
    cta: "استكشف المساحات",
    ctaEn: "Explore Spaces",
    ariaLabel: "اختيارات واضحة للخامات",
    ariaLabelEn: "Clear Material Choices",
    stats: [
      { label: "الخامات", value: "خيارات قابلة للنقاش", labelEn: "Materials", valueEn: "Options to discuss" },
      { label: "التشطيب", value: "وفق الاختيار", labelEn: "Finishes", valueEn: "Based on selection" },
      { label: "النطاق", value: "يُحدد مع الطلب", labelEn: "Scope", valueEn: "Defined with the request" },
    ],
  },
  {
    id: 3,
    video: `${BLOB_BASE}/hero-3.mp4`,
    pillar: "DESIGN",
    title: "تصميم يناسب احتياجاتك",
    poeticTitle: "تصميم يناسب احتياجاتك",
    poeticTitleEn: "Design Around Your Needs",
    description: "نستعرض الاتجاهات والوظائف التي تهمك قبل تحديد ما يناسب المساحة.",
    descriptionEn: "We review the styles and functions that matter to you before defining what fits the space.",
    cta: "ابدأ رحلة التصميم",
    ctaEn: "Start Design Journey",
    ariaLabel: "تصميم يناسب احتياجاتك",
    ariaLabelEn: "Design Around Your Needs",
    stats: [
      { label: "الأسلوب", value: "وفق تفضيلاتك", labelEn: "Style", valueEn: "Your preferences" },
      { label: "الوظيفة", value: "حسب الاستخدام", labelEn: "Function", valueEn: "How you use it" },
      { label: "المراجعة", value: "قبل اعتماد النطاق", labelEn: "Review", valueEn: "Before scope approval" },
    ],
  },
  {
    id: 4,
    video: `${BLOB_BASE}/hero-4.mp4`,
    pillar: "PROCESS",
    title: "من الفكرة إلى نطاق عمل",
    poeticTitle: "من الفكرة إلى نطاق عمل",
    poeticTitleEn: "From an Idea to a Scope of Work",
    description: "نحدد الخطوات والمعلومات المطلوبة قبل الانتقال إلى أي مرحلة تنفيذ.",
    descriptionEn: "We define the steps and information required before moving to any delivery stage.",
    cta: "ابدأ طلب تصميم",
    ctaEn: "Start a Design Request",
    ariaLabel: "من الفكرة إلى نطاق عمل",
    ariaLabelEn: "From an Idea to a Scope of Work",
    stats: [
      { label: "المناقشة", value: "المتطلبات", labelEn: "Discussion", valueEn: "Requirements" },
      { label: "الطلب", value: "الخيارات المتاحة", labelEn: "Request", valueEn: "Available options" },
      { label: "الخطوة التالية", value: "حسب المراجعة", labelEn: "Next step", valueEn: "After review" },
    ],
  },
  {
    id: 5,
    video: `${BLOB_BASE}/hero-5.mp4`,
    pillar: "SPACES",
    title: "أفكار لمساحات سكنية",
    poeticTitle: "أفكار لمساحات سكنية",
    poeticTitleEn: "Ideas for Residential Spaces",
    description: "اطلع على فئات المساحات لتبدأ من نقطة تناسب مشروعك.",
    descriptionEn: "Browse space categories to start from a point that suits your project.",
    cta: "استكشف المساحات",
    ctaEn: "Explore Spaces",
    ariaLabel: "أفكار لمساحات سكنية",
    ariaLabelEn: "Ideas for Residential Spaces",
    stats: [
      { label: "الفئات", value: "غرف متعددة", labelEn: "Categories", valueEn: "Multiple rooms" },
      { label: "الاختيار", value: "حسب الاحتياج", labelEn: "Selection", valueEn: "By need" },
      { label: "البداية", value: "من طلبك", labelEn: "Start", valueEn: "From your request" },
    ],
  },
  {
    id: 6,
    video: `${BLOB_BASE}/hero-6.mp4`,
    pillar: "DETAILS",
    title: "تفاصيل تُناقش في الاستشارة",
    poeticTitle: "تفاصيل تُناقش في الاستشارة",
    poeticTitleEn: "Details Discussed in Consultation",
    description: "نرتب أولويات الراحة والخامات والميزانية قبل تقديم أي نطاق عمل.",
    descriptionEn: "We arrange priorities for comfort, materials, and budget before proposing any scope of work.",
    cta: "ابدأ طلب تصميم",
    ctaEn: "Start a Design Request",
    ariaLabel: "تفاصيل تُناقش في الاستشارة",
    ariaLabelEn: "Details Discussed in Consultation",
    stats: [
      { label: "الأولوية", value: "ما يهمك", labelEn: "Priority", valueEn: "What matters to you" },
      { label: "التفاصيل", value: "قابلة للمراجعة", labelEn: "Details", valueEn: "Open for review" },
      { label: "المخرجات", value: "نطاق واضح", labelEn: "Output", valueEn: "A clear scope" },
    ],
  },
] satisfies Array<{
  id: number;
  video: string;
  pillar: string;
  title: string;
  poeticTitle: string;
  poeticTitleEn: string;
  description: string;
  descriptionEn: string;
  cta: string;
  ctaEn: string;
  ariaLabel: string;
  ariaLabelEn: string;
  stats: SlideStat[];
}>;


export default function AzenithLegacy() {
  const currentLang = useSessionStore((state) => state.language);
  const isRTL = currentLang === "ar";
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videoError, setVideoError] = useState<Record<number, boolean>>({});

  const handleVideoError = useCallback((slideId: number) => {
    console.warn(`[AzenithLegacy] Video failed to load for slide ${slideId}, using fallback image`);
    setVideoError(prev => ({ ...prev, [slideId]: true }));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 9000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const slide = slides[currentIndex];
    const event = new CustomEvent<VideoStateChangeDetail>("videoStateChange", {
      detail: {
        currentIndex,
        videoReady: true,
        isExiting: false,
        pillar: slide.pillar,
        poeticTitle: isRTL ? slide.poeticTitle : slide.poeticTitleEn,
        subtitle: isRTL ? slide.description : slide.descriptionEn,
        stats: slide.stats.map((s: any) => ({
          label: isRTL ? s.label : s.labelEn,
          value: isRTL ? s.value : s.valueEn
        })),
        cta: isRTL ? slide.cta : slide.ctaEn,
        ariaLabel: isRTL ? slide.ariaLabel : slide.ariaLabelEn,
      },
    });

    window.dispatchEvent(event);
  }, [currentIndex, isRTL]);

  return (
    <div className="absolute inset-0">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 h-full w-full"
          style={{
            background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
          }}
        >
          {videoError[slides[currentIndex].id] ? (
            <Image
              src="/images/room-placeholder.jpg"
              alt={slides[currentIndex].ariaLabel}
              fill
              className="absolute inset-0 z-0 object-cover"
              priority
            />
          ) : (
            <video
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 z-0 h-full w-full object-cover"
              src={slides[currentIndex].video}
              onError={() => handleVideoError(slides[currentIndex].id)}
            />
          )}

          <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/50 via-transparent to-black/70" />
          <div className="absolute inset-0 z-10 bg-black/20 backdrop-blur-[1px]" />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
