"use client";

import React from "react";

export default function AboutAzenith() {
  return (
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
  );
}
