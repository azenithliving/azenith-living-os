"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import { ArrowLeft, Check } from "lucide-react";
import { useRouter } from "next/navigation";

import { roomDefinitions } from "@/lib/site-content";
import useSessionStore from "@/stores/useSessionStore";

interface SiteConfig {
  heroTitle: string;
  heroSubtitle: string;
  budgetOptions: string[];
  styleOptions: string[];
  serviceOptions: string[];
}

const defaultConfig: SiteConfig = {
  heroTitle: "ابدأ رحلة التصميم الذكي.",
  heroSubtitle: "أربع اختيارات فقط تكفي لبناء ملف العميل، تقدير مبدئي، ورسالة واتساب جاهزة للفريق التجاري.",
  budgetOptions: [
    "2,500 - 5,500 EGP",
    "5,500 - 12,000 EGP",
    "12,000 - 25,000 EGP",
    "25,000+ EGP"
  ],
  styleOptions: [
    "مودرن دافئ",
    "هادئ فاخر",
    "عملي مع لمسة فندقية",
    "صناعي ناعم"
  ],
  serviceOptions: [
    "تصميم فقط",
    "تصميم وتجهيز",
    "تصميم وتنفيذ",
    "تجديد لمساحة قائمة"
  ]
};

export default function StartPage() {
  const router = useRouter();
  const roomType = useSessionStore((state) => state.roomType);
  const budget = useSessionStore((state) => state.budget);
  const style = useSessionStore((state) => state.style);
  const serviceType = useSessionStore((state) => state.serviceType);
  const updateProfile = useSessionStore((state) => state.updateProfile);
  const trackEvent = useSessionStore((state) => state.trackEvent);
  
  const [stepIndex, setStepIndex] = useState(0);
  const [config, setConfig] = useState<SiteConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  // Load dynamic config from CMS
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch("/api/cms/public-config");
        if (response.ok) {
          const data = await response.json();
          if (data.config) {
            setConfig({ ...defaultConfig, ...data.config });
          }
        }
      } catch (err) {
        console.error("Failed to load config:", err);
      } finally {
        setLoading(false);
      }
    };
    
    loadConfig();
  }, []);

  const steps = useMemo(() => [
    { key: "roomType", title: "اختر نوع المساحة", options: roomDefinitions.map((room) => room.title) },
    { key: "budget", title: "حدد نطاق الميزانية", options: config.budgetOptions },
    { key: "style", title: "ما الطابع الأقرب لك؟", options: config.styleOptions },
    { key: "serviceType", title: "ما نوع الخدمة المطلوبة؟", options: config.serviceOptions },
  ], [config]);

  useEffect(() => {
    updateProfile({ lastPage: "/start" });
    trackEvent("page_view");
  }, [trackEvent, updateProfile]);

  const selections = useMemo(() => ({ roomType, budget, style, serviceType }), [budget, roomType, serviceType, style]);
  const currentStep = steps[stepIndex];
  const currentValue = selections[currentStep.key as keyof typeof selections];
  const progress = ((stepIndex + 1) / steps.length) * 100;

  const selectValue = (value: string) => {
    updateProfile({ [currentStep.key]: value });
    trackEvent("stepper_select");
  };

  const goNext = () => {
    if (!currentValue) return;
    trackEvent(stepIndex === steps.length - 1 ? "stepper_complete" : "stepper_next");
    if (stepIndex === steps.length - 1) {
      startTransition(() => router.push("/request"));
      return;
    }
    setStepIndex((current) => current + 1);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="px-6 py-12 md:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-primary/70">Qualification flow</p>
          <h1 className="font-serif text-4xl text-white md:text-6xl">{config.heroTitle}</h1>
          <p className="max-w-2xl text-base leading-8 text-white/65">{config.heroSubtitle}</p>
        </div>

        <div className="mb-10 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div className="h-full rounded-full bg-brand-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="grid gap-12 lg:grid-cols-[0.72fr_0.28fr]">
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-brand-primary">الخطوة {stepIndex + 1} من {steps.length}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white md:text-3xl">{currentStep.title}</h2>
              </div>
              {stepIndex > 0 ? (
                <button type="button" onClick={() => setStepIndex((current) => Math.max(0, current - 1))} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-brand-primary hover:text-brand-primary">
                  <ArrowLeft className="h-4 w-4" />
                  رجوع
                </button>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {currentStep.options.map((option) => {
                const isActive = currentValue === option;
                return (
                  <button key={option} type="button" onClick={() => selectValue(option)} className={`rounded-[1.75rem] border p-5 text-right transition ${isActive ? "border-brand-primary bg-brand-primary/[0.1] text-white" : "border-white/10 bg-white/[0.03] text-white/72 hover:border-white/20"}`}>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-base font-medium">{option}</span>
                      {isActive ? (
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-brand-accent">
                          <Check className="h-4 w-4" />
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <button type="button" onClick={goNext} disabled={!currentValue} className="inline-flex items-center gap-3 rounded-full bg-brand-primary px-7 py-4 text-base font-semibold text-brand-accent transition hover:bg-[#d8b56d] disabled:cursor-not-allowed disabled:opacity-40">
              {stepIndex === steps.length - 1 ? "انتقل إلى الطلب" : "التالي"}
              <ArrowLeft className="h-5 w-5" />
            </button>
          </section>

          <aside className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
            <p className="text-sm text-brand-primary">الملف الحالي</p>
            <div className="mt-6 space-y-5 text-sm text-white/72">
              <div><p className="text-white/45">المساحة</p><p className="mt-1 text-base text-white">{roomType || "لم يتم الاختيار بعد"}</p></div>
              <div><p className="text-white/45">الميزانية</p><p className="mt-1 text-base text-white">{budget || "لم يتم الاختيار بعد"}</p></div>
              <div><p className="text-white/45">الطابع</p><p className="mt-1 text-base text-white">{style || "لم يتم الاختيار بعد"}</p></div>
              <div><p className="text-white/45">الخدمة</p><p className="mt-1 text-base text-white">{serviceType || "لم يتم الاختيار بعد"}</p></div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
