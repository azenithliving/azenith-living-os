"use client";

import Link from "next/link";
import useSessionStore from "@/stores/useSessionStore";

interface RoomLinkProps {
  roomSlug: string;
  children: React.ReactNode;
  className?: string;
}

export default function RoomLink({ roomSlug, children, className }: RoomLinkProps) {
  const selectedStyle = useSessionStore((state) => state.selectedStyle);
  const isHydrated = useSessionStore((state) => state.isHydrated);

  // Use persisted style if available, otherwise default to modern
  const style = isHydrated ? selectedStyle : "modern";
  const href = `/rooms/${roomSlug}?style=${style}`;

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
