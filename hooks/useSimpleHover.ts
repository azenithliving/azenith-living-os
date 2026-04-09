"use client";

import { useState, useCallback } from "react";

interface SimpleHoverState {
  score: number;
  lastHoveredImage: number | null;
  hoverStartTime: number | null;
}

/**
 * Simplified Image Hover Tracking
 * 2+ second hover = +2 score
 * Visible feedback immediately
 * No complex caching or store dependencies
 */
export function useSimpleHover() {
  const [state, setState] = useState<SimpleHoverState>({
    score: 0,
    lastHoveredImage: null,
    hoverStartTime: null,
  });

  const [feedback, setFeedback] = useState<string | null>(null);

  const handleImageHover = useCallback((imageIndex: number) => {
    setState((prev) => ({
      ...prev,
      lastHoveredImage: imageIndex,
      hoverStartTime: Date.now(),
    }));
  }, []);

  const handleImageHoverEnd = useCallback((imageIndex: number) => {
    setState((prev) => {
      if (
        prev.lastHoveredImage === imageIndex &&
        prev.hoverStartTime &&
        Date.now() - prev.hoverStartTime >= 2000
      ) {
        // 2+ seconds = +2 points
        const newScore = prev.score + 2;
        
        // Show feedback
        setFeedback(`+2 points! Image ${imageIndex + 1} (Total: ${newScore})`);
        setTimeout(() => setFeedback(null), 2000);

        console.log(`[Hover] Image ${imageIndex + 1}: +2 points (Total: ${newScore})`);
        
        return {
          ...prev,
          score: newScore,
          lastHoveredImage: null,
          hoverStartTime: null,
        };
      }
      return {
        ...prev,
        lastHoveredImage: null,
        hoverStartTime: null,
      };
    });
  }, []);

  return {
    score: state.score,
    feedback,
    handleImageHover,
    handleImageHoverEnd,
  };
}
