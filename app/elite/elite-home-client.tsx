"use client";

/**
 * ELITE HOME CLIENT
 * Client-side Elite Homepage with all sections
 * 
 * CLASSIFICATION: EXTEND
 * Premium homepage combining reused and extended components
 */

import { EliteHeader } from "@/components/elite/layout/elite-header";
import { EliteHero } from "@/components/elite/home/elite-hero";
import { EliteRoomShowcase } from "@/components/elite/home/elite-room-showcase";
import { EliteLegacySection } from "@/components/elite/home/elite-legacy-section";
import Footer from "@/components/Footer";
import { logoutEliteUser } from "./actions/elite-actions";
import type { ProjectInsight, SmartCTA } from "@/lib/elite/feature-engine";

interface EliteHomeData {
  isAuthenticated?: boolean;
  greeting?: string;
  primaryCTA?: SmartCTA;
  secondaryCTAs?: SmartCTA[];
  alertMessage?: string | null;
  encouragementMessage?: string | null;
  showUrgency?: boolean;
  showImpact?: boolean;
  showCelebration?: boolean;
  insight?: ProjectInsight;
}

interface EliteHomeClientProps {
  initialData: EliteHomeData | null;
  isAuthenticated: boolean;
}

export default function EliteHomeClient({ initialData, isAuthenticated }: EliteHomeClientProps) {
  const handleLogout = async () => {
    await logoutEliteUser();
  };

  // A data-loading failure is shown as an unavailable account state rather than
  // inventing a membership offer for a visitor who has no Elite access.
  const data: EliteHomeData = initialData || {
    isAuthenticated: true,
    greeting: "بيانات الحساب غير متاحة الآن",
    primaryCTA: {
      type: "continue_project",
      label: "فتح لوحة المشروع",
      description: "حاول فتح لوحة المشروع أو تواصل مع الفريق عند استمرار المشكلة.",
      priority: 100,
      urgency: false,
    },
    secondaryCTAs: [],
    alertMessage: null,
    encouragementMessage: null,
    showUrgency: false,
    showImpact: false,
    showCelebration: false,
  };

  return (
    <main className="relative min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <EliteHeader 
        showUserMenu={isAuthenticated} 
        onLogout={handleLogout}
      />

      {/* Hero Section */}
      <EliteHero
        greeting={data.greeting || "أهلاً بك في النخبة"}
        primaryCTA={data.primaryCTA || {
          type: "continue_project",
          label: "فتح لوحة المشروع",
          description: "اعرض البيانات المتاحة لحسابك.",
          priority: 100,
          urgency: false,
        }}
        secondaryCTAs={data.secondaryCTAs || []}
        alertMessage={data.alertMessage || null}
        encouragementMessage={data.encouragementMessage || null}
        showUrgency={data.showUrgency || false}
        showImpact={data.showImpact || false}
        showCelebration={data.showCelebration || false}
        insight={data.insight}
      />

      {/* Room Showcase */}
      <EliteRoomShowcase />

      {/* Legacy Section */}
      <EliteLegacySection />

      {/* Footer */}
      <Footer />
    </main>
  );
}
