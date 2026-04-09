"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MessageCircle, Sparkles } from "lucide-react";

import Footer from "./Footer";
import AIStylePicker from "./AIStylePicker";

import { buildWhatsAppUrl } from "@/lib/conversion-engine";
import type { RuntimeConfig } from "@/lib/runtime-config";
import useSessionStore from "@/stores/useSessionStore";

type HomePageClientProps = {
  runtimeConfig: RuntimeConfig;
};

type LandingRoom = {
  slug: string;
  eyebrow: string;
  title: string;
  summary: string;
};

const STYLE_LABELS: Record<string, string> = {
  modern: "مودرن",
  classic: "كلاسيك",
  industrial: "صناعي",
  scandinavian: "سكاندينافي",
};

const ROOM_QUERIES: Record<string, string> = {
  "master-bedroom": "luxury master bedroom",
  "living-room": "modern living room",
  kitchen: "luxury kitchen",
  "dressing-room": "walk-in closet",
  "dining-room": "elegant dining",
  "home-office": "luxury home office",
  "youth-room": "modern youth bedroom",
  "interior-design": "luxury interior design home",
};

const STYLE_QUERY_HINTS: Record<string, string> = {
  modern: "modern minimal luxury",
  classic: "classic elegant luxury",
  industrial: "industrial loft luxury",
  scandinavian: "scandinavian cozy luxury",
};

const STYLE_RESULT_PAGE: Record<string, number> = {
  modern: 1,
  classic: 2,
  industrial: 3,
  scandinavian: 4,
};

const BASE_ROOMS: LandingRoom[] = [
  {
    slug: "master-bedroom",
    eyebrow: "خصوصية محسوبة",
    title: "غرف النوم الرئيسية",
    summary: "مساحة هادئة بتفاصيل فندقية وتخزين ذكي وخامات تعيش سنوات طويلة.",
  },
  {
    slug: "living-room",
    eyebrow: "استقبال بثقة",
    title: "غرف المعيشة",
    summary: "جلسات مدروسة بصريًا وعمليًا بمشهد راقٍ وحركة مريحة للعائلة والضيوف.",
  },
  {
    slug: "kitchen",
    eyebrow: "أداء يومي أنظف",
    title: "المطابخ",
    summary: "مطابخ حديثة تجمع بين الوظيفة وسهولة الاستخدام مع تخزين محسوب وتشطيب متقن.",
  },
  {
    slug: "dressing-room",
    eyebrow: "تنظيم فاخر",
    title: "غرف الملابس",
    summary: "تقسيم واضح وإضاءة ومرايا تجعل التجربة اليومية أكثر راحة وأناقة.",
  },
  {
    slug: "home-office",
    eyebrow: "تركيز بدون تشويش",
    title: "المكاتب المنزلية",
    summary: "مساحة عمل تحافظ على هوية المنزل وتدعم ساعات التركيز الطويلة.",
  },
  {
    slug: "youth-room",
    eyebrow: "مرونة تنمو مع الوقت",
    title: "غرف الشباب والأطفال",
    summary: "غرف تجمع بين الشخصية والعملية بحلول قابلة للتطوير بدل التغيير السريع.",
  },
];

const STYLE_COPY: Record<string, { headline: string; desc: string }> = {
  modern: {
    headline: "ذكاء التصميم وبساطة المستقبل",
    desc: "مساحات تعكس نمط حياتك السريع بلمسات هادئة وحلول تنظيمية ذكية.",
  },
  classic: {
    headline: "فخامة خالدة وتفاصيل ملكية",
    desc: "دفء بصري وأناقة ثابتة تمنح المساحة حضورًا غنيًا بدون مبالغة.",
  },
  industrial: {
    headline: "جرأة الخامة وروح المدينة",
    desc: "مزيج واضح بين المعدن والخشب يخلق شخصية قوية وعملية للمكان.",
  },
  scandinavian: {
    headline: "هدوء الطبيعة ودفء المنزل",
    desc: "ألوان هادئة وإضاءة مريحة تمنحك إحساسًا بالنظافة والسكينة في كل زاوية.",
  },
};

const ROOM_STYLE_DESCRIPTIONS: Record<string, Record<string, { eyebrow: string; title: string; summary: string }>> = {
  "master-bedroom": {
    modern: {
      eyebrow: "نقاء عصري",
      title: "غرف نوم مينيمال",
      summary: "خطوط نظيفة وتصميم مينيمال يمنحك هدوءاً عصرياً مع تخزين ذكي خفي.",
    },
    classic: {
      eyebrow: "فخامة ملكية",
      title: "غرف نوم كلاسيكية",
      summary: "فخامة ملكية وتفاصيل غنية تعيد تعريف الرقي الكلاسيكي في كل زاوية.",
    },
    industrial: {
      eyebrow: "خامة أصيلة",
      title: "غرف نوم صناعية",
      summary: "مساحة هادئة بتفاصيل فندقية وخامات راقية تجمع بين القوة والدفء.",
    },
    scandinavian: {
      eyebrow: "دفء شمالي",
      title: "غرف نوم سكاندينافية",
      summary: "ألوان هادئة وخشب طبيعي يخلق ملاذاً للراحة والاسترخاء العميق.",
    },
  },
  "living-room": {
    modern: {
      eyebrow: "أناقة معاصرة",
      title: "صالات مودرن",
      summary: "تصميم مفتوح وخطوط نقية تجمع بين البساطة والوظيفة العالية.",
    },
    classic: {
      eyebrow: "عراقة وجمال",
      title: "صالات كلاسيكية",
      summary: "تفاصيل نحتية وثريات فاخرة تمنح المكان روحاً تاريخية عريقة.",
    },
    industrial: {
      eyebrow: "روح المدينة",
      title: "صالات لوفت",
      summary: "جدران طوبية وأسقف عالية مع لمسات معدنية جريئة وشخصية قوية.",
    },
    scandinavian: {
      eyebrow: "بساطة شمالية",
      title: "صالات سكاندينافية",
      summary: "إضاءة طبيعية وقماش مريح يجعل كل لحظة استرخاء تجربة فريدة.",
    },
  },
  kitchen: {
    modern: {
      eyebrow: "أداء ذكي",
      title: "مطابخ عصرية",
      summary: "أسطح خشبية نظيفة وأجهزة مخفية لمساحة طهي أنيقة وعملية.",
    },
    classic: {
      eyebrow: "تراث الطبخ",
      title: "مطابخ كلاسيكية",
      summary: "خزائن خشبية نقشية وأرضيات رخامية تعكس أصالة المطبخ التقليدي.",
    },
    industrial: {
      eyebrow: "قوة الخامة",
      title: "مطابخ صناعية",
      summary: "أسطح معدنية ولمسات خشبية قوية للطهاة المحترفين والمحبي الجرأة.",
    },
    scandinavian: {
      eyebrow: "نقاء وضوء",
      title: "مطابخ شمالية",
      summary: "أبيض نقي وخشب فاتح مع إضاءة طبيعية تمنح الطاقة والنظافة.",
    },
  },
  "dressing-room": {
    modern: {
      eyebrow: "تنظيم عصري",
      title: "خزائن ملابس مينيمال",
      summary: "أدراج مخفية وإضاءة LED ذكية لتجربة ملابس منظمة وهادئة.",
    },
    classic: {
      eyebrow: "خزائن ملكية",
      title: "غرف ملابس كلاسيكية",
      summary: "مرايا مزخرفة وخزائن خشبية ثقيلة بتفاصيل ذهبية راقية.",
    },
    industrial: {
      eyebrow: "عرض جريء",
      title: "خزائن ملابس مفتوحة",
      summary: "أنابيب معدنية ورفوف خشبية لعرض الملابس بأسلوب لوفت عصري.",
    },
    scandinavian: {
      eyebrow: "بساطة عملية",
      title: "خزائن ملابس شمالية",
      summary: "تنظيم واضح وإضاءة ناعمة مع خشب فاتح لراحة يومية.",
    },
  },
  "home-office": {
    modern: {
      eyebrow: "تركيز عصري",
      title: "مكاتب ذكية",
      summary: "خطوط نظيفة وتقنية متكاملة لبيئة عمل منتجة بدون تشويش.",
    },
    classic: {
      eyebrow: "مكتب تنفيذي",
      title: "مكاتب كلاسيكية",
      summary: "خشب داكن وجلد فاخر يخلقان حضوراً مهنياً يليق بالقرارات الكبرى.",
    },
    industrial: {
      eyebrow: "إبداع صناعي",
      title: "مكاتب لوفت",
      summary: "جدران طوبية وطاولات معدنية لمساحة عمل ملهمة وقوية الشخصية.",
    },
    scandinavian: {
      eyebrow: "توازن وهدوء",
      title: "مكاتب شمالية",
      summary: "ضوء طبيعي ونباتات وألوان هادئة تدعم الإنتاجية والراحة النفسية.",
    },
  },
  "youth-room": {
    modern: {
      eyebrow: "مرونة عصرية",
      title: "غرف شباب مودرن",
      summary: "تصميم متكيف مع مساحات تخزين ذكية تنمو مع احتياجات الشباب المتغيرة.",
    },
    classic: {
      eyebrow: "أناقة شبابية",
      title: "غرف شباب كلاسيكية",
      summary: "خشب نقي وتفاصيل دافئة تمنح الأبناء قيمة الجودة منذ الصغر.",
    },
    industrial: {
      eyebrow: "شخصية قوية",
      title: "غرف شباب صناعية",
      summary: "لمسات معدنية وخشب خام لمساحة تعبر عن الجرأة والاستقلالية.",
    },
    scandinavian: {
      eyebrow: "نمو بصحة",
      title: "غرف شباب شمالية",
      summary: "ألوان هادئة وإضاءة طبيعية تخلق بيئة مثالية للدراسة والراحة.",
    },
  },
};

export default function HomePageClient({ runtimeConfig }: HomePageClientProps) {
  const intent = useSessionStore((state) => state.intent);
  const updateProfile = useSessionStore((state) => state.updateProfile);
  const trackEvent = useSessionStore((state) => state.trackEvent);
  const roomType = useSessionStore((state) => state.roomType);
  const budget = useSessionStore((state) => state.budget);
  const serviceType = useSessionStore((state) => state.serviceType);

  // PERSISTED UI STATE - Read from store instead of local state
  const selectedStyle = useSessionStore((state) => state.selectedStyle);
  const setSelectedStyle = useSessionStore((state) => state.setSelectedStyle);
  const styleSwitches = useSessionStore((state) => state.styleSwitches);
  const isHydrated = useSessionStore((state) => state.isHydrated);

  const [roomImages, setRoomImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  // Local state for immediate UI feedback - synced to store
  const [styleSwitchCount, setStyleSwitchCount] = useState(styleSwitches);
  const styleSwitchRef = useRef(styleSwitches);
  const timersRef = useRef<Map<string, number>>(new Map());

  // Hydration guard - show loading state or default during hydration
  const displayStyle = isHydrated ? selectedStyle : "modern";

  // Sync local ref with store when hydrated
  useEffect(() => {
    if (isHydrated) {
      styleSwitchRef.current = styleSwitches;
      setStyleSwitchCount(styleSwitches);
    }
  }, [isHydrated, styleSwitches]);

  const handleStyleChange = (newStyle: string) => {
    if (selectedStyle !== newStyle) {
      // Update store (handles persistence and interaction tracking)
      setSelectedStyle(newStyle);
      // Update local ref for immediate UI feedback
      const nextCount = styleSwitchRef.current + 1;
      styleSwitchRef.current = nextCount;
      setStyleSwitchCount(nextCount);
    }
    trackEvent("ui_auto_optimization_triggered");
  };

  const startRoomTimer = (roomSlug: string) => {
    if (timersRef.current.has(roomSlug)) return;

    const timer = window.setTimeout(() => {
      trackEvent("room_intent_hover_long");
      timersRef.current.delete(roomSlug);
    }, 3000);

    timersRef.current.set(roomSlug, timer);
  };

  const clearRoomTimer = (roomSlug: string) => {
    const timer = timersRef.current.get(roomSlug);
    if (!timer) return;
    window.clearTimeout(timer);
    timersRef.current.delete(roomSlug);
  };

  const roomList = useMemo(() => {
    const ranked = BASE_ROOMS.map((room) => {
      const styleDesc = ROOM_STYLE_DESCRIPTIONS[room.slug]?.[displayStyle];
      if (styleDesc) {
        return {
          ...room,
          eyebrow: styleDesc.eyebrow,
          title: styleDesc.title,
          summary: styleDesc.summary,
        };
      }
      return { ...room };
    });

    if (displayStyle === "modern") {
      const livingIndex = ranked.findIndex((room) => room.slug === "living-room");
      if (livingIndex > 0) {
        const [livingRoom] = ranked.splice(livingIndex, 1);
        ranked.unshift(livingRoom);
      }
    } else if (displayStyle === "industrial") {
      const officeIndex = ranked.findIndex((room) => room.slug === "home-office");
      if (officeIndex > 0) {
        const [officeRoom] = ranked.splice(officeIndex, 1);
        ranked.unshift(officeRoom);
      }
    }

    return ranked;
  }, [displayStyle]);

  useEffect(() => {
    const timers = timersRef.current;

    return () => {
      for (const [, timer] of timers) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchRoomImages = async () => {
      setRoomImages({});
      setLoading(true);

      try {
        const imagePromises = roomList.map(async (room, index) => {
          try {
            const query = `${STYLE_QUERY_HINTS[displayStyle] || displayStyle} luxury interior design ${ROOM_QUERIES[room.slug] || room.title}`;
            const randomPage = Math.floor(Math.random() * 5) + 1;
            const page = STYLE_RESULT_PAGE[displayStyle] + index + randomPage;
            const res = await fetch(`/api/pexels?query=${encodeURIComponent(query)}&per_page=1&page=${page}`, {
              signal: controller.signal,
            });

            if (!res.ok) {
              throw new Error(`API returned ${res.status}`);
            }

            const data = await res.json();
            const img = data.photos?.[0]?.src?.large || "/placeholder-room.jpg";
            return { [room.slug]: img };
          } catch {
            return { [room.slug]: "/placeholder-room.jpg" };
          }
        });

        const images = await Promise.all(imagePromises);
        if (!controller.signal.aborted) {
          setRoomImages(Object.assign({}, ...images));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void fetchRoomImages();
    return () => controller.abort();
  }, [roomList, displayStyle]);

  useEffect(() => {
    updateProfile({ lastPage: "/" });
    trackEvent("page_view");
  }, [trackEvent, updateProfile]);

  const primaryCtaText =
    styleSwitchCount > 3
      ? "حائر بين الستايلات؟ اطلب استشارة دمج مجانية"
      : intent === "buyer" && runtimeConfig.whatsappNumber
        ? "تحدث مع مهندس التصميم الآن"
        : "ابدأ رحلة التصميم";
  const profile = { roomType, budget, style: displayStyle, serviceType, intent };
  const whatsappUrl = runtimeConfig.whatsappNumber
    ? buildWhatsAppUrl(runtimeConfig.whatsappNumber, profile, runtimeConfig.brandNameAr)
    : "/start";
  const primaryHref = intent === "buyer" && runtimeConfig.whatsappNumber ? whatsappUrl : "/start";

  const handlePrimaryClick = () => {
    trackEvent(intent === "buyer" && runtimeConfig.whatsappNumber ? "whatsapp_click" : "click_cta");
  };
  const styleAltLabel = STYLE_LABELS[displayStyle] ?? displayStyle;

  return (
    <>
      <section className="relative z-20">
        <div className="relative z-10 mx-auto max-w-7xl bg-transparent px-6 pb-40 pt-20">
          <div className="relative z-20 bg-transparent">
            <div className="mb-16 bg-transparent">
              <AIStylePicker selectedStyle={displayStyle} onStyleChange={handleStyleChange} />
            </div>

            <div className="relative z-20 grid grid-cols-1 gap-10 bg-transparent md:grid-cols-2 lg:grid-cols-3">
              {roomList.slice(0, 6).map((room) => (
                <div key={room.slug} className="group relative z-20">
                  <Link
                    href={`/room/${room.slug}?style=${displayStyle}`}
                    onMouseEnter={() => startRoomTimer(room.slug)}
                    onMouseLeave={() => clearRoomTimer(room.slug)}
                    className="relative block aspect-[16/10] cursor-pointer overflow-hidden rounded-[2.5rem] border border-white/5 shadow-2xl transition-all duration-500 hover:-translate-y-3 hover:scale-[1.02] hover:border-brand-primary/30 hover:shadow-[0_20px_40px_rgba(197,160,89,0.3)]"
                  >
                    <Image
                      key={`${displayStyle}-${room.slug}-${roomImages[room.slug] || "placeholder"}`}
                      src={roomImages[room.slug] || "/placeholder-room.jpg"}
                      alt={`${room.title} بتصميم ${styleAltLabel}`}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="absolute inset-0 object-cover transition-transform duration-1000 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 z-20 p-8 text-right">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand-primary">{room.eyebrow}</span>
                      <h3 className="mb-2 text-2xl font-serif font-bold text-white">{room.title}</h3>
                      <p className="line-clamp-2 text-sm leading-relaxed text-white/70">{room.summary}</p>
                    </div>
                  </Link>
                </div>
              ))}

              <div className="group relative z-20">
                <Link
                  href={`/room/interior-design?style=${displayStyle}`}
                  onMouseEnter={() => startRoomTimer("interior-design")}
                  onMouseLeave={() => clearRoomTimer("interior-design")}
                  className="relative block aspect-[16/10] cursor-pointer overflow-hidden rounded-[2.5rem] border border-white/5 shadow-2xl transition-all duration-500 hover:-translate-y-3 hover:scale-[1.02] hover:border-brand-primary/30 hover:shadow-[0_20px_40px_rgba(197,160,89,0.3)]"
                >
                  <Image
                    key={`${displayStyle}-interior-design-${roomImages["interior-design"] || "placeholder"}`}
                    src={roomImages["interior-design"] || "/placeholder-room.jpg"}
                    alt={`تصميم داخلي شامل بأسلوب ${styleAltLabel}`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="absolute inset-0 object-cover transition-transform duration-1000 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 z-20 p-8 text-right">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand-primary">تصميم شامل</span>
                    <h3 className="mb-2 text-2xl font-serif font-bold text-white">تصميم داخلي شامل</h3>
                    <p className="line-clamp-2 text-sm leading-relaxed text-white/70">حلول متكاملة لتصميم مساحتك بالكامل.</p>
                  </div>
                </Link>
              </div>

              <div className="group relative z-20 bg-transparent">
                <div className="relative block aspect-[16/10] overflow-hidden rounded-[2.5rem] border-2 border-[#C5A059] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1A1A1B] via-[#0D0D0E] to-black shadow-[0_0_50px_rgba(197,160,89,0.3)] transition-all duration-500 group-hover:-translate-y-3 group-hover:border-brand-primary/30">
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <div className="mb-4 flex items-center gap-2">
                      <Sparkles className="h-3 w-3 animate-pulse text-[#C5A059]" />
                      <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-[#C5A059] animate-pulse">الخطوة الحصرية</span>
                    </div>
                    <h2 className="mb-4 text-xl font-black leading-tight text-white md:text-2xl">
                      استكشف <span className="bg-gradient-to-r from-[#C5A059] to-[#E5C170] bg-clip-text text-transparent">المساحات</span>
                    </h2>
                    <p className="mb-6 max-w-[200px] text-xs leading-relaxed text-white/50 md:text-sm">
                      {styleSwitchCount > 2 ? "وجدنا الستايل المناسب لك.. لنبدأ التنفيذ" : "اكتشف إبداعاتنا في التصميم الداخلي المبتكر."}
                    </p>
                    <Link
                      href={styleSwitchCount > 2 ? primaryHref : "/rooms"}
                      onClick={styleSwitchCount > 2 ? handlePrimaryClick : undefined}
                      className="w-full rounded-xl bg-gradient-to-r from-[#C5A059] to-[#E5C170] px-4 py-3 text-center text-sm font-black text-black shadow-[0_15px_30px_-10px_rgba(197,160,89,0.6)] transition-all hover:shadow-[0_0_20px_rgba(197,160,89,0.5)] active:scale-95"
                    >
                      {styleSwitchCount > 2 ? "اطلب استشارة دمج مجانية" : "استكشف المساحات"}
                    </Link>
                    <span className="mt-4 text-[8px] font-medium text-white/40">تصاميم فريدة • جودة استثنائية</span>
                  </div>
                </div>
              </div>

              <div className="relative z-50 flex aspect-[16/10] transform flex-col items-center justify-center overflow-hidden rounded-[2.5rem] border-2 border-[#C5A059] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1A1A1B] via-[#0D0D0E] to-black p-8 text-center shadow-[0_0_50px_rgba(197,160,89,0.3)] transition-all duration-500 hover:scale-105 md:col-span-2 lg:col-span-1">
                <div className="mb-6 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 animate-pulse text-[#C5A059]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#C5A059] animate-pulse">الخطوة الحصرية</span>
                </div>
                <h4 className="mb-4 text-xl font-bold text-white">جاهز لتصميم مساحتك؟</h4>
                <p className="mb-6 text-sm leading-tight text-white/80">ابدأ الآن مسار تصميم مخصص يناسب ذوقك واحتياجك الحقيقي.</p>
                <Link
                  href="/start"
                  className="w-full rounded-xl bg-gradient-to-r from-[#C5A059] to-[#E5C170] py-4 text-center text-lg font-black text-black shadow-[0_15px_30px_-10px_rgba(197,160,89,0.6)] transition-all hover:shadow-[0_0_20px_rgba(197,160,89,0.5)] active:scale-95"
                >
                  ابدأ رحلة التصميم
                </Link>
                <span className="mt-6 text-[10px] font-medium text-white/40">عقد تنفيذ مضمون</span>
              </div>
            </div>

            {loading ? (
              <div className="relative z-20 bg-transparent py-20 text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
                <p className="text-white/40">تنسيق المساحات البصرية...</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="relative z-20 overflow-hidden bg-gradient-to-b from-black via-[#0A0A0A] to-black px-6 pb-32 pt-24 md:px-12">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60" />

        <div className="relative z-30 mx-auto max-w-7xl">
          <div className="grid items-start gap-16 lg:grid-cols-2">
            <div className="space-y-8">
              <h2 className="text-4xl font-serif font-bold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
                أزينث ليفينج: كيان تأسس على خبرة نصف قرن.
              </h2>
              <p className="max-w-2xl text-lg leading-relaxed text-white/80 md:text-xl">
                تأسست أزينث ليفينج عام 2012 برؤية تمزج بين دقة التخطيط المؤسسي وإرث عائلي في صناعة الأثاث يمتد لأكثر من 50 عامًا. نحن نحول المخططات إلى واقع متماسك بخامات منضبطة وتنفيذ محسوب وضمان واضح.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="rounded-3xl border border-[#C5A059]/30 bg-gradient-to-r from-[#C5A059]/10 to-transparent p-8 backdrop-blur-sm">
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-black text-[#C5A059] md:text-6xl">50</span>
                  <span className="text-2xl font-bold text-[#C5A059]">عامًا</span>
                </div>
                <p className="mt-3 text-lg text-white/70">من الشغف والخبرة في ورش الأثاث الفاخر.</p>
              </div>

              <div className="rounded-3xl border border-[#C5A059]/30 bg-gradient-to-r from-[#C5A059]/10 to-transparent p-8 backdrop-blur-sm">
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-black text-[#C5A059] md:text-6xl">2012</span>
                </div>
                <p className="mt-3 text-lg text-white/70">عام التأسيس والانطلاق المؤسسي للعلامة.</p>
              </div>

              <div className="rounded-3xl border border-[#C5A059]/30 bg-gradient-to-r from-[#C5A059]/10 to-transparent p-8 backdrop-blur-sm">
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-black text-[#C5A059] md:text-6xl">3</span>
                  <span className="text-2xl font-bold text-[#C5A059]">سنوات</span>
                </div>
                <p className="mt-3 text-lg text-white/70">ضمان ذهبي يعكس التزام ما بعد البيع.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="fixed inset-x-6 bottom-6 z-50 md:hidden">
        <Link
          href={primaryHref}
          onClick={handlePrimaryClick}
          className="relative z-50 flex items-center justify-center gap-3 rounded-2xl bg-brand-primary py-5 font-bold text-brand-accent shadow-2xl"
        >
          <MessageCircle className="h-6 w-6" />
          {primaryCtaText}
        </Link>
      </div>

      <Footer
        contactEmail={runtimeConfig.contactEmail}
        contactPhone={runtimeConfig.contactPhone}
        businessAddress={runtimeConfig.businessAddress}
      />
    </>
  );
}
