"use client";

import React from "react";
import useSessionStore from "@/stores/useSessionStore";

export default function AboutAzenith() {
  const currentLang = useSessionStore((state) => state.language);
  const isRTL = currentLang === "ar";

  return (
    <section className="relative z-20 overflow-hidden bg-gradient-to-b from-black via-[#0A0A0A] to-black px-6 pb-32 pt-24 md:px-12">
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60" />

      <div className="relative z-30 mx-auto max-w-7xl">
        <div className="grid items-start gap-16 lg:grid-cols-2">
          <div className="space-y-8">
            <h2 className="text-4xl font-serif font-bold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
              {isRTL ? "أزينث ليفينج: كيان تأسس على خبرة نصف قرن." : "Azenith Living: Built on Half a Century of Expertise."}
            </h2>
            <p className="max-w-2xl text-lg leading-relaxed text-white/80 md:text-xl">
              {isRTL ? "تأسست أزينث ليفينج عام 2012 برؤية تمزج بين دقة التخطيط المؤسسي وإرث عائلي في صناعة الأثاث يمتد لأكثر من 50 عامًا. نحن نحول المخططات إلى واقع متماسك بخامات منضبطة وتنفيذ محسوب وضمان واضح." : "Founded in 2012, Azenith Living blends precise corporate planning with a family legacy in furniture making that spans over 50 years. We turn blueprints into cohesive reality with disciplined materials, calculated execution, and clear warranties."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="rounded-3xl border border-[#C5A059]/30 bg-gradient-to-r from-[#C5A059]/10 to-transparent p-8 backdrop-blur-sm">
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-black text-[#C5A059] md:text-6xl">50</span>
                <span className="text-2xl font-bold text-[#C5A059]">{isRTL ? "عامًا" : "Years"}</span>
              </div>
              <p className="mt-3 text-lg text-white/70">{isRTL ? "من الشغف والخبرة في ورش الأثاث الفاخر." : "Of passion and expertise in luxury furniture workshops."}</p>
            </div>

            <div className="rounded-3xl border border-[#C5A059]/30 bg-gradient-to-r from-[#C5A059]/10 to-transparent p-8 backdrop-blur-sm">
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-black text-[#C5A059] md:text-6xl">2012</span>
              </div>
              <p className="mt-3 text-lg text-white/70">{isRTL ? "عام التأسيس والانطلاق المؤسسي للعلامة." : "The founding year of the brand's corporate journey."}</p>
            </div>

            <div className="rounded-3xl border border-[#C5A059]/30 bg-gradient-to-r from-[#C5A059]/10 to-transparent p-8 backdrop-blur-sm">
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-black text-[#C5A059] md:text-6xl">3</span>
                <span className="text-2xl font-bold text-[#C5A059]">{isRTL ? "سنوات" : "Years"}</span>
              </div>
              <p className="mt-3 text-lg text-white/70">{isRTL ? "ضمان ذهبي يعكس التزام ما بعد البيع." : "Golden warranty reflecting our after-sales commitment."}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
