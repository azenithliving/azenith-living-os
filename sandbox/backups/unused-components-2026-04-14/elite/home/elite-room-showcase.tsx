"use client";

/**
 * ELITE ROOM SHOWCASE COMPONENT
 * Premium room grid for Elite Homepage
 * 
 * CLASSIFICATION: EXTEND
 * Extends existing HomePageClient room grid with:
 * - Premium visual treatment
 * - Elite-specific CTA
 * - Enhanced hover effects
 * - Curated experience
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { roomDefinitions } from "@/lib/site-content";

const roomImages: Record<string, string> = {
  "master-bedroom": "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800&q=80",
  "living-room": "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&q=80",
  "kitchen": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
  "dressing-room": "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=800&q=80",
  "home-office": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
  "youth-room": "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800&q=80",
  "dining-room": "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800&q=80",
  "interior-design": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
};

export function EliteRoomShowcase() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Show top 6 rooms for elite homepage
  const featuredRooms = roomDefinitions.slice(0, 6);

  return (
    <section className="relative py-24 px-6" dir="rtl">
      {/* Section Header */}
      <div className="max-w-7xl mx-auto mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="h-5 w-5 text-[#C5A059]" />
            <span className="text-[#C5A059] text-sm font-bold tracking-wider uppercase">
              المساحات المميزة
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-serif text-white font-bold mb-4">
            استكشف بيئاتنا المصممة للنخبة
          </h2>
          <p className="text-white/60 max-w-2xl">
            كل مساحة تُصمم بعناية فائقة لتلبية احتياجاتك الفريدة، مع تركيز على الجودة والتفاصيل الدقيقة
          </p>
        </motion.div>
      </div>

      {/* Premium Room Grid */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredRooms.map((room, index) => (
            <motion.div
              key={room.slug}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <Link
                href={`/room/${room.slug}`}
                className="group block relative aspect-[4/3] rounded-3xl overflow-hidden"
              >
                {/* Image Background */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out"
                  style={{
                    backgroundImage: `url(${roomImages[room.slug] || "/placeholder-room.jpg"})`,
                    transform: hoveredIndex === index ? "scale(1.1)" : "scale(1)",
                  }}
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                {/* Gold Border on Hover */}
                <div
                  className={`absolute inset-0 rounded-3xl border-2 transition-all duration-500 ${
                    hoveredIndex === index
                      ? "border-[#C5A059] shadow-[0_0_30px_rgba(197,160,89,0.3)]"
                      : "border-transparent"
                  }`}
                />

                {/* Content */}
                <div className="absolute inset-0 p-8 flex flex-col justify-end">
                  {/* Eyebrow */}
                  <motion.span
                    className="text-[#C5A059] text-xs font-bold tracking-wider uppercase mb-2"
                    animate={{
                      x: hoveredIndex === index ? 0 : -10,
                      opacity: hoveredIndex === index ? 1 : 0.7,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    {room.eyebrow}
                  </motion.span>

                  {/* Title */}
                  <h3 className="text-white text-2xl font-serif font-bold mb-2 group-hover:text-[#E5C170] transition-colors">
                    {room.title}
                  </h3>

                  {/* Summary */}
                  <p className="text-white/60 text-sm line-clamp-2 mb-4">
                    {room.summary}
                  </p>

                  {/* CTA Row */}
                  <div className="flex items-center justify-between">
                    <span className="text-[#C5A059] text-sm font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
                      استكشف المساحة
                      <ArrowUpRight className="h-4 w-4" />
                    </span>

                    {/* Hover Indicator */}
                    <motion.div
                      className="w-10 h-10 rounded-full bg-[#C5A059] flex items-center justify-center"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{
                        scale: hoveredIndex === index ? 1 : 0,
                        opacity: hoveredIndex === index ? 1 : 0,
                      }}
                      transition={{ duration: 0.3 }}
                    >
                      <ArrowUpRight className="h-5 w-5 text-black" />
                    </motion.div>
                  </div>
                </div>

                {/* Corner Accent */}
                <div
                  className={`absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-[#C5A059]/50 rounded-tr-xl transition-all duration-500 ${
                    hoveredIndex === index ? "opacity-100 scale-100" : "opacity-0 scale-75"
                  }`}
                />
              </Link>
            </motion.div>
          ))}
        </div>

        {/* View All Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-12"
        >
          <Link
            href="/rooms"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-full border border-[#C5A059]/30 text-[#C5A059] hover:bg-[#C5A059]/10 hover:border-[#C5A059] transition-all duration-300 font-medium"
          >
            عرض جميع المساحات
            <ArrowUpRight className="h-5 w-5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
