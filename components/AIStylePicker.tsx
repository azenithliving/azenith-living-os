"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

const styles = [
  { id: "modern", label: "مودرن" },
  { id: "classic", label: "كلاسيك" },
  { id: "industrial", label: "صناعي" },
  { id: "scandinavian", label: "سكاندينافي" },
];

interface AIStylePickerProps {
  selectedStyle: string;
  onStyleChange: (id: string) => void;
  styleSwitchCount?: number;
  options?: ReadonlyArray<{ id: string; label: string }>;
}

const AIStylePicker: React.FC<AIStylePickerProps> = ({ selectedStyle, onStyleChange, options = styles }) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col items-center mb-16 px-4">
      <div className="relative flex flex-wrap justify-center items-center bg-white/[0.03] backdrop-blur-md p-1.5 rounded-full border border-white/10">
        {options.map((style) => {
          const isActive = selectedStyle === style.id;
          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onStyleChange(style.id)}
              className={`relative px-8 py-2.5 text-sm md:text-base transition-colors duration-300 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                isActive ? "text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              <span className="relative z-20 font-medium tracking-widest">
                {style.label}
              </span>

              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 bg-white/10 rounded-full border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                  transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AIStylePicker;
