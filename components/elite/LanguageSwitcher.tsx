"use client";

import { motion } from "framer-motion";

/**
 * Language Switcher Component
 * Header switcher for AR/EN toggle with luxury styling
 */

type Language = 'ar' | 'en';

interface LanguageSwitcherProps {
  currentLang: Language;
  onChange: (lang: Language) => void;
  className?: string;
}

const languages: { code: Language; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ar", label: "العربية", flag: "🇪🇬" },
];

export function LanguageSwitcher({
  currentLang,
  onChange,
  className = "",
}: LanguageSwitcherProps) {
  return (
    <div className={`flex items-center gap-1 rounded-full border border-[#C5A059]/30 bg-white/[0.05] p-1 ${className}`}>
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => onChange(lang.code)}
          className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            currentLang === lang.code
              ? "text-black"
              : "text-white/70 hover:text-white"
          }`}
        >
          {currentLang === lang.code && (
            <motion.div
              layoutId="lang-indicator"
              className="absolute inset-0 rounded-full bg-[#C5A059]"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10">{lang.flag}</span>
          <span className="relative z-10 hidden sm:inline">{lang.label}</span>
        </button>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
