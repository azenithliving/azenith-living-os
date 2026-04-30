"use client";

import { usePathname } from "next/navigation";
import ConsultantWidget from "@/components/ConsultantWidget";

export default function ConsultantWidgetWrapper() {
  const pathname = usePathname();
  const isHiddenPage = pathname?.startsWith("/admin");

  if (isHiddenPage) return null;

  return <ConsultantWidget />;
}
