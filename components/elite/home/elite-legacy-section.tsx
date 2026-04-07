"use client";

/**
 * ELITE LEGACY SECTION
 * Premium corporate identity section for Elite Homepage
 * 
 * CLASSIFICATION: EXTEND
 * Extends existing corporate section with:
 * - Premium visual hierarchy
 * - Elite-specific messaging
 * - Enhanced trust indicators
 */

import { motion } from "framer-motion";
import { Award, Clock, Shield, Gem } from "lucide-react";

const pillars = [
  {
    icon: Clock,
    value: "50",
    unit: "عاماً",
    label: "إرث عائلي",
    description: "من الخبرة في صناعة الأثاث الفاخر",
  },
  {
    icon: Award,
    value: "2012",
    unit: "",
    label: "التأسيس",
    description: "بناءً على أسس مؤسسية راسخة",
  },
  {
    icon: Shield,
    value: "3",
    unit: "سنوات",
    label: "ضمان ذهبي",
    description: "على جميع منتجاتنا وخدماتنا",
  },
  {
    icon: Gem,
    value: "∞",
    unit: "",
    label: "التميز",
    description: "معيار لا يتنازل عنه",
  },
];

export function EliteLegacySection() {
  return (
    <section className="relative py-32 px-6 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A] via-[#0F0F10] to-[#0A0A0A]" />
      
      {/* Gold Accent Line */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-px h-32 bg-gradient-to-b from-transparent via-[#C5A059]/50 to-transparent" />

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif text-white font-bold mb-6 leading-tight">
            إرثٌ من <span className="text-[#C5A059]">التميز</span>
          </h2>
          <p className="text-white/60 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
            تأسست أزينث ليفينج عام 2012 برؤيةٍ تدمج بين دقة التخطيط المؤسسي وإرثٍ عائلي 
            في صناعة الأثاب يمتد لأكثر من 50 عاماً
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {pillars.map((pillar, index) => (
            <motion.div
              key={pillar.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group relative"
            >
              <div className="relative p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-[#C5A059]/30 transition-all duration-500 hover:bg-white/[0.04]">
                {/* Icon */}
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C5A059]/20 to-[#E5C170]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                  <pillar.icon className="h-6 w-6 text-[#C5A059]" />
                </div>

                {/* Value */}
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl md:text-5xl font-black text-white">
                    {pillar.value}
                  </span>
                  {pillar.unit && (
                    <span className="text-xl text-[#C5A059] font-bold">
                      {pillar.unit}
                    </span>
                  )}
                </div>

                {/* Label */}
                <h3 className="text-white font-bold mb-2">{pillar.label}</h3>

                {/* Description */}
                <p className="text-white/50 text-sm">{pillar.description}</p>

                {/* Hover Glow */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#C5A059]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Trust Statement */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-[#C5A059]/10 border border-[#C5A059]/20 mb-6">
            <Gem className="h-5 w-5 text-[#C5A059]" />
            <span className="text-[#E5C170] font-medium">
              برنامج النخبة - تجربة عميل مميزة
            </span>
          </div>
          <p className="text-white/70 text-lg leading-relaxed">
            نحن لا ننظر إلى الأثاث كقطعة خشب، بل كمعادلة هندسية تبدأ من اختيار المواد الخام 
            وفق معايير عالمية، وتمر عبر نظامنا التشغيلي (Azenith OS) لضمان تنفيذٍ يطابق 
            التصورات بدقةٍ متناهية
          </p>
        </motion.div>
      </div>
    </section>
  );
}
