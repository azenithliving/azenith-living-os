"use client";

import { useState, useCallback, useRef } from "react";

interface HoverState {
  score: number;
  hoveredImage: number | null;
  feedback: string | null;
}

export function useImageTracking() {
  const [state, setState] = useState<HoverState>({
    score: 0,
    hoveredImage: null,
    feedback: null,
  });
  
  const timersRef = useRef<Map<number, number>>(new Map());
  const triggeredRef = useRef<Set<number>>(new Set());

  const onHoverStart = useCallback((imageIndex: number) => {
    // Clear existing timer
    const existing = timersRef.current.get(imageIndex);
    if (existing) window.clearTimeout(existing);
    
    setState(prev => ({ ...prev, hoveredImage: imageIndex }));
    
    // Set 2-second timer for +2 score
    const timer = window.setTimeout(() => {
      if (!triggeredRef.current.has(imageIndex)) {
        triggeredRef.current.add(imageIndex);
        
        // Log image_view_deep event specifically
        console.log(`[image_view_deep] Image ${imageIndex} hovered for 2+ seconds (+2 points)`);
        
        setState(prev => {
          const newScore = prev.score + 2;
          return {
            ...prev,
            score: newScore,
            feedback: `+2 pts! Image ${imageIndex} (Total: ${newScore})`,
          };
        });
        // Clear feedback after 2 seconds
        window.setTimeout(() => {
          setState(prev => ({ ...prev, feedback: null }));
        }, 2000);
      }
    }, 2000);
    
    timersRef.current.set(imageIndex, timer);
  }, []);

  const onHoverEnd = useCallback((imageIndex: number) => {
    const timer = timersRef.current.get(imageIndex);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(imageIndex);
    }
    setState(prev => ({ ...prev, hoveredImage: null }));
  }, []);

  return {
    score: state.score,
    hoveredImage: state.hoveredImage,
    feedback: state.feedback,
    onHoverStart,
    onHoverEnd,
  };
}
