"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import React from "react";

export default function MainLayout({ children }: { children: React.ReactNode }) {
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
      {!isExcluded && <Footer />}
    </div>
  );
}
