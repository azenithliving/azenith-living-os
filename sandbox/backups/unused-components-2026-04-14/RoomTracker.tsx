"use client";

import { useEffect } from "react";
import useSessionStore from "@/stores/useSessionStore";

interface RoomTrackerProps {
  roomId: string;
  style: string;
}

export default function RoomTracker({ roomId, style }: RoomTrackerProps) {
  const addRoomIntent = useSessionStore((state) => state.addRoomIntent);
  const setSelectedStyle = useSessionStore((state) => state.setSelectedStyle);
  const updateProfile = useSessionStore((state) => state.updateProfile);
  const trackEvent = useSessionStore((state) => state.trackEvent);
  const isHydrated = useSessionStore((state) => state.isHydrated);

  useEffect(() => {
    // Only track after hydration to ensure store is ready
    if (!isHydrated) return;

    // Track room intent
    addRoomIntent(roomId);

    // Sync style from URL to store if different
    if (style) {
      const currentStyle = useSessionStore.getState().selectedStyle;
      if (style !== currentStyle) {
        setSelectedStyle(style);
      }
    }

    // Update last page and track view
    updateProfile({ lastPage: `/room/${roomId}` });
    trackEvent("room_page_view");

    if (process.env.NODE_ENV !== "production") {
      console.log("RoomTracker: Viewed room", roomId, "with style", style);
    }
  }, [roomId, style, isHydrated, addRoomIntent, setSelectedStyle, updateProfile, trackEvent]);

  return null; // This is a tracking-only component
}
