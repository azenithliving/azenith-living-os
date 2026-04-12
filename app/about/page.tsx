"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { aboutData } from "@/lib/site-content";
import { TranslatedText } from "@/components/TranslatedText";
import useSessionStore from "@/stores/useSessionStore";
import { getTranslation } from "@/lib/multilingual-engine";

interface RuntimeConfig {
  whatsappNumber?: string;
}

export default function AboutPage() {
  const language = useSessionStore((state) => state.language);
  const t = (key: string) => getTranslation(key, language);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>({});

  useEffect(() => {
    // Load runtime config client-side
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => setRuntimeConfig(data))
      .catch(() => setRuntimeConfig({}));
  }, []);

  return (
    <main className="px-6 py-12 md:px-10 lg:px-16">
      <div className="mx-auto max-w-4xl space-y-16">
        {/* Hero */}
        <section className="text-center space-y-6 animate-fadeInUp">
          <h1 className="font-serif text-5xl md:text-7xl text-white">{aboutData.title}</h1>
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-r from-brand-primary/20 to-brand-primary/10 flex items-center justify-center mb-8 hover:spin360 transition-all">
            <span className="text-2xl">🏠</span>
          </div>
          <p className="max-w-2xl mx-auto text-xl leading-8 text-white/80">{aboutData.story}</p>
        </section>

        {/* Values */}
        <section className="grid md:grid-cols-3 gap-6">
          {aboutData.values.map((value, index) => (
            <div key={index} className="group rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-center hover:border-brand-primary/50 transition-all hover:scale-[1.02] backdrop-blur-sm animate-fadeInUp animation-delay-200">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-brand-primary/10 group-hover:bg-brand-primary/20 transition-colors flex items-center justify-center">
                <span className="text-2xl">★</span>
              </div>
              <p className="text-xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </section>

        {/* Team & CTA */}
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.02] to-transparent p-12 text-center backdrop-blur-sm animate-fadeInUp animation-delay-400">
          <p className="text-2xl text-white/90 mb-6">{aboutData.team}</p>
          <div className="max-w-md mx-auto space-y-4">
            <Link 
              href="/rooms" 
              className="block w-full rounded-full bg-brand-primary text-brand-accent px-8 py-4 font-semibold text-lg shadow-lg hover:shadow-xl hover:bg-[#d8b56d] transition-all"
            >
              {t("nav.rooms")}
            </Link>
            {runtimeConfig.whatsappNumber && (
              <Link 
                href={`https://wa.me/${runtimeConfig.whatsappNumber}?text=${language === "ar" ? "مرحبا، أنا مهتم بـ" : "Hello, I'm interested in"} ${aboutData.title}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block w-full rounded-full border-2 border-brand-primary/50 bg-transparent text-brand-primary px-8 py-4 font-semibold text-lg hover:bg-brand-primary/10 hover:border-brand-primary transition-all"
              >
                {t("nav.contact")}
              </Link>
            )}
            <Link href="/furniture" className="block w-full rounded-full border border-white/20 bg-white/[0.05] text-white px-8 py-4 font-semibold hover:border-brand-primary hover:bg-brand-primary/10 transition-all">
              {language === "ar" ? "تصفح الأثاث" : "Browse Furniture"}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
