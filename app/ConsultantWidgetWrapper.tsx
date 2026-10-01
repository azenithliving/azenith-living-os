"use client";

import { usePathname } from "next/navigation";
import ConsultantWidget from "@/components/ConsultantWidget";

export default function ConsultantWidgetWrapper() {
  const pathname = usePathname();
  const isHiddenPage =
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/gate") ||
    pathname?.startsWith("/elite") ||
    // The design sheet is a document he confirms and keeps. Seen on a phone, the
    // floating consultant was painted over the "your sheet is approved" panel —
    // nothing that covers a signature belongs on top of it.
    pathname?.startsWith("/passport");

  if (isHiddenPage) return null;

  return <ConsultantWidget />;
}
