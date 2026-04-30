"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import useSessionStore, { type BehavioralReport, type UserPersona, type StylePreference } from "@/stores/useSessionStore";

// Weight constants for different intent levels
const INTENT_WEIGHTS = {
  LOW: 1,      // Hover without clicking
  MEDIUM: 3,   // Opening lightbox + scrolling
  HIGH: 5,     // Re-viewing same image/style multiple times
};

// Time thresholds (ms)
const IDLE_THRESHOLD = 30000;     // 30 seconds
const HOVER_THRESHOLD = 2000;     // 2 seconds for deep view
const TOUCH_HOLD_THRESHOLD = 800; // 800ms for "hold & press"
const SLOW_SCROLL_THRESHOLD = 150;// ms per pixel (slow scroll detection)
const STORE_UPDATE_THROTTLE = 10000; // 10 seconds - HARD LIMIT
const BUFFER_FLUSH_INTERVAL = 30000; // 30 seconds

interface TrackingSession {
  startTime: number;
  lastActivity: number;
  isActive: boolean;
  viewedImages: Set<string>;
  viewedStyles: Map<string, number>;
  roomTimeSpent: Map<string, number>;
}

interface MicroInteraction {
  type: string;
  weight: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export function useBehavioralTracking(roomId: string, style: string) {
  // Get store actions - use destructuring to get stable references
  const processInteraction = useSessionStore((state) => state.processInteraction);
  const trackEvent = useSessionStore((state) => state.trackEvent);
  const updateProfile = useSessionStore((state) => state.updateProfile);
  const addRoomIntent = useSessionStore((state) => state.addRoomIntent);
  const userProfile = useSessionStore((state) => state.userProfile);

  // Focus and idle tracking
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Throttling refs - CRITICAL for preventing infinite loops
  const lastStoreUpdateRef = useRef<number>(0);
  const lastReportGenerationRef = useRef<number>(0);
  const isUpdatingRef = useRef<boolean>(false);
  
  // Smart Data Buffering - collect micro-interactions locally
  const interactionBufferRef = useRef<MicroInteraction[]>([]);
  
  // Session tracking
  const sessionRef = useRef<TrackingSession>({
    startTime: Date.now(),
    lastActivity: Date.now(),
    isActive: true,
    viewedImages: new Set(),
    viewedStyles: new Map(),
    roomTimeSpent: new Map(),
  });

  // Touch tracking for mobile
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const scrollVelocityRef = useRef<number[]>([]);

  // Helper: Check if we can update store (10 second throttle)
  const canUpdateStore = useCallback((): boolean => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastStoreUpdateRef.current;
    return timeSinceLastUpdate >= STORE_UPDATE_THROTTLE && !isUpdatingRef.current;
  }, []);

  // Helper: Throttled store update
  const throttledUpdateProfile = useCallback((updates: Parameters<typeof updateProfile>[0]) => {
    if (!canUpdateStore()) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[BehavioralTracking] Store update throttled");
      }
      return;
    }
    
    isUpdatingRef.current = true;
    lastStoreUpdateRef.current = Date.now();
    
    try {
      updateProfile(updates);
    } finally {
      // Reset flag after a short delay to prevent rapid successive calls
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 100);
    }
  }, [updateProfile, canUpdateStore]);

  // Reset idle timer on activity
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    setIsIdle(false);
    sessionRef.current.lastActivity = Date.now();

    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, IDLE_THRESHOLD);
  }, []);

  // Focus tracking
  useEffect(() => {
    const handleFocus = () => {
      setIsWindowFocused(true);
      sessionRef.current.isActive = true;
      resetIdleTimer();
    };

    const handleBlur = () => {
      setIsWindowFocused(false);
      sessionRef.current.isActive = false;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsWindowFocused(false);
        sessionRef.current.isActive = false;
      } else {
        setIsWindowFocused(true);
        sessionRef.current.isActive = true;
        resetIdleTimer();
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [resetIdleTimer]);

  // Track room entry - FIXED: removed dependencies that cause loops
  useEffect(() => {
    // Only run once on mount
    addRoomIntent(roomId);

    // Track style view
    const currentStyleCount = sessionRef.current.viewedStyles.get(style) || 0;
    sessionRef.current.viewedStyles.set(style, currentStyleCount + 1);

    // Check for high intent pattern (re-viewing same style)
    if (currentStyleCount >= 2) {
      processInteraction("style_repeat_view", INTENT_WEIGHTS.HIGH);
      trackEvent("high_intent_pattern", `style_revisit_${style}`);
    }

    return () => {
      // Calculate time spent on room when leaving
      const timeSpent = Date.now() - sessionRef.current.startTime;
      const currentRoomTime = sessionRef.current.roomTimeSpent.get(roomId) || 0;
      sessionRef.current.roomTimeSpent.set(roomId, currentRoomTime + timeSpent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]); // Only depend on roomId, not on store functions

  // Smart Data Buffering: Flush buffer to store every 30 seconds
  useEffect(() => {
    const flushInterval = setInterval(() => {
      if (interactionBufferRef.current.length === 0) return;
      
      // Calculate aggregated scores from buffer
      const interactions = [...interactionBufferRef.current];
      interactionBufferRef.current = []; // Clear buffer
      
      const totalWeight = interactions.reduce((sum, i) => sum + i.weight, 0);
      
      if (totalWeight > 0 && canUpdateStore()) {
        // Update lead score with aggregated weight
        processInteraction("buffered_interactions", totalWeight);
        
        if (process.env.NODE_ENV !== "production") {
          console.log(`[BehavioralTracking] Flushed ${interactions.length} interactions, weight: ${totalWeight}`);
        }
      }
    }, BUFFER_FLUSH_INTERVAL);

    return () => clearInterval(flushInterval);
  }, [processInteraction, canUpdateStore]);

  // Image view tracking with focus check - adds to buffer
  const trackImageView = useCallback(
    (imageIndex: number, isRevisit: boolean = false) => {
      if (!isWindowFocused || isIdle) return;

      const imageKey = `${roomId}_${style}_${imageIndex}`;
      const hasViewed = sessionRef.current.viewedImages.has(imageKey);

      // Add to buffer instead of immediate store update
      if (isRevisit || hasViewed) {
        interactionBufferRef.current.push({
          type: "room_image_revisit",
          weight: INTENT_WEIGHTS.HIGH,
          timestamp: Date.now(),
          metadata: { imageKey, roomId, style },
        });
        trackEvent("high_intent_image", `revisit_${imageKey}`);
      } else {
        interactionBufferRef.current.push({
          type: "room_image_view",
          weight: INTENT_WEIGHTS.MEDIUM,
          timestamp: Date.now(),
          metadata: { imageKey, roomId, style },
        });
        sessionRef.current.viewedImages.add(imageKey);
      }

      resetIdleTimer();
    },
    [isWindowFocused, isIdle, roomId, style, trackEvent, resetIdleTimer]
  );

  // Hover tracking with weighted scoring - adds to buffer
  const trackHover = useCallback(
    (elementType: string, duration: number) => {
      if (!isWindowFocused || isIdle) return;

      // Only count if hover lasted > 2 seconds
      if (duration >= HOVER_THRESHOLD) {
        interactionBufferRef.current.push({
          type: `${elementType}_deep_hover`,
          weight: INTENT_WEIGHTS.LOW,
          timestamp: Date.now(),
          metadata: { duration, elementType },
        });
      }

      resetIdleTimer();
    },
    [isWindowFocused, isIdle, resetIdleTimer]
  );

  // Image hover long tracking - +2 for deep image hovers (2+ seconds)
  const trackImageHoverLong = useCallback(
    (imageIndex: number, duration: number) => {
      if (!isWindowFocused || isIdle) return;

      // Only count if hover lasted > 2 seconds
      if (duration >= HOVER_THRESHOLD) {
        const imageKey = `${roomId}_${style}_${imageIndex}`;
        
        interactionBufferRef.current.push({
          type: "image_hover_long",
          weight: INTENT_WEIGHTS.MEDIUM, // +2 points for deep image hover
          timestamp: Date.now(),
          metadata: { 
            imageIndex, 
            imageKey,
            roomId, 
            style, 
            duration 
          },
        });
        
        trackEvent("deep_engagement", `image_hover_long_${imageIndex}`);
        
        if (process.env.NODE_ENV !== "production") {
          console.log(`[BehavioralTracking] Image ${imageIndex} hovered for ${duration}ms - +2 points`);
        }
      }

      resetIdleTimer();
    },
    [isWindowFocused, isIdle, roomId, style, trackEvent, resetIdleTimer]
  );

  // Mobile touch tracking
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    },
    []
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent, elementType: string) => {
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const duration = Date.now() - touchStartRef.current.time;
      const distance = Math.sqrt(
        Math.pow(touch.clientX - touchStartRef.current.x, 2) +
          Math.pow(touch.clientY - touchStartRef.current.y, 2)
      );

      // "Hold & Press" detection: long press with minimal movement
      if (duration >= TOUCH_HOLD_THRESHOLD && distance < 10) {
        interactionBufferRef.current.push({
          type: "mobile_hold_press",
          weight: INTENT_WEIGHTS.HIGH,
          timestamp: Date.now(),
          metadata: { elementType, duration },
        });
        trackEvent("high_intent_mobile", `hold_press_${elementType}`);
      }

      touchStartRef.current = null;
      resetIdleTimer();
    },
    [trackEvent, resetIdleTimer]
  );

  // Scroll tracking for "Slow Scroll" detection
  const handleScroll = useCallback(
    (scrollPosition: number) => {
      if (!isWindowFocused || isIdle) return;

      const now = Date.now();
      scrollVelocityRef.current.push(now);

      // Keep only last 10 scroll events
      if (scrollVelocityRef.current.length > 10) {
        scrollVelocityRef.current.shift();
      }

      // Calculate scroll velocity
      if (scrollVelocityRef.current.length >= 2) {
        const timeDiff =
          scrollVelocityRef.current[scrollVelocityRef.current.length - 1] -
          scrollVelocityRef.current[0];
        const velocity = timeDiff / scrollVelocityRef.current.length;

        // Slow scroll detection: high time per pixel = careful reading
        if (velocity > SLOW_SCROLL_THRESHOLD) {
          interactionBufferRef.current.push({
            type: "slow_scroll_engagement",
            weight: INTENT_WEIGHTS.MEDIUM,
            timestamp: Date.now(),
            metadata: { velocity },
          });
        }
      }

      resetIdleTimer();
    },
    [isWindowFocused, isIdle, resetIdleTimer]
  );

  // Generate detailed behavioral report - THROTTLED
  const generateBehavioralReport = useCallback((): BehavioralReport | null => {
    const now = Date.now();
    
    // 10 second throttle check
    if (now - lastReportGenerationRef.current < STORE_UPDATE_THROTTLE) {
      return null;
    }
    lastReportGenerationRef.current = now;

    const totalFocusTime = Date.now() - sessionRef.current.startTime;
    const viewedStyles = sessionRef.current.viewedStyles;
    const roomTimeSpent = sessionRef.current.roomTimeSpent;

    // Calculate weighted score from buffer + history
    let weightedScore = 0;
    viewedStyles.forEach((count, styleName) => {
      if (count >= 3) {
        weightedScore += count * INTENT_WEIGHTS.HIGH;
      } else if (count >= 2) {
        weightedScore += count * INTENT_WEIGHTS.MEDIUM;
      } else {
        weightedScore += count * INTENT_WEIGHTS.LOW;
      }
    });

    // Add buffered interactions to score
    const bufferedWeight = interactionBufferRef.current.reduce((sum, i) => sum + i.weight, 0);
    weightedScore += bufferedWeight;

    // Find top interest
    let topInterest = "";
    let maxTime = 0;
    roomTimeSpent.forEach((time, room) => {
      if (time > maxTime) {
        maxTime = time;
        topInterest = room;
      }
    });

    // Determine certainty
    let certainty: "Low" | "Medium" | "High" = "Low";
    if (viewedStyles.size >= 3 && weightedScore > 50) {
      certainty = "High";
    } else if (viewedStyles.size >= 2 && weightedScore > 20) {
      certainty = "Medium";
    }

    // Generate human-readable summary
    const minutes = Math.floor(totalFocusTime / 60000);
    const topStyle = Array.from(viewedStyles.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const stylePrefs = userProfile?.stylePreferences as Record<string, StylePreference> | undefined;
    const ignoredStyles = Object.keys(stylePrefs || {}).filter(
      (s) => !viewedStyles.has(s)
    );

    const behaviorSummary = `User spent ${minutes} mins on ${topInterest || roomId}, focused specifically on ${topStyle} style${
      ignoredStyles.length > 0 ? `, and ignored ${ignoredStyles.join(", ")}` : ""
    }. Weighted engagement score: ${weightedScore}.`;

    // Convert Maps to Records for storage
    const styleAffinity: Record<string, number> = {};
    viewedStyles.forEach((count, key) => {
      styleAffinity[key] = count;
    });

    const roomEngagement: Record<string, number> = {};
    roomTimeSpent.forEach((time, key) => {
      roomEngagement[key] = Math.floor(time / 1000); // Convert to seconds
    });

    const report: BehavioralReport = {
      totalFocusTime,
      weightedScore,
      topInterest,
      certainty,
      behaviorSummary,
      styleAffinity,
      roomEngagement,
    };

    // Update store with detailed report - THROTTLED
    const userPersona: UserPersona = {
      certainty,
      preferredStyle: topStyle,
      interestLevel: weightedScore > 50 ? "Strong" : weightedScore > 20 ? "Moderate" : "Low",
      focusQuality: isIdle ? "Interrupted" : "High",
    };

    throttledUpdateProfile({
      behavioralReport: report,
      userPersona,
    });

    return report;
  }, [roomId, isIdle, userProfile, throttledUpdateProfile]);

  // Periodic report generation - only when focused and not idle
  useEffect(() => {
    const interval = setInterval(() => {
      if (isWindowFocused && !isIdle) {
        generateBehavioralReport();
      }
    }, BUFFER_FLUSH_INTERVAL);

    return () => clearInterval(interval);
  }, [isWindowFocused, isIdle, generateBehavioralReport]);

  // Force flush buffer on unmount
  useEffect(() => {
    return () => {
      // Flush any remaining interactions
      if (interactionBufferRef.current.length > 0) {
        const totalWeight = interactionBufferRef.current.reduce((sum, i) => sum + i.weight, 0);
        if (totalWeight > 0) {
          processInteraction("final_flush", totalWeight);
        }
      }
    };
  }, [processInteraction]);

  return {
    isWindowFocused,
    isIdle,
    trackImageView,
    trackHover,
    trackImageHoverLong,
    handleTouchStart,
    handleTouchEnd,
    handleScroll,
    generateBehavioralReport,
    INTENT_WEIGHTS,
    // Expose buffer info for debugging
    getBufferSize: () => interactionBufferRef.current.length,
  };
}

export type { TrackingSession, MicroInteraction };
export { INTENT_WEIGHTS };
