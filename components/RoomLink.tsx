"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import useSessionStore from "@/stores/useSessionStore";

interface RoomLinkProps {
  roomSlug: string;
  children: React.ReactNode;
  className?: string;
}

export default function RoomLink({ roomSlug, children, className }: RoomLinkProps) {
  const selectedStyle = useSessionStore((state) => state.selectedStyle);
  const isHydrated = useSessionStore((state) => state.isHydrated);
  const [resolvedStyle, setResolvedStyle] = useState("modern");

  // Update resolved style when hydration completes or style changes
  useEffect(() => {
    if (isHydrated) {
      setResolvedStyle(selectedStyle || "modern");
    }
  }, [isHydrated, selectedStyle]);

  const href = `/rooms/${roomSlug}?style=${resolvedStyle}`;

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
