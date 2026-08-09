"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, LoaderCircle, MessageCircle, ChevronLeft, ChevronRight, Check } from "lucide-react";
import Link from "next/link";

import { buildWhatsAppUrl } from "@/lib/conversion-engine";
import type { RuntimeConfig } from "@/lib/runtime-config";
import useSessionStore from "@/stores/useSessionStore";

type RequestPageClientProps = {
  runtimeConfig: RuntimeConfig;
};

type LeadApiResponse = { ok: boolean; message?: string };

// Choice Constants with Arabic and English Translations
const PROPERTY_TYPES = [
  { value: "apartment", labelAr: "شقة", labelEn: "Apartment" },
  { value: "villa", labelAr: "فيلا", labelEn: "Villa" },
  { value: "commercial", labelAr: "مكتب / تجاري", labelEn: "Office / Commercial" },
  { value: "chalet", labelAr: "شاليه", labelEn: "Chalet" },
  { value: "other", labelAr: "نوع آخر (اكتب يدوياً)", labelEn: "Other (Write manually)" }
];

const PROPERTY_STATUSES = [
  { value: "raw", labelAr: "على المحارة / طوب أحمر", labelEn: "Raw Shell / Brick" },
  { value: "semi", labelAr: "نصف تشطيب", labelEn: "Semi-finished" },
  { value: "full_needs_renovation", labelAr: "تشطيب كامل يحتاج تجديد", labelEn: "Fully finished (Needs Renovation)" },
  { value: "turnkey", labelAr: "تسليم مفتاح جاهز للتأثيث", labelEn: "Turnkey" },
  { value: "other", labelAr: "حالة أخرى (اكتب يدوياً)", labelEn: "Other (Write manually)" }
];

const BUDGET_GRADES = [
  { value: "premium", labelAr: "فئة متميزة (Premium) - تشطيب راقٍ بميزانية مدروسة", labelEn: "Premium - Elegant design with calculated budget" },
  { value: "luxury", labelAr: "فئة فاخرة (Luxury) - خامات وتفاصيل مخصصة مستوردة", labelEn: "Luxury - Imported materials and custom details" },
  { value: "ultra", labelAr: "فئة النخبة (Ultra-Luxury) - فيلات وقصور ومواصفات خاصة جداً", labelEn: "Ultra-Luxury - Palaces, villas, unique specifications" },
  { value: "other", labelAr: "ميزانية محددة أخرى (اكتب يدوياً)", labelEn: "Other specification (Write manually)" }
];

const TIMELINES = [
  { value: "urgent", labelAr: "عاجل (خلال شهرين)", labelEn: "Urgent (Within 2 months)" },
  { value: "medium", labelAr: "متوسط (3 - 6 أشهر)", labelEn: "Medium (3 - 6 months)" },
  { value: "future", labelAr: "تخطيط مستقبلي (أكثر من 6 أشهر)", labelEn: "Future Planning (6+ months)" },
  { value: "other", labelAr: "موعد آخر (اكتب يدوياً)", labelEn: "Other timeline (Write manually)" }
];

const STYLES = [
  { value: "modern", labelAr: "مودرن (Modern)", labelEn: "Modern" },
  { value: "classic", labelAr: "نيوكلاسيك / كلاسيك", labelEn: "Classic / Neo-Classic" },
  { value: "warm_modern", labelAr: "مودرن دافئ (Warm Modern)", labelEn: "Warm Modern" },
  { value: "industrial", labelAr: "صناعي / بوهيمي", labelEn: "Industrial / Bohemian" },
  { value: "other", labelAr: "أسلوب وتفضيل آخر (اكتب يدوياً)", labelEn: "Other Style (Write manually)" }
];

const FOCUSES = [
  { value: "quality", labelAr: "فخامة وجودة الخامات والتشطيب الفاخر", labelEn: "Luxury & premium finish quality" },
  { value: "speed", labelAr: "سرعة التسليم والالتزام بالجدول الزمني", labelEn: "Speed of delivery and timeline" },
  { value: "space", labelAr: "الاستغلال الذكي للمساحات وحلول التخزين", labelEn: "Smart space layout and storage" },
  { value: "other", labelAr: "أولوية وهدف آخر (اكتب يدوياً)", labelEn: "Other priority (Write manually)" }
];

const SPACES = [
  { value: "living", labelAr: "غرف المعيشة", labelEn: "Living Rooms" },
  { value: "bedroom", labelAr: "غرف النوم", labelEn: "Bedrooms" },
  { value: "kitchen", labelAr: "المطابخ", labelEn: "Kitchens" },
  { value: "bathroom", labelAr: "الحمامات", labelEn: "Bathrooms" },
  { value: "landscape", labelAr: "لاندسكيب / حديقة", labelEn: "Landscape / Garden" },
  { value: "full_house", labelAr: "المنزل بالكامل", labelEn: "Full Home" },
  { value: "other", labelAr: "فراغات أخرى (اكتب يدوياً)", labelEn: "Other spaces (Write manually)" }
];

export default function RequestPageClient({ runtimeConfig }: RequestPageClientProps) {
  const sessionId = useSessionStore((state) => state.sessionId);
  const score = useSessionStore((state) => state.score);
  const intent = useSessionStore((state) => state.intent);
  
  // Reading telemetry background interest if it exists
  const initialRoomType = useSessionStore((state) => state.roomType);
  const initialStyle = useSessionStore((state) => state.style);
  
  const updateProfile = useSessionStore((state) => state.updateProfile);
  const trackEvent = useSessionStore((state) => state.trackEvent);
  const currentLang = useSessionStore((state) => state.language);
  const isRTL = currentLang === "ar";

  // Step state
  const [currentStep, setCurrentStep] = useState(1);

  // Brief Builder Form State
  const [propertyType, setPropertyType] = useState("");
  const [propertyTypeOther, setPropertyTypeOther] = useState("");

  const [propertyStatus, setPropertyStatus] = useState("");
  const [propertyStatusOther, setPropertyStatusOther] = useState("");

  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
  const [spacesOther, setSpacesOther] = useState("");

  const [budgetGrade, setBudgetGrade] = useState("");
  const [budgetGradeOther, setBudgetGradeOther] = useState("");

  const [timeline, setTimeline] = useState("");
  const [timelineOther, setTimelineOther] = useState("");

  const [preferredStyle, setPreferredStyle] = useState(initialStyle ? "modern" : ""); // default to modern if we have telemetry
  const [preferredStyleOther, setPreferredStyleOther] = useState("");

  const [primaryFocus, setPrimaryFocus] = useState("");
  const [primaryFocusOther, setPrimaryFocusOther] = useState("");

  // Contact State
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Load telemetry tags on mount
  useEffect(() => {
    updateProfile({ lastPage: "/request" });
    trackEvent("page_view");
    trackEvent("brief_builder_view");
    
    // Autofill preferred style from session store if available
    if (initialStyle) {
      const match = STYLES.find(s => s.value === initialStyle);
      if (match) {
        setPreferredStyle(initialStyle);
      } else {
        setPreferredStyle("other");
        setPreferredStyleOther(initialStyle);
      }
    }
  }, [trackEvent, updateProfile, initialStyle]);

  // Compute final values (either selected standard value or manual write-in)
  const finalPropertyType = useMemo(() => {
    if (propertyType === "other") return propertyTypeOther.trim() || (isRTL ? "أخرى" : "Other");
    const match = PROPERTY_TYPES.find(p => p.value === propertyType);
    return match ? (isRTL ? match.labelAr : match.labelEn) : "";
  }, [propertyType, propertyTypeOther, isRTL]);

  const finalPropertyStatus = useMemo(() => {
    if (propertyStatus === "other") return propertyStatusOther.trim() || (isRTL ? "أخرى" : "Other");
    const match = PROPERTY_STATUSES.find(p => p.value === propertyStatus);
    return match ? (isRTL ? match.labelAr : match.labelEn) : "";
  }, [propertyStatus, propertyStatusOther, isRTL]);

  const finalSpaces = useMemo(() => {
    const list = selectedSpaces.map(val => {
      if (val === "other") return spacesOther.trim() || (isRTL ? "أخرى" : "Other");
      const match = SPACES.find(s => s.value === val);
      return match ? (isRTL ? match.labelAr : match.labelEn) : val;
    }).filter(Boolean);
    return list.join(", ");
  }, [selectedSpaces, spacesOther, isRTL]);

  const finalBudgetGrade = useMemo(() => {
    if (budgetGrade === "other") return budgetGradeOther.trim() || (isRTL ? "أخرى" : "Other");
    const match = BUDGET_GRADES.find(b => b.value === budgetGrade);
    return match ? (isRTL ? match.labelAr : match.labelEn) : "";
  }, [budgetGrade, budgetGradeOther, isRTL]);

  const finalTimeline = useMemo(() => {
    if (timeline === "other") return timelineOther.trim() || (isRTL ? "أخرى" : "Other");
    const match = TIMELINES.find(t => t.value === timeline);
    return match ? (isRTL ? match.labelAr : match.labelEn) : "";
  }, [timeline, timelineOther, isRTL]);

  const finalStyle = useMemo(() => {
    if (preferredStyle === "other") return preferredStyleOther.trim() || (isRTL ? "أخرى" : "Other");
    const match = STYLES.find(s => s.value === preferredStyle);
    return match ? (isRTL ? match.labelAr : match.labelEn) : "";
  }, [preferredStyle, preferredStyleOther, isRTL]);

  const finalFocus = useMemo(() => {
    if (primaryFocus === "other") return primaryFocusOther.trim() || (isRTL ? "أخرى" : "Other");
    const match = FOCUSES.find(f => f.value === primaryFocus);
    return match ? (isRTL ? match.labelAr : match.labelEn) : "";
  }, [primaryFocus, primaryFocusOther, isRTL]);

  // Construct complete formatted brief text
  const briefText = useMemo(() => {
    return `
• ${isRTL ? "نوع العقار:" : "Property Type:"} ${finalPropertyType || (isRTL ? "غير محدد" : "Not specified")}
• ${isRTL ? "حالة العقار:" : "Property Status:"} ${finalPropertyStatus || (isRTL ? "غير محدد" : "Not specified")}
• ${isRTL ? "الفراغات المطلوبة:" : "Target Spaces:"} ${finalSpaces || (isRTL ? "غير محدد" : "Not specified")}
• ${isRTL ? "فئة الميزانية:" : "Budget Grade:"} ${finalBudgetGrade || (isRTL ? "غير محدد" : "Not specified")}
• ${isRTL ? "الجدول الزمني:" : "Timeline:"} ${finalTimeline || (isRTL ? "غير محدد" : "Not specified")}
• ${isRTL ? "النمط المفضل:" : "Preferred Style:"} ${finalStyle || (isRTL ? "غير محدد" : "Not specified")}
• ${isRTL ? "أولوية العميل:" : "Client Priority:"} ${finalFocus || (isRTL ? "غير محدد" : "Not specified")}
    `.trim();
  }, [finalPropertyType, finalPropertyStatus, finalSpaces, finalBudgetGrade, finalTimeline, finalStyle, finalFocus, isRTL]);

  // Build the WhatsApp message and URL
  const whatsappUrl = useMemo(() => {
    if (!runtimeConfig.whatsappNumber) return "/start";

    // Dynamic clean message for WhatsApp
    const message = isRTL 
      ? `طلب استشارة وتخطيط مشروع - أزينث ليفينج\n\n*العميل:* ${fullName || "[الاسم الكامل]"}\n*الهاتف:* ${phone || "[رقم الهاتف]"}\n\n* تفاصيل متطلبات المشروع:*\n${briefText}\n\n${notes ? `*ملاحظات إضافية:* ${notes}\n` : ""}\nأرغب في حجز موعد لمناقشة خريطة طريق المشروع المعينة.`
      : `Project Consultation & Brief - Azenith Living\n\n*Client:* ${fullName || "[Name]"}\n*Phone:* ${phone || "[Phone]"}\n\n*Project Details:*\n${briefText}\n\n${notes ? `*Notes:* ${notes}\n` : ""}\nI would like to book a meeting to discuss my custom project roadmap.`;

    return `https://wa.me/${runtimeConfig.whatsappNumber}?text=${encodeURIComponent(message)}`;
  }, [runtimeConfig.whatsappNumber, fullName, phone, briefText, notes, isRTL]);

  // Handle spaces multi-select
  const handleSpaceToggle = (val: string) => {
    setSelectedSpaces(prev => 
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
  };

  // Submit lead database call
  async function submitLead() {
    setErrorMessage("");
    setStatusMessage("");

    // Read telemetry data from session store if present
    const sessionState = useSessionStore.getState();
    const spentTimeTotal = sessionState.userProfile?.behavioralReport?.totalFocusTime || 0;
    const telemetrySummary = spentTimeTotal > 15
      ? `(سلوك العميل: أمضى العميل ${Math.round(spentTimeTotal)} ثانية يتصفح الموقع، النمط السلوكي المفضل: ${sessionState.style || "غير محدد"})`
      : "";

    const combinedNotes = `
${notes ? `[ملاحظات العميل]\n${notes}\n\n` : ""}
[بيانات كراسة متطلبات المشروع]
${briefText}
${telemetrySummary ? `\n${telemetrySummary}` : ""}
    `.trim();

    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        fullName,
        phone,
        email,
        notes: combinedNotes,
        roomType: finalSpaces || "غير محدد",
        budget: finalBudgetGrade || "غير محدد",
        style: finalStyle || "غير محدد",
        serviceType: finalPropertyType || "غير محدد",
        score,
        intent,
        lastPage: "/request"
      }),
    });
    
    const payload = (await response.json()) as LeadApiResponse;
    if (!response.ok || !payload.ok) {
      setErrorMessage(payload.message ?? (isRTL ? "تعذر حفظ الطلب الآن." : "Could not save the request right now."));
      return;
    }

    trackEvent("request_submit");
    setSubmitted(true);
    setStatusMessage(isRTL ? "تم حفظ طلبك وكراسة متطلبات مشروعك بنجاح! اضغط على زر 'الانتقال إلى واتساب' لإرسال كراسة الشروط مباشرة للمهندس." : "Your project brief has been saved successfully! Click 'Go to WhatsApp' to send the specifications directly to our engineer.");
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1);
      return;
    }
    startTransition(() => { void submitLead(); });
  };

  return (
    <main className="px-6 py-12 md:px-10 lg:px-16">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.65fr_0.35fr]">
        
        {/* Left Side: Step-by-Step Brief Builder Form */}
        <section className="space-y-8">
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#C5A059]/80">
              {isRTL ? "Interactive Project Brief Builder" : "Intelligent Intake"}
            </span>
            <h1 className="font-serif text-4xl text-white md:text-5xl lg:text-6xl leading-tight">
              {isRTL ? "خطّط كراسة مشروعك تفاعلياً" : "Build Your Project Brief."}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-white/60">
              {isRTL 
                ? "أجب عن بضع خطوات سريعة لصياغة وثيقة متطلبات هندسية كاملة، وسنقوم بتوصيف العقار وتحديد أسلوب التصميم والجدول الزمني المناسب لك."
                : "Answer a few simple questions to build a full architectural specification document. We will qualify your space, aesthetic, and timeline."}
            </p>
          </div>

          {/* Stepper Steps Indicators */}
          <div className="flex items-center gap-2 border-b border-white/5 pb-4" dir={isRTL ? "rtl" : "ltr"}>
            {[
              { num: 1, label: isRTL ? "العقار والمساحة" : "Property" },
              { num: 2, label: isRTL ? "الميزانية والوقت" : "Budget & Time" },
              { num: 3, label: isRTL ? "النمط والتركيز" : "Style & Priority" },
              { num: 4, label: isRTL ? "بيانات التواصل" : "Contact" }
            ].map(step => (
              <div key={step.num} className="flex-1 flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                  currentStep === step.num 
                    ? "bg-[#C5A059] text-black shadow-[0_0_12px_rgba(197,160,89,0.4)]"
                    : currentStep > step.num
                    ? "bg-emerald-500 text-white"
                    : "bg-[#1C1C1E] text-white/40 border border-white/5"
                }`}>
                  {currentStep > step.num ? <Check className="h-4 w-4" /> : step.num}
                </div>
                <span className={`hidden sm:inline text-xs transition-colors duration-300 ${
                  currentStep === step.num ? "text-white font-medium" : "text-white/40"
                }`}>{step.label}</span>
              </div>
            ))}
          </div>

          {/* Main Form container */}
          <form onSubmit={onSubmit} className="space-y-8 rounded-[2.5rem] border border-white/10 bg-[#121213]/40 p-8 backdrop-blur-md">
            <AnimatePresence mode="wait">
              {/* STEP 1: Property and Space */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">{isRTL ? "أولاً: ما هو نوع العقار المستهدف؟" : "1. What type of property is this?"}</h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {PROPERTY_TYPES.map(type => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setPropertyType(type.value)}
                          className={`rounded-2xl border px-4 py-3.5 text-sm font-medium transition-all ${
                            propertyType === type.value
                              ? "border-[#C5A059] bg-[#C5A059]/10 text-white shadow-[0_0_10px_rgba(197,160,89,0.15)]"
                              : "border-white/5 bg-[#1C1C1E]/60 text-white/70 hover:border-white/20 hover:text-white"
                          }`}
                        >
                          {isRTL ? type.labelAr : type.labelEn}
                        </button>
                      ))}
                    </div>
                    {/* Other text input */}
                    {propertyType === "other" && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
                        <input
                          type="text"
                          required
                          value={propertyTypeOther}
                          onChange={(e) => setPropertyTypeOther(e.target.value)}
                          placeholder={isRTL ? "اكتب نوع العقار يدوياً بالتفصيل هنا..." : "Write down custom property type here..."}
                          className="w-full rounded-2xl border border-[#C5A059]/30 bg-[#121212] px-4 py-3.5 text-sm text-white outline-none focus:border-[#C5A059]"
                        />
                      </motion.div>
                    )}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <h3 className="text-lg font-semibold text-white">{isRTL ? "ثانياً: ما هي الحالة الإنشائية الحالية للموقع؟" : "2. What is the current status of the site?"}</h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                      {PROPERTY_STATUSES.map(status => (
                        <button
                          key={status.value}
                          type="button"
                          onClick={() => setPropertyStatus(status.value)}
                          className={`rounded-2xl border px-4 py-3.5 text-sm font-medium transition-all ${
                            propertyStatus === status.value
                              ? "border-[#C5A059] bg-[#C5A059]/10 text-white shadow-[0_0_10px_rgba(197,160,89,0.15)]"
                              : "border-white/5 bg-[#1C1C1E]/60 text-white/70 hover:border-white/20 hover:text-white"
                          }`}
                        >
                          {isRTL ? status.labelAr : status.labelEn}
                        </button>
                      ))}
                    </div>
                    {/* Other text input */}
                    {propertyStatus === "other" && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
                        <input
                          type="text"
                          required
                          value={propertyStatusOther}
                          onChange={(e) => setPropertyStatusOther(e.target.value)}
                          placeholder={isRTL ? "اكتب الحالة الإنشائية الحالية يدوياً هنا..." : "Specify custom property status here..."}
                          className="w-full rounded-2xl border border-[#C5A059]/30 bg-[#121212] px-4 py-3.5 text-sm text-white outline-none focus:border-[#C5A059]"
                        />
                      </motion.div>
                    )}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <h3 className="text-lg font-semibold text-white">{isRTL ? "ثالثاً: ما هي الفراغات المطلوب تصميمها وتجهيزها؟ (اختيارات متعددة)" : "3. Which spaces need design work? (Multi-select)"}</h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {SPACES.map(space => {
                        const isSelected = selectedSpaces.includes(space.value);
                        return (
                          <button
                            key={space.value}
                            type="button"
                            onClick={() => handleSpaceToggle(space.value)}
                            className={`rounded-2xl border px-4 py-3.5 text-sm font-medium transition-all ${
                              isSelected
                                ? "border-[#C5A059] bg-[#C5A059]/10 text-white shadow-[0_0_10px_rgba(197,160,89,0.15)]"
                                : "border-white/5 bg-[#1C1C1E]/60 text-white/70 hover:border-white/20 hover:text-white"
                            }`}
                          >
                            {isRTL ? space.labelAr : space.labelEn}
                          </button>
                        );
                      })}
                    </div>
                    {/* Other text input */}
                    {selectedSpaces.includes("other") && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
                        <input
                          type="text"
                          required
                          value={spacesOther}
                          onChange={(e) => setSpacesOther(e.target.value)}
                          placeholder={isRTL ? "اكتب الغرف أو المساحات الأخرى المطلوبة هنا..." : "Specify other target spaces here..."}
                          className="w-full rounded-2xl border border-[#C5A059]/30 bg-[#121212] px-4 py-3.5 text-sm text-white outline-none focus:border-[#C5A059]"
                        />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* STEP 2: Budget Grade and Timeline */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">{isRTL ? "رابعاً: ما هي فئة الميزانية والتشطيب المستهدفة؟" : "4. What is your target budget grade?"}</h3>
                    <div className="flex flex-col gap-3">
                      {BUDGET_GRADES.map(grade => (
                        <button
                          key={grade.value}
                          type="button"
                          onClick={() => setBudgetGrade(grade.value)}
                          className={`rounded-2xl border px-5 py-4 text-right text-sm font-medium transition-all ${
                            budgetGrade === grade.value
                              ? "border-[#C5A059] bg-[#C5A059]/10 text-white"
                              : "border-white/5 bg-[#1C1C1E]/60 text-white/70 hover:border-white/20 hover:text-white"
                          }`}
                          style={{ direction: isRTL ? "rtl" : "ltr" }}
                        >
                          {isRTL ? grade.labelAr : grade.labelEn}
                        </button>
                      ))}
                    </div>
                    {/* Other text input */}
                    {budgetGrade === "other" && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
                        <input
                          type="text"
                          required
                          value={budgetGradeOther}
                          onChange={(e) => setBudgetGradeOther(e.target.value)}
                          placeholder={isRTL ? "يرجى تحديد ميزانيتك الخاصة أو شروط معينة هنا..." : "Write custom budget specification here..."}
                          className="w-full rounded-2xl border border-[#C5A059]/30 bg-[#121212] px-4 py-3.5 text-sm text-white outline-none focus:border-[#C5A059]"
                        />
                      </motion.div>
                    )}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <h3 className="text-lg font-semibold text-white">{isRTL ? "خامساً: ما هو الجدول الزمني المستهدف لتسليم المشروع؟" : "5. What is your target timeline for execution?"}</h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {TIMELINES.map(time => (
                        <button
                          key={time.value}
                          type="button"
                          onClick={() => setTimeline(time.value)}
                          className={`rounded-2xl border px-4 py-3.5 text-sm font-medium transition-all ${
                            timeline === time.value
                              ? "border-[#C5A059] bg-[#C5A059]/10 text-white shadow-[0_0_10px_rgba(197,160,89,0.15)]"
                              : "border-white/5 bg-[#1C1C1E]/60 text-white/70 hover:border-white/20 hover:text-white"
                          }`}
                        >
                          {isRTL ? time.labelAr : time.labelEn}
                        </button>
                      ))}
                    </div>
                    {/* Other text input */}
                    {timeline === "other" && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
                        <input
                          type="text"
                          required
                          value={timelineOther}
                          onChange={(e) => setTimelineOther(e.target.value)}
                          placeholder={isRTL ? "اكتب خطتك الزمنية المخصصة هنا..." : "Specify custom timeline details here..."}
                          className="w-full rounded-2xl border border-[#C5A059]/30 bg-[#121212] px-4 py-3.5 text-sm text-white outline-none focus:border-[#C5A059]"
                        />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* STEP 3: Style and Priority */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">{isRTL ? "سادساً: ما هو الأسلوب المعماري والنمط المفضل لديك؟" : "6. What is your preferred design style?"}</h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                      {STYLES.map(style => (
                        <button
                          key={style.value}
                          type="button"
                          onClick={() => setPreferredStyle(style.value)}
                          className={`rounded-2xl border px-4 py-3.5 text-sm font-medium transition-all ${
                            preferredStyle === style.value
                              ? "border-[#C5A059] bg-[#C5A059]/10 text-white shadow-[0_0_10px_rgba(197,160,89,0.15)]"
                              : "border-white/5 bg-[#1C1C1E]/60 text-white/70 hover:border-white/20 hover:text-white"
                          }`}
                        >
                          {isRTL ? style.labelAr : style.labelEn}
                        </button>
                      ))}
                    </div>
                    {/* Other text input */}
                    {preferredStyle === "other" && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
                        <input
                          type="text"
                          required
                          value={preferredStyleOther}
                          onChange={(e) => setPreferredStyleOther(e.target.value)}
                          placeholder={isRTL ? "حدد الطراز المعماري الذي تبحث عنه هنا..." : "Specify custom architectural style here..."}
                          className="w-full rounded-2xl border border-[#C5A059]/30 bg-[#121212] px-4 py-3.5 text-sm text-white outline-none focus:border-[#C5A059]"
                        />
                      </motion.div>
                    )}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <h3 className="text-lg font-semibold text-white">{isRTL ? "سابعاً: ما هي الأولوية والهدف الأكبر لك في هذا المشروع؟" : "7. What is your primary priority/goal for this project?"}</h3>
                    <div className="flex flex-col gap-3">
                      {FOCUSES.map(focus => (
                        <button
                          key={focus.value}
                          type="button"
                          onClick={() => setPrimaryFocus(focus.value)}
                          className={`rounded-2xl border px-5 py-4 text-right text-sm font-medium transition-all ${
                            primaryFocus === focus.value
                              ? "border-[#C5A059] bg-[#C5A059]/10 text-white"
                              : "border-white/5 bg-[#1C1C1E]/60 text-white/70 hover:border-white/20 hover:text-white"
                          }`}
                          style={{ direction: isRTL ? "rtl" : "ltr" }}
                        >
                          {isRTL ? focus.labelAr : focus.labelEn}
                        </button>
                      ))}
                    </div>
                    {/* Other text input */}
                    {primaryFocus === "other" && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
                        <input
                          type="text"
                          required
                          value={primaryFocusOther}
                          onChange={(e) => setPrimaryFocusOther(e.target.value)}
                          placeholder={isRTL ? "اكتب الأولوية أو الشرط الخاص بك هنا..." : "Specify custom priority details here..."}
                          className="w-full rounded-2xl border border-[#C5A059]/30 bg-[#121212] px-4 py-3.5 text-sm text-white outline-none focus:border-[#C5A059]"
                        />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* STEP 4: Contact Information */}
              {currentStep === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
                  className="space-y-6"
                >
                  <h3 className="text-lg font-semibold text-white">{isRTL ? "ثامناً: بيانات الاتصال لتسجيل المتطلبات وحجز الجلسة المعمارية" : "8. Contact Details to Save Your Brief"}</h3>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold text-white/60">{isRTL ? "الاسم الكامل" : "Full Name"}</span>
                      <input 
                        required 
                        value={fullName} 
                        onChange={(e) => setFullName(e.target.value)} 
                        className="w-full rounded-2xl border border-white/10 bg-[#111112] px-4 py-3.5 text-white outline-none transition focus:border-[#C5A059]" 
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold text-white/60">{isRTL ? "رقم الهاتف (يفضل واتساب)" : "Phone Number (WhatsApp preferred)"}</span>
                      <input 
                        required 
                        value={phone} 
                        onChange={(e) => setPhone(e.target.value)} 
                        className="w-full rounded-2xl border border-white/10 bg-[#111112] px-4 py-3.5 text-white outline-none transition focus:border-[#C5A059]" 
                      />
                    </label>
                    <label className="space-y-2 sm:col-span-2">
                      <span className="text-xs font-semibold text-white/60">{isRTL ? "البريد الإلكتروني" : "Email Address"}</span>
                      <input 
                        type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        className="w-full rounded-2xl border border-white/10 bg-[#111112] px-4 py-3.5 text-white outline-none transition focus:border-[#C5A059]" 
                      />
                    </label>
                    <label className="space-y-2 sm:col-span-2">
                      <span className="text-xs font-semibold text-white/60">{isRTL ? "ملاحظات إضافية أو شروط خاصة" : "Additional Notes or Special Terms"}</span>
                      <textarea 
                        rows={4} 
                        value={notes} 
                        onChange={(e) => setNotes(e.target.value)} 
                        className="w-full rounded-2xl border border-white/10 bg-[#111112] px-4 py-3.5 text-white outline-none transition focus:border-[#C5A059]" 
                      />
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form Action Messages */}
            {(errorMessage || statusMessage) && (
              <div className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm leading-relaxed ${
                errorMessage ? "border border-red-500/20 bg-red-500/10 text-red-100" : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
              }`}>
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage || statusMessage}</span>
              </div>
            )}

            {/* Footer Navigation Buttons inside Form */}
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="flex items-center gap-2 rounded-full border border-white/10 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
                >
                  <ChevronRight className={`h-4 w-4 ${isRTL ? "" : "rotate-180"}`} />
                  {isRTL ? "السابق" : "Back"}
                </button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => {
                    // Quick validation for step 1
                    if (currentStep === 1 && (!propertyType || !propertyStatus || selectedSpaces.length === 0)) {
                      setErrorMessage(isRTL ? "يرجى الإجابة عن جميع الأسئلة للمتابعة." : "Please answer all questions to proceed.");
                      return;
                    }
                    // Quick validation for step 2
                    if (currentStep === 2 && (!budgetGrade || !timeline)) {
                      setErrorMessage(isRTL ? "يرجى الإجابة عن جميع الأسئلة للمتابعة." : "Please answer all questions to proceed.");
                      return;
                    }
                    // Quick validation for step 3
                    if (currentStep === 3 && (!preferredStyle || !primaryFocus)) {
                      setErrorMessage(isRTL ? "يرجى الإجابة عن جميع الأسئلة للمتابعة." : "Please answer all questions to proceed.");
                      return;
                    }
                    setErrorMessage("");
                    setCurrentStep(prev => prev + 1);
                  }}
                  className="flex items-center gap-2 rounded-full bg-[#C5A059] px-7 py-3.5 text-sm font-semibold text-black hover:bg-[#d8b56d] transition-colors"
                >
                  {isRTL ? "التالي" : "Next"}
                  <ChevronLeft className={`h-4 w-4 ${isRTL ? "" : "rotate-180"}`} />
                </button>
              ) : (
                <div className="flex gap-3">
                  <button 
                    type="submit" 
                    disabled={isPending || submitted} 
                    className="inline-flex items-center justify-center gap-3 rounded-full bg-[#C5A059] px-7 py-3.5 text-sm font-semibold text-black hover:bg-[#d8b56d] disabled:opacity-50 transition-colors"
                  >
                    {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    {isRTL ? "حفظ كراسة الشروط" : "Save Brief"}
                  </button>
                  
                  {submitted && (
                    <Link 
                      href={whatsappUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-500 bg-emerald-500/10 px-7 py-3.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {isRTL ? "الانتقال إلى واتساب" : "Go to WhatsApp"}
                    </Link>
                  )}
                </div>
              )}
            </div>
          </form>
        </section>

        {/* Right Side: Dynamic Project Roadmap & Curation */}
        <aside className="space-y-6 lg:self-start lg:sticky lg:top-28">
          
          {/* Custom Roadmap Card */}
          <div className="rounded-[2.5rem] border border-[#C5A059]/20 bg-[#121213]/85 p-8 shadow-2xl backdrop-blur-md space-y-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C5A059]">
                {isRTL ? "مستند تخطيط مخصص" : "CUSTOM ROADMAP"}
              </span>
              <h2 className="mt-2 font-serif text-2xl font-semibold text-white leading-snug">
                {finalPropertyType 
                  ? (isRTL ? `خريطة طريق تصميم ${finalPropertyType}` : `Roadmap for ${finalPropertyType}`)
                  : (isRTL ? "خريطة طريق مشروعك" : "Your Project Roadmap")}
              </h2>
              <p className="mt-2 text-xs text-white/50 leading-relaxed">
                {isRTL 
                  ? "سنقوم بوضع خطوات هندسية دقيقة لتنفيذ عقارك بناءً على كراسة الشروط المحددة:"
                  : "We define concrete engineering milestones based on your project brief:"}
              </p>
            </div>

            {/* Stages Timeline */}
            <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:h-[calc(100%-16px)] before:w-[1px] before:bg-white/10" dir={isRTL ? "rtl" : "ltr"}>
              
              {/* Stage 1 */}
              <div className="flex gap-4 relative">
                <div className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                  currentStep >= 1 ? "bg-[#C5A059] text-black" : "bg-[#1C1C1E] text-white/40 border border-white/5"
                }`}>1</div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{isRTL ? "المعاينة الفنية ورفع المقاسات" : "Technical Survey"}</h4>
                  <p className="mt-1 text-xs text-white/50 leading-relaxed">
                    {isRTL 
                      ? "زيارة مهندسينا لرفع المقاسات الدقيقة وفحص الحالة الإنشائية وجدول المناسيب."
                      : "Our engineers visit the site for structural and measurements audit."}
                  </p>
                </div>
              </div>

              {/* Stage 2 */}
              <div className="flex gap-4 relative">
                <div className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                  currentStep >= 2 ? "bg-[#C5A059] text-black" : "bg-[#1C1C1E] text-white/40 border border-white/5"
                }`}>2</div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{isRTL ? "المخططات الهندسية وتوزيع الفرش" : "2D Layouts & Planning"}</h4>
                  <p className="mt-1 text-xs text-white/50 leading-relaxed">
                    {isRTL 
                      ? "رسم مخططات التوزيع المعماري (2D Layouts) وتحديد الحركة والـ Moodboards البصرية."
                      : "Drafting layout plans, furniture placement pathways, and aesthetic moodboards."}
                  </p>
                </div>
              </div>

              {/* Stage 3 */}
              <div className="flex gap-4 relative">
                <div className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                  currentStep >= 3 ? "bg-[#C5A059] text-black" : "bg-[#1C1C1E] text-white/40 border border-white/5"
                }`}>3</div>
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    {isRTL 
                      ? `رندر 3D وتحديد خامات الـ ${finalStyle || "تصميم"}` 
                      : `3D Render & Materials`}
                  </h4>
                  <p className="mt-1 text-xs text-white/50 leading-relaxed">
                    {isRTL 
                      ? "إنشاء صور ثلاثية الأبعاد كاملة، واختيار الألوان وجداول مواصفات التشطيب والكميات (BOQ)."
                      : "Creating hyper-realistic 3D designs, choosing finishing colors, and completing Bill of Quantities."}
                  </p>
                </div>
              </div>

              {/* Stage 4 */}
              <div className="flex gap-4 relative">
                <div className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                  currentStep >= 4 ? "bg-[#C5A059] text-black" : "bg-[#1C1C1E] text-white/40 border border-white/5"
                }`}>4</div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{isRTL ? "التنفيذ الفعلي والإشراف الهندسي" : "Turnkey Execution & Curation"}</h4>
                  <p className="mt-1 text-xs text-white/50 leading-relaxed">
                    {isRTL 
                      ? "البدء الفعلي للتشطيب ومطابقة المواصفات مع جدول تسليم المفتاح النهائي."
                      : "Starting site works, ensuring materials compliance, and turnkey delivery."}
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Quick Summary Preview of Brief Document */}
          <div className="rounded-[2.5rem] border border-white/10 bg-[#121213]/40 p-8 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white/60">
              {isRTL ? "معاينة كراسة الشروط" : "Brief Preview"}
            </h4>
            <div className="space-y-3 text-xs bg-[#1C1C1F]/60 rounded-2xl p-5 border border-white/5 leading-relaxed text-white/80 font-mono">
              <div><span className="text-white/40">PROPERTY:</span> {finalPropertyType || "..."}</div>
              <div><span className="text-white/40">STATUS:</span> {finalPropertyStatus || "..."}</div>
              <div><span className="text-white/40">SPACES:</span> {finalSpaces || "..."}</div>
              <div><span className="text-white/40">BUDGET LEVEL:</span> {finalBudgetGrade || "..."}</div>
              <div><span className="text-white/40">TIMELINE:</span> {finalTimeline || "..."}</div>
              <div><span className="text-white/40">PREFERRED STYLE:</span> {finalStyle || "..."}</div>
              <div><span className="text-white/40">CLIENT PRIORITY:</span> {finalFocus || "..."}</div>
            </div>
          </div>

        </aside>
      </div>
    </main>
  );
}
