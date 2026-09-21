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
              {isRTL ? "أزينث ليفينج: تصميم يبدأ بفهم مساحتك." : "Azenith Living: Design that starts with understanding your space."}
            </h2>
            <p className="max-w-2xl text-lg leading-relaxed text-white/80 md:text-xl">
              {isRTL ? "نساعدك على تنظيم احتياجات المساحة والطابع والميزانية قبل الانتقال إلى التفاصيل. يراجع فريق التصميم طلبك لتحديد نطاق عمل واضح وخطوات تواصل مناسبة." : "We help organize your space, style, and budget requirements before moving into the details. The design team reviews each request to define a clear scope and the appropriate next steps."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="rounded-3xl border border-[#C5A059]/30 bg-gradient-to-r from-[#C5A059]/10 to-transparent p-8 backdrop-blur-sm">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-black text-[#C5A059] md:text-4xl">01</span>
                <span className="text-2xl font-bold text-[#C5A059]">{isRTL ? "فهم المساحة" : "Understand"}</span>
              </div>
              <p className="mt-3 text-lg text-white/70">{isRTL ? "نبدأ بتجميع احتياجاتك وما يهمك في المشروع." : "We start by collecting the needs that matter for your project."}</p>
            </div>

            <div className="rounded-3xl border border-[#C5A059]/30 bg-gradient-to-r from-[#C5A059]/10 to-transparent p-8 backdrop-blur-sm">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-black text-[#C5A059] md:text-4xl">02</span>
                <span className="text-2xl font-bold text-[#C5A059]">{isRTL ? "تحديد الاتجاه" : "Define"}</span>
              </div>
              <p className="mt-3 text-lg text-white/70">{isRTL ? "نوضح اتجاه التصميم ونطاق العمل قبل أي التزام." : "We clarify the design direction and scope before any commitment."}</p>
            </div>

            <div className="rounded-3xl border border-[#C5A059]/30 bg-gradient-to-r from-[#C5A059]/10 to-transparent p-8 backdrop-blur-sm">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-black text-[#C5A059] md:text-4xl">03</span>
                <span className="text-2xl font-bold text-[#C5A059]">{isRTL ? "خطوة تالية" : "Continue"}</span>
              </div>
              <p className="mt-3 text-lg text-white/70">{isRTL ? "تتحدد تفاصيل التنفيذ والمتابعة وفق الاتفاق المكتوب." : "Execution and follow-up details are set by the written agreement."}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
