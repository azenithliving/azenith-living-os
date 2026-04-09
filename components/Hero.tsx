"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { slides } from "./AzenithLegacy";

interface ManifestoState {
  pillar: string;
  poeticTitle: string;
  subtitle: string;
  stats: ReadonlyArray<{ label: string; value: string }>;
  cta: string;
  ariaLabel: string;
}

export default function Hero() {
  const initialSlide = slides[0];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [manifestoState, setManifestoState] = useState<ManifestoState | null>({
    pillar: initialSlide.pillar,
    poeticTitle: initialSlide.poeticTitle,
    subtitle: initialSlide.description,
    stats: [...initialSlide.stats],
    cta: initialSlide.cta,
    ariaLabel: initialSlide.ariaLabel,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const handleVideoStateChange = (event: WindowEventMap["videoStateChange"]) => {
      const { currentIndex: nextIndex, videoReady, isExiting: exiting, pillar, poeticTitle, subtitle, stats, cta, ariaLabel } = event.detail;
      setCurrentIndex(nextIndex);
      setIsVideoReady(videoReady);
      setIsExiting(exiting);

      if (videoReady) {
        setManifestoState({
          pillar,
          poeticTitle,
          subtitle,
          stats,
          cta,
          ariaLabel,
        });
      }
    };

    window.addEventListener("videoStateChange", handleVideoStateChange);
    return () => {
      window.removeEventListener("videoStateChange", handleVideoStateChange);
    };
  }, []);

  useEffect(() => {
    if (isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = (e.clientX - centerX) / rect.width;
      const deltaY = (e.clientY - centerY) / rect.height;

      setMousePosition({
        x: -deltaX * 10,
        y: -deltaY * 10,
      });
    };

    const handleMouseLeave = () => {
      setMousePosition({ x: 0, y: 0 });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isMobile]);

  const getCtaHref = () => {
    if (!manifestoState) {
      return "/start";
    }

    if (manifestoState.pillar === "HERITAGE" || manifestoState.pillar === "COMMITMENT") {
      return "/about";
    }

    if (manifestoState.pillar === "TRUST" || manifestoState.pillar === "QUALITY") {
      return "/rooms";
    }

    return "/start";
  };

  const titleWords = manifestoState?.poeticTitle.split(" ") || [];

  return (
    <section
      ref={containerRef}
      aria-labelledby="hero-title"
      className="relative flex h-screen items-center justify-center overflow-hidden font-['GE_SS_Two','Cairo','sans-serif']"
    >
      <AnimatePresence mode="wait">
        {isVideoReady && !isExiting && manifestoState ? (
          <motion.div
            key={`${currentIndex}-${manifestoState.pillar}`}
            initial={{ opacity: 0, filter: "blur(20px)", scale: 1.1 }}
            animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
            exit={{ opacity: 0, filter: "blur(15px)" }}
            transition={{
              duration: 1.8,
              ease: [0.25, 0.46, 0.45, 0.94],
              type: "spring",
              stiffness: 40,
              damping: 20,
            }}
            className={`relative z-20 px-6 text-center md:px-24 ${isMobile ? "max-w-full" : "mx-auto max-w-6xl"}`}
            style={{ textShadow: "rgba(0,0,0,0.4) 0px 2px 4px" }}
          >
            <h1
              id="hero-title"
              className={`mb-8 font-serif font-bold leading-tight tracking-tight text-white md:mb-12 ${isMobile ? "text-2xl" : "text-4xl md:text-6xl"}`}
              aria-label={manifestoState.ariaLabel}
            >
              {titleWords.map((word, wordIndex) => (
                <motion.span
                  key={wordIndex}
                  initial={{ opacity: 0, filter: "blur(20px)", scale: 1.1 }}
                  animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                  transition={{
                    delay: wordIndex * 0.2,
                    duration: 2.2,
                    type: "spring",
                    stiffness: 30,
                    damping: 25,
                  }}
                  className="mx-1 inline-block"
                  style={{ textShadow: "rgba(0,0,0,0.4) 0px 2px 4px" }}
                >
                  {word}
                </motion.span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 1.2 }}
              className="mx-auto mb-12 max-w-4xl text-lg font-light leading-relaxed text-white/80 md:text-xl"
              style={{ textShadow: "rgba(0,0,0,0.4) 0px 1px 2px" }}
            >
              {manifestoState.subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 1.5 }}
              className={`${isMobile ? "flex flex-col gap-4 overflow-x-auto" : "grid grid-cols-3 gap-8 md:gap-16"} mx-auto max-w-4xl border-t border-white/20 pt-10`}
              style={{ textShadow: "rgba(0,0,0,0.4) 0px 1px 2px" }}
            >
              {manifestoState.stats.map((stat, index) => (
                <motion.div
                  key={index}
                  className={`text-center ${isMobile ? "flex-shrink-0" : ""}`}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.6 + index * 0.15,
                    duration: 1.8,
                    type: "spring",
                    stiffness: 40,
                    damping: 20,
                  }}
                >
                  <div className="relative mb-2 overflow-hidden">
                    <motion.div
                      className="text-xs font-bold uppercase tracking-widest text-brand-primary"
                      initial={{ y: "100%" }}
                      animate={{ y: "0%" }}
                      transition={{ delay: 1 + index * 0.15, duration: 1 }}
                    >
                      {stat.label}
                    </motion.div>
                  </div>
                  <div className="relative overflow-hidden">
                    <motion.div
                      className={`font-serif text-white ${isMobile ? "text-lg" : "text-xl md:text-2xl"}`}
                      initial={{ y: "100%" }}
                      animate={{ y: "0%" }}
                      transition={{ delay: 1.2 + index * 0.15, duration: 1 }}
                    >
                      {stat.value}
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.5, duration: 1.2 }}
              className="mt-12"
            >
              <Link
                href={getCtaHref()}
                className="mx-auto flex min-h-[48px] items-center gap-3 rounded-full border border-brand-primary/30 bg-brand-primary/10 px-8 py-4 font-bold text-white backdrop-blur-md transition-all duration-300 hover:bg-brand-primary/20"
                aria-label={`اتخاذ إجراء: ${manifestoState.cta}`}
              >
                <MessageCircle className="h-5 w-5" />
                {manifestoState.cta}
              </Link>
            </motion.div>

            <div className="sr-only" aria-live="polite">
              <p>الركيزة الحالية: {manifestoState.pillar}</p>
              <p>العنوان الشعري: {manifestoState.poeticTitle}</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {isVideoReady && !isExiting ? (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-1 z-5"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: [0, 0.3, 0.6, 0.3, 0], opacity: [0, 0.6, 0.3, 0.6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background: "linear-gradient(90deg, transparent, rgba(197, 160, 89, 0.3), transparent)",
            filter: "blur(1px)",
          }}
        />
      ) : null}

      {!isMobile ? (
        <motion.div
          className="pointer-events-none absolute inset-0 z-15"
          animate={{ x: mousePosition.x, y: mousePosition.y }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="h-full w-full" />
        </motion.div>
      ) : null}
    </section>
  );
}
