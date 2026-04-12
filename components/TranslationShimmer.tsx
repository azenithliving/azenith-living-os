"use client";

import { motion } from "framer-motion";

interface TranslationShimmerProps {
  className?: string;
  width?: string;
  height?: string;
}

/**
 * Luxury shimmer loading component for translation loading state
 * Provides a high-end fade effect while AI translations are fetched
 */
export function TranslationShimmer({ 
  className = "", 
  width = "100%", 
  height = "1.2em" 
}: TranslationShimmerProps) {
  return (
    <motion.span
      className={`inline-block rounded bg-gradient-to-r from-[#C5A059]/10 via-[#C5A059]/30 to-[#C5A059]/10 ${className}`}
      style={{ 
        width, 
        height,
        backgroundSize: "200% 100%",
      }}
      animate={{
        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
      }}
      transition={{
        duration: 1.5,
        ease: "easeInOut",
        repeat: Infinity,
      }}
    />
  );
}

/**
 * Text placeholder that shows shimmer effect
 */
export function TextShimmer({ 
  lines = 1, 
  className = "" 
}: { 
  lines?: number; 
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <TranslationShimmer 
          key={i} 
          width={i === lines - 1 ? "80%" : "100%"} 
        />
      ))}
    </div>
  );
}

export default TranslationShimmer;
