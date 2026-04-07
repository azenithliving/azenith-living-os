"use client";
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle } from 'lucide-react';

type HeroProps = {
  runtimeConfig: any;
};

// Azenith Manifesto Data Structure
interface ManifestoState {
  pillar: string;
  poeticTitle: string;
  subtitle: string;
  stats: Array<{ label: string; value: string }>;
  cta: string;
  ariaLabel: string;
}

export default function Hero({ runtimeConfig }: HeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [manifestoState, setManifestoState] = useState<ManifestoState | null>(null);
  const [glassOpacity, setGlassOpacity] = useState(0.3);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Listen to manifesto state changes from AzenithLegacy component
  useEffect(() => {
    const handleVideoStateChange = (event: CustomEvent) => {
      const { videoReady, isExiting: exiting, pillar, poeticTitle, subtitle, stats, cta, ariaLabel } = event.detail;
      setIsVideoReady(videoReady);
      setIsExiting(exiting);
      
      if (videoReady) {
        setManifestoState({
          pillar,
          poeticTitle,
          subtitle,
          stats,
          cta,
          ariaLabel
        });
      }
    };

    // Listen for custom events from AzenithLegacy
    window.addEventListener('videoStateChange', handleVideoStateChange as EventListener);
    
    return () => {
      window.removeEventListener('videoStateChange', handleVideoStateChange as EventListener);
    };
  }, []);

  // Mouse parallax effect (disabled on mobile)
  useEffect(() => {
    if (isMobile) return; // Disable parallax on mobile

    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const deltaX = (e.clientX - centerX) / rect.width;
        const deltaY = (e.clientY - centerY) / rect.height;
        
        // Maximum 10px shift in opposite direction
        setMousePosition({
          x: -deltaX * 10,
          y: -deltaY * 10
        });
      }
    };

    const handleMouseLeave = () => {
      setMousePosition({ x: 0, y: 0 });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isMobile]);

  const handleManifestoCTA = () => {
    // Track pillar engagement for analytics
    if (manifestoState) {
      console.log(`Manifesto CTA Clicked - Pillar: ${manifestoState.pillar}, Title: ${manifestoState.poeticTitle}`);
    }
    
    // Dynamic CTA logic based on pillar
    if (manifestoState?.pillar === 'HERITAGE' || manifestoState?.pillar === 'COMMITMENT') {
      // Navigate to about/heritage page
      window.location.href = '/about';
    } else if (manifestoState?.pillar === 'TRUST' || manifestoState?.pillar === 'QUALITY') {
      // Navigate to quality/craftsmanship
      window.location.href = '/rooms';
    } else if (manifestoState?.pillar === 'INNOVATION' || manifestoState?.pillar === 'SYNERGY') {
      // Start consultation
      window.location.href = '/start';
    }
  };

  // Split title into words for staggered animation
  const titleWords = manifestoState?.poeticTitle.split(' ') || [];

  return (
    <section ref={containerRef} className="relative h-screen flex items-center justify-center overflow-hidden font-['GE_SS_Two', 'Cairo', 'sans-serif']">
      
      <AnimatePresence mode="wait">
        {(isVideoReady && !isExiting && manifestoState) && (
          <motion.div
            key={`${currentIndex}-${manifestoState.pillar}`}
            initial={{ opacity: 0, filter: 'blur(20px)', scale: 1.1 }}
            animate={{ opacity: 1, filter: 'blur(0px)', scale: 1.0 }}
            exit={{ opacity: 0, filter: 'blur(15px)' }}
            transition={{ 
              duration: 1.8,
              ease: [0.25, 0.46, 0.45, 0.94],
              // Custom Spring for title
              type: "spring",
              stiffness: 40,
              damping: 20
            }}
            className={`relative z-20 text-center px-6 md:px-24 ${
              isMobile ? 'max-w-full' : 'max-w-6xl mx-auto'
            }`}
            style={{
              textShadow: 'rgba(0,0,0,0.4) 0px 2px 4px'
            }}
          >
            {/* SEO-Optimized Semantic Poetic Title */}
            <h2 
              className={`font-serif text-white leading-tight tracking-tight font-bold mb-8 md:mb-12 ${
                isMobile ? 'text-2xl' : 'text-4xl md:text-6xl'
              }`}
              aria-label={manifestoState.ariaLabel}
              role="heading"
              aria-level={1}
            >
              {titleWords.map((word, wordIndex) => (
                <motion.span
                  key={wordIndex}
                  initial={{ opacity: 0, filter: 'blur(20px)', scale: 1.1 }}
                  animate={{ opacity: 1, filter: 'blur(0px)', scale: 1.0 }}
                  transition={{
                    delay: wordIndex * 0.2, // Slower reveal for poetic effect
                    duration: 2.2, // High-end cinema timing
                    type: "spring",
                    stiffness: 30, // Softer spring for poetry
                    damping: 25
                  }}
                  className="inline-block mx-1"
                  style={{
                    textShadow: 'rgba(0,0,0,0.4) 0px 2px 4px'
                  }}
                >
                  {word}
                </motion.span>
              ))}
            </h2>

            {/* Subtitle - The Manifesto Story */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 1.2 }}
              className="text-white/80 text-lg md:text-xl max-w-4xl mx-auto leading-relaxed mb-12 font-light"
              style={{
                textShadow: 'rgba(0,0,0,0.4) 0px 1px 2px'
              }}
            >
              {manifestoState.subtitle}
            </motion.p>

            {/* 3-Column Factual Stats - The Core Pillars */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 1.5 }} // Reading flow timing
              className={`${
                isMobile 
                  ? 'flex flex-col gap-4 overflow-x-auto' 
                  : 'grid grid-cols-3 gap-8 md:gap-16'
              } max-w-4xl mx-auto border-t border-white/20 pt-10`}
              style={{
                textShadow: 'rgba(0,0,0,0.4) 0px 1px 2px'
              }}
            >
              {manifestoState.stats.map((stat, index) => (
                <motion.div 
                  key={index} 
                  className={`text-center ${isMobile ? 'flex-shrink-0' : ''}`}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    delay: 0.6 + index * 0.15, // Subtle reading flow
                    duration: 1.8,
                    type: "spring",
                    stiffness: 40,
                    damping: 20
                  }}
                >
                  {/* Mask-Reveal effect for label */}
                  <div className="relative overflow-hidden mb-2">
                    <motion.div 
                      className="text-brand-primary text-xs uppercase tracking-widest font-bold"
                      initial={{ y: '100%' }}
                      animate={{ y: '0%' }}
                      transition={{ delay: 1.0 + index * 0.15, duration: 1.0 }}
                      style={{
                        textShadow: 'rgba(0,0,0,0.4) 0px 1px 2px'
                      }}
                    >
                      {stat.label}
                    </motion.div>
                  </div>
                  {/* Mask-Reveal effect for value */}
                  <div className="relative overflow-hidden">
                    <motion.div 
                      className={`text-white font-serif ${
                        isMobile ? 'text-lg' : 'text-xl md:text-2xl'
                      }`}
                      initial={{ y: '100%' }}
                      animate={{ y: '0%' }}
                      transition={{ delay: 1.2 + index * 0.15, duration: 1.0 }}
                      style={{
                        textShadow: 'rgba(0,0,0,0.4) 0px 2px 4px'
                      }}
                    >
                      {stat.value}
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Smart CTA Button */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.5, duration: 1.2 }}
              className="mt-12"
            >
              <motion.button
                onClick={handleManifestoCTA}
                className="px-8 py-4 bg-brand-primary/10 backdrop-blur-md border border-brand-primary/30 text-white rounded-full font-bold hover:bg-brand-primary/20 transition-all duration-300 flex items-center gap-3 mx-auto min-h-[48px]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                animate={{
                  scale: [1, 1.05, 1], // Very slow pulse
                  opacity: [0.8, 1, 0.8],
                }}
                transition={{
                  duration: 4, // Slow pulse for luxury feel
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                aria-label={`اتخاذ إجراء: ${manifestoState.cta}`}
              >
                <MessageCircle className="h-5 w-5" />
                {manifestoState.cta}
              </motion.button>
            </motion.div>

            {/* Pillar Indicator (Hidden but accessible) */}
            <div className="sr-only" aria-live="polite">
              <p>الركيزة الحالية: {manifestoState.pillar}</p>
              <p>العنوان الشعري: {manifestoState.poeticTitle}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Pagination Dots */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2 z-30">
        {[1, 2, 3, 4, 5, 6].map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 min-h-[48px] min-w-[48px] flex items-center justify-center ${
              index === currentIndex 
                ? 'bg-brand-primary w-8' 
                : 'bg-white/30 hover:bg-white/50'
            }`}
            aria-label={`الانتقال إلى الركيزة ${index + 1}`}
          />
        ))}
      </div>

      {/* Background Audio Visualizer (Neural Interaction Layer) */}
      {isVideoReady && !isExiting && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-1 z-5"
          initial={{ scaleX: 0 }}
          animate={{ 
            scaleX: [0, 0.3, 0.6, 0.3, 0],
            opacity: [0, 0.6, 0.3, 0.6, 0]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(197, 160, 89, 0.3), transparent)',
            filter: 'blur(1px)'
          }}
        />
      )}

      {/* Subtle Mouse Parallax on Title (Desktop Only) */}
      {!isMobile && (
        <motion.div 
          className="absolute inset-0 pointer-events-none z-15"
          animate={{
            x: mousePosition.x,
            y: mousePosition.y
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30
          }}
        >
          <div className="h-full w-full" />
        </motion.div>
      )}
    </section>
  );
}
