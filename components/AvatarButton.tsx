"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare } from "lucide-react";
import useSessionStore from "@/stores/useSessionStore";

type AvatarButtonProps = {
  onClick: () => void;
  isOpen: boolean;
};

export default function AvatarButton({ onClick, isOpen }: AvatarButtonProps) {
  const currentLang = useSessionStore((state) => state.language);
  const isRTL = currentLang === "ar";
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isHovered, setIsHovered] = useState(false);
  const [shouldWiggle, setShouldWiggle] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });

  // 1. Periodic Wiggle to attract attention (every 12 seconds)
  useEffect(() => {
    if (isOpen) {
      setShouldWiggle(false);
      return;
    }

    const interval = setInterval(() => {
      setShouldWiggle(true);
      setTimeout(() => setShouldWiggle(false), 800);
    }, 12000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // 2. Initial delay tooltip on page load
  useEffect(() => {
    if (isOpen) {
      setShowTooltip(false);
      return;
    }

    const showTimer = setTimeout(() => {
      setShowTooltip(true);
    }, 4000);

    const hideTimer = setTimeout(() => {
      setShowTooltip(false);
    }, 10000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [isOpen]);

  // 3. Eye tracking mouse movement
  useEffect(() => {
    if (isOpen) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Maximum displacement of pupil in pixels (within the eye socket)
      const maxOffset = 4;

      if (distance === 0) {
        setEyeOffset({ x: 0, y: 0 });
      } else {
        // Linear movement scale factor
        const ratio = Math.min(maxOffset, distance / 25) / distance;
        setEyeOffset({
          x: dx * ratio,
          y: dy * ratio,
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isOpen]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (!isOpen) {
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowTooltip(false);
  };

  // SVG Morph paths for mouth and eyebrows
  const mouthPath = isHovered 
    ? "M 24 33 Q 30 39 36 33"  // Smile
    : "M 26 35 Q 30 35 34 35"; // Neutral straight line

  const leftEyebrowPath = isHovered 
    ? "M 15 15 Q 20 13 25 17"  // Excited arch
    : "M 16 18 Q 20 18 24 19"; // Neutral

  const rightEyebrowPath = isHovered 
    ? "M 35 17 Q 40 13 45 15"  // Excited arch
    : "M 36 19 Q 40 18 44 18"; // Neutral

  // Floating vertical animation
  const floatTransition = {
    y: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut",
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed bottom-6 right-6 z-50 flex items-center justify-end"
    >
      {/* Speech Bubble Tooltip */}
      <AnimatePresence>
        {showTooltip && !isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: isRTL ? -15 : 15 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: isRTL ? -15 : 15 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`absolute bottom-3 whitespace-nowrap rounded-2xl border border-[#C5A059]/40 bg-zinc-950/95 px-5 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.5),_0_0_15px_rgba(197,160,89,0.1)] backdrop-blur-md ${
              isRTL ? "right-20 origin-right" : "right-20 origin-right"
            }`}
            dir={isRTL ? "rtl" : "ltr"}
          >
            {/* Triangular arrow pointing to the avatar */}
            <div className="absolute right-[-6px] top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-r border-t border-[#C5A059]/40 bg-zinc-900" />
            
            <div className="flex items-center gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C5A059]/20 text-[#C5A059]">
                <MessageSquare className="h-3 w-3" />
              </div>
              <span className="text-xs font-medium text-white tracking-wide">
                {isRTL 
                  ? "أهلاً بك! أنا مستشار أزينث.. اضغط للتحدث معي" 
                  : "Welcome! I'm Azenith Advisor.. Tap to chat"}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Interactive Button */}
      <motion.button
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        variants={{
          idle: { y: [0, -6, 0] },
          wiggle: {
            rotate: [0, -12, 12, -12, 12, 0],
            scale: [1, 1.1, 1.1, 1.1, 1.1, 1],
            transition: { duration: 0.6 }
          }
        }}
        animate={shouldWiggle ? "wiggle" : "idle"}
        transition={shouldWiggle ? undefined : floatTransition}
        whileTap={{ scale: 0.92 }}
        className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-shadow duration-300 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/50 ${
          isOpen
            ? "border border-[#C5A059] bg-black/90 shadow-[0_0_25px_rgba(197,160,89,0.2)]"
            : "border-2 border-[#C5A059]/60 bg-zinc-900/90 shadow-[0_10px_30px_rgba(0,0,0,0.6),_0_0_15px_rgba(197,160,89,0.15)] hover:border-[#C5A059] hover:shadow-[0_15px_35px_rgba(197,160,89,0.35)]"
        } backdrop-blur-md`}
      >
        {/* Glow backdrop behind the avatar */}
        {!isOpen && (
          <div className="absolute inset-0 -z-10 rounded-full bg-[radial-gradient(circle,_#C5A059_0%,_transparent_75%)] opacity-20 blur-sm animate-pulse" />
        )}

        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close-icon"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <X className="h-6 w-6 text-[#C5A059] drop-shadow-[0_0_5px_rgba(197,160,89,0.4)]" />
            </motion.div>
          ) : (
            <motion.div
              key="avatar-icon"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="h-full w-full p-1"
            >
              {/* Animated Avatar SVG */}
              <svg
                viewBox="0 0 60 60"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-full w-full overflow-visible"
              >
                {/* Glowing Aura filter for premium look */}
                <defs>
                  <filter id="glow-filter" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Body / Collar */}
                <path
                  d="M 22 47 L 38 47 L 34 52 L 26 52 Z"
                  fill="#C5A059"
                  opacity="0.8"
                />
                <path
                  d="M 16 52 L 44 52 L 48 60 L 12 60 Z"
                  fill="#1E1E1E"
                  stroke="#C5A059"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />

                {/* Ear Joints / Tech accents */}
                <rect
                  x="5"
                  y="23"
                  width="3"
                  height="10"
                  rx="1.5"
                  fill="#C5A059"
                  className="transition-all duration-300"
                  style={{ filter: isHovered ? "drop-shadow(0 0 3px #C5A059)" : "none" }}
                />
                <rect
                  x="52"
                  y="23"
                  width="3"
                  height="10"
                  rx="1.5"
                  fill="#C5A059"
                  className="transition-all duration-300"
                  style={{ filter: isHovered ? "drop-shadow(0 0 3px #C5A059)" : "none" }}
                />

                {/* Tilted Ring / Halo (Luxury Architecture vibe) */}
                <ellipse
                  cx="30"
                  cy="28"
                  rx="26"
                  ry="9"
                  stroke="#C5A059"
                  strokeWidth="1"
                  strokeDasharray="4 2"
                  opacity="0.5"
                  transform="rotate(-15, 30, 28)"
                  className="animate-[spin_40s_linear_infinite]"
                />

                {/* Head Dome */}
                <circle
                  cx="30"
                  cy="28"
                  r="21"
                  fill="#121212"
                  stroke="#C5A059"
                  strokeWidth="2"
                />

                {/* Face Inner Screen */}
                <circle
                  cx="30"
                  cy="28"
                  r="17"
                  fill="#1A1A1A"
                  stroke="#C5A059"
                  strokeWidth="0.5"
                  opacity="0.8"
                />

                {/* Eyebrows */}
                <motion.path
                  animate={{ d: leftEyebrowPath }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  stroke="#C5A059"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  fill="none"
                />
                <motion.path
                  animate={{ d: rightEyebrowPath }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  stroke="#C5A059"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  fill="none"
                />

                {/* Eyes (Sleek horizontal pills) */}
                {/* Left Eye */}
                <rect
                  x="16"
                  y="21"
                  width="10"
                  height="6"
                  rx="3"
                  fill="#121212"
                  stroke="#C5A059"
                  strokeWidth="1"
                />
                {/* Right Eye */}
                <rect
                  x="34"
                  y="21"
                  width="10"
                  height="6"
                  rx="3"
                  fill="#121212"
                  stroke="#C5A059"
                  strokeWidth="1"
                />

                {/* Interactive Pupils (glow when hovered) */}
                <circle
                  cx={21 + eyeOffset.x * 0.6}
                  cy={24 + eyeOffset.y * 0.4}
                  r={isHovered ? 2.2 : 1.8}
                  fill={isHovered ? "#FFF" : "#C5A059"}
                  style={{
                    filter: "drop-shadow(0 0 4px #C5A059)",
                    transition: "r 0.25s ease, fill 0.25s ease",
                  }}
                />
                <circle
                  cx={39 + eyeOffset.x * 0.6}
                  cy={24 + eyeOffset.y * 0.4}
                  r={isHovered ? 2.2 : 1.8}
                  fill={isHovered ? "#FFF" : "#C5A059"}
                  style={{
                    filter: "drop-shadow(0 0 4px #C5A059)",
                    transition: "r 0.25s ease, fill 0.25s ease",
                  }}
                />

                {/* Mouth */}
                <motion.path
                  animate={{ d: mouthPath }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  stroke="#C5A059"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
