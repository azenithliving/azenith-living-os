"use client";

import React from "react";
import { motion } from "framer-motion";

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
}

const AIStylePicker: React.FC<AIStylePickerProps> = ({ selectedStyle, onStyleChange }) => {
  return (
    <div className="flex flex-col items-center mb-16 px-4">
      <div className="relative flex items-center bg-white/[0.03] backdrop-blur-md p-1.5 rounded-full border border-white/10">
        {styles.map((style) => {
          const isActive = selectedStyle === style.id;
          return (
            <button
              key={style.id}
              onClick={() => onStyleChange(style.id)}
              className={`relative px-8 py-2.5 text-sm md:text-base transition-colors duration-500 z-10 ${
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
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
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
