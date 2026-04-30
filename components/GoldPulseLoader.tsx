"use client";

import { motion } from "framer-motion";

interface GoldPulseLoaderProps {
  text?: string;
  size?: "sm" | "md" | "lg";
}

export default function GoldPulseLoader({ 
  text = "Discovering more luxury...", 
  size = "md" 
}: GoldPulseLoaderProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-14 h-14",
  };

  const ringSizes = {
    sm: "w-8 h-8",
    md: "w-14 h-14",
    lg: "w-20 h-20",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      {/* Gold pulsing rings */}
      <div className="relative flex items-center justify-center">
        {/* Outer ring */}
        <motion.div
          className={`absolute rounded-full border-2 border-amber-500/30 ${ringSizes[size]}`}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        
        {/* Middle ring */}
        <motion.div
          className={`absolute rounded-full border-2 border-amber-400/50 ${sizeClasses[size]}`}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.3,
          }}
        />
        
        {/* Inner core */}
        <motion.div
          className={`relative ${sizeClasses[size]} rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700`}
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            scale: {
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            },
            rotate: {
              duration: 4,
              repeat: Infinity,
              ease: "linear",
            },
          }}
        >
          {/* Shine effect */}
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/40 to-transparent"
            animate={{
              rotate: [0, 360],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </motion.div>
      </div>

      {/* Text */}
      {text && (
        <motion.p
          className="text-sm font-medium tracking-wide text-amber-400/80"
          animate={{
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
}
