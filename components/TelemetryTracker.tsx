"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function TelemetryTracker() {
  const pathname = usePathname();
  const hoveredElementsRef = useRef<string[]>([]);

  useEffect(() => {
    // We only track if there's a session ID established by the Consultant Widget
    function generateSessionId(): string {
      return `zenith_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    const getSessionId = () => {
      let sid = localStorage.getItem("azenith_session_id");
      if (!sid) {
        sid = generateSessionId();
        localStorage.setItem("azenith_session_id", sid);
      }
      return sid;
    };

    const sessionId = getSessionId();
    let attentionScore = 0;

    // Derive a readable interest tag from any hovered/clicked element.
    const deriveTag = (e: MouseEvent): string | null => {
      const target = e.target as HTMLElement | null;
      if (!target) return null;

      // 1. Explicit data-telemetry attributes are the cleanest signal.
      const tagged = (target.closest("[data-telemetry]") as HTMLElement | null);
      const explicit = tagged?.getAttribute("data-telemetry");
      if (explicit && explicit.trim()) return explicit.trim().slice(0, 80);

      // 2. Fallback: any image with a meaningful alt text.
      const img = target.closest("img") as HTMLImageElement | null;
      if (img && img.alt && img.alt.trim()) return `صورة: ${img.alt.trim().slice(0, 80)}`;

      // 3. Fallback: gallery/room/furniture links.
      const link = target.closest('a[href*="/rooms"], a[href*="/furniture"], a[href*="/gallery"]') as HTMLAnchorElement | null;
      if (link) return `رابط: ${link.getAttribute("href")?.slice(0, 80)}`;

      return null;
    };

    const recordInterest = (e: MouseEvent) => {
      const tag = deriveTag(e);
      if (!tag) return;
      const prev = hoveredElementsRef.current;
      if (prev.includes(tag)) return;
      hoveredElementsRef.current = [...prev, tag].slice(-5); // keep last 5
      attentionScore += 5; // boost attention when looking at tagged items
    };

    // Listen for custom elements that have data-telemetry tags
    const handleMouseOver = (e: MouseEvent) => recordInterest(e);
    const handleClick = (e: MouseEvent) => recordInterest(e);

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
    window.addEventListener("click", handleClick);
    window.addEventListener("scroll", handleScroll);

    // Debounced sync to Edge API
    const syncInterval = setInterval(() => {
      if (attentionScore > 0 || hoveredElementsRef.current.length > 0) {
        fetch("/api/telemetry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            path: pathname,
            hoveredElements: hoveredElementsRef.current,
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
      window.removeEventListener("click", handleClick);
      window.removeEventListener("scroll", handleScroll);
      clearInterval(syncInterval);
    };
  }, [pathname]);

  return null; // Invisible component
}
