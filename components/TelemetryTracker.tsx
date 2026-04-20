"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function TelemetryTracker() {
  const pathname = usePathname();
  const [hoveredElements, setHoveredElements] = useState<string[]>([]);

  useEffect(() => {
    // We only track if there's a session ID established by the Consultant Widget
    const getSessionId = () => {
      // In a real app, this might be a cookie or a global state.
      // For now, we fetch it from localStorage where ConsultantWidget might store it,
      // or we just establish a tracking ID.
      let sid = localStorage.getItem("azenith_visitor_id");
      if (!sid) {
        sid = `vis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem("azenith_visitor_id", sid);
      }
      return sid;
    };

    const sessionId = getSessionId();
    let attentionScore = 0;
    
    // Listen for custom elements that have data-telemetry tags
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.getAttribute("data-telemetry");
      if (tag && !hoveredElements.includes(tag)) {
        setHoveredElements(prev => {
          const next = [...prev, tag].slice(-5); // keep last 5
          return next;
        });
        attentionScore += 5; // boost attention when looking at tagged items
      }
    };

    // Calculate generic attention score based on scroll activity
    let scrollTimer: any;
    const handleScroll = () => {
      clearTimeout(scrollTimer);
      attentionScore += 0.5;
      scrollTimer = setTimeout(() => {
        // stopped scrolling
      }, 150);
    };

    window.addEventListener("mouseover", handleMouseOver);
    window.addEventListener("scroll", handleScroll);

    // Debounced sync to Edge API
    const syncInterval = setInterval(() => {
      if (attentionScore > 0 || hoveredElements.length > 0) {
        fetch("/api/telemetry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            path: pathname,
            hoveredElements,
            attentionScore: Math.min(attentionScore, 100) // cap at 100
          }),
          // Use keepalive to ensure it sends even if they navigate away
          keepalive: true
        }).catch(() => { /* silent fail for tracking */ });
        
        // Decay attention score slowly
        attentionScore = Math.max(0, attentionScore - 2);
      }
    }, 5000); // Sync every 5 seconds

    return () => {
      window.removeEventListener("mouseover", handleMouseOver);
      window.removeEventListener("scroll", handleScroll);
      clearInterval(syncInterval);
    };
  }, [pathname, hoveredElements]);

  return null; // Invisible component
}
