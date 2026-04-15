"use client";

import { usePathname } from "next/navigation";
import ConsultantWidget from "@/components/ConsultantWidget";

export default function ConsultantWidgetWrapper() {
  const pathname = usePathname();
  const isAdminPage = pathname?.startsWith("/admin");

  if (isAdminPage) return null;

  return <ConsultantWidget />;
}
