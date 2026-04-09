"use client";
import React, { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";

type SlideStat = {
  label: string;
  value: string;
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

export const slides = [
  {
    id: 1,
    video: "/videos/hero-1.mp4",
    pillar: "HERITAGE",
    title: "إرث الخبرة في كل قطعة",
    poeticTitle: "إرث الخبرة في كل قطعة",
    description: "خبرة متوارثة منذ 1974 تتجسد في أثاث فاخر صُمم ليبقى، ويليق بمساحتك العربية الأصيلة.",
    cta: "اكتشف إرثنا",
    ariaLabel: "إرث الخبرة في كل قطعة",
    stats: [
      { label: "الإرث", value: "منذ 1974" },
      { label: "الهوية", value: "عربي أصيل" },
      { label: "الوعد", value: "قطع تدوم" },
    ],
  },
  {
    id: 2,
    video: "/videos/hero-2.mp4",
    pillar: "COMMITMENT",
    title: "صلابة الخشب الطبيعي",
    poeticTitle: "صلابة الخشب الطبيعي",
    description: "خامات مختارة بعناية، تشطيبات دقيقة، والتزام يضمن أثاثًا يعمّر لسنوات طويلة.",
    cta: "تعرف على جودتنا",
    ariaLabel: "صلابة الخشب الطبيعي",
    stats: [
      { label: "الخامة", value: "خشب طبيعي" },
      { label: "التشطيب", value: "دقة يدوية" },
      { label: "الضمان", value: "ثلاث سنوات" },
    ],
  },
  {
    id: 3,
    video: "/videos/hero-3.mp4",
    pillar: "INNOVATION",
    title: "تصميم عصري مبتكر",
    poeticTitle: "تصميم عصري مبتكر",
    description: "رؤية حديثة تمزج بين الجمال والوظيفة لتمنحك مساحات راقية تناسب أسلوب حياتك.",
    cta: "ابدأ رحلة التصميم",
    ariaLabel: "تصميم عصري مبتكر",
    stats: [
      { label: "الأسلوب", value: "مودرن راقٍ" },
      { label: "الوظيفة", value: "حلول ذكية" },
      { label: "التجربة", value: "تفصيل مخصص" },
    ],
  },
  {
    id: 4,
    video: "/videos/hero-4.mp4",
    pillar: "SYNERGY",
    title: "تحالف اليد والآلة",
    poeticTitle: "تحالف اليد والآلة",
    description: "تقنيات تصنيع دقيقة ولمسات يدوية خبيرة تضمن تنفيذًا متوازنًا بين الفن والهندسة.",
    cta: "اكتشف طريقة التنفيذ",
    ariaLabel: "تحالف اليد والآلة",
    stats: [
      { label: "التصنيع", value: "رقمي دقيق" },
      { label: "الدمج", value: "يد + آلة" },
      { label: "النتيجة", value: "دقة فاخرة" },
    ],
  },
  {
    id: 5,
    video: "/videos/hero-5.mp4",
    pillar: "TRUST",
    title: "ثقة في أرقى الوحدات",
    poeticTitle: "ثقة في أرقى الوحدات",
    description: "من مشروعات سكنية خاصة إلى مساحات عائلية راقية، نبني الثقة عبر الجودة والانضباط.",
    cta: "استكشف المساحات",
    ariaLabel: "ثقة في أرقى الوحدات",
    stats: [
      { label: "العملاء", value: "سكني فاخر" },
      { label: "المعيار", value: "تنفيذ منضبط" },
      { label: "الأثر", value: "ثقة مستمرة" },
    ],
  },
  {
    id: 6,
    video: "/videos/hero-6.mp4",
    pillar: "QUALITY",
    title: "رفاهية مطلقة",
    poeticTitle: "رفاهية مطلقة",
    description: "تفاصيل مريحة، خامات راقية، وتجربة استخدام تمنحك شعور الرفاهية كل يوم.",
    cta: "استكشف الجودة",
    ariaLabel: "رفاهية مطلقة",
    stats: [
      { label: "الإحساس", value: "راحة كاملة" },
      { label: "الخامة", value: "لمسة فاخرة" },
      { label: "الوعد", value: "رفاهية مطلقة" },
    ],
  },
] as const;

export default function AzenithLegacy() {
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
        poeticTitle: slide.poeticTitle,
        subtitle: slide.description,
        stats: slide.stats,
        cta: slide.cta,
        ariaLabel: slide.ariaLabel,
      },
    });

    window.dispatchEvent(event);
  }, [currentIndex]);

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
