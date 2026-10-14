"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import React from "react";
import type { StoreNumber } from "@/lib/store-numbers/format";

export default function MainLayout({
  children,
  storeNumbers = [],
  workingHours = null,
  noShowroom = "",
}: {
  children: React.ReactNode;
  storeNumbers?: StoreNumber[];
  /** The owner's own sentence about when the store works, quoted from its record. */
  workingHours?: string | null;
  noShowroom?: string;
}) {
  const pathname = usePathname();
  
  const isExcluded = 
    pathname?.startsWith("/admin") || 
    pathname?.startsWith("/elite") || 
    pathname?.startsWith("/gate") || 
    pathname?.startsWith("/sandbox") ||
    pathname?.startsWith("/preview");

  return (
    <div className="flex min-h-screen flex-col">
      {!isExcluded && <Header />}
      <div className="flex-1">
        {children}
      </div>
      {!isExcluded && <Footer storeNumbers={storeNumbers} workingHours={workingHours} noShowroom={noShowroom} />}
    </div>
  );
}
