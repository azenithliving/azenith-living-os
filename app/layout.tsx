import type { Metadata } from "next";
import Script from "next/script";

import { Toaster } from "react-hot-toast";

import MainLayout from "@/components/MainLayout";
import RealityUIProvider from "@/components/RealityUIProvider";
import TelemetryTracker from "@/components/TelemetryTracker";
import { buildPageMetadata, getOrganizationJsonLd } from "@/lib/seo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

import ConsultantWidgetWrapper from "./ConsultantWidgetWrapper";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "أزينث ليفينج | تصميم داخلي فاخر وتشطيبات في مصر",
    description:
      "أزينث ليفينج تقدم تصميم داخلي فاخر، ديكور، تشطيبات، أثاث مخصص، غرف نوم، مطابخ، غرف معيشة، ودريسنج في القاهرة ومصر.",
  }),
  title: {
    default: "أزينث ليفينج | تصميم داخلي فاخر وتشطيبات في مصر",
    template: "%s | Azenith Living",
  },
  applicationName: "Azenith Living",
  authors: [{ name: "Azenith Living" }],
  creator: "Azenith Living",
  publisher: "Azenith Living",
  category: "Interior Design",
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  icons: { icon: "/favicon.png", apple: "/favicon.png" },
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(raw)) return null;
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return { r, g, b };
}

async function loadPublicRuntimeSettings(): Promise<{
  theme?: Record<string, unknown>;
  seo?: Record<string, unknown>;
}> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return {};

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  const keys = ["theme", "seo"];

  const scoped = company?.id
    ? await supabase
        .from("site_settings")
        .select("key, value")
        .eq("company_id", company.id)
        .in("key", keys)
    : null;

  const rows =
    scoped && !scoped.error
      ? scoped.data
      : (await supabase.from("site_settings").select("key, value").in("key", keys)).data;

  const out: Record<string, Record<string, unknown>> = {};
  for (const row of rows || []) {
    if (row?.key && row?.value && typeof row.value === "object") {
      out[row.key] = row.value as Record<string, unknown>;
    }
  }

  return { theme: out.theme, seo: out.seo };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await loadPublicRuntimeSettings();
  const theme = settings.theme || {};
  const seo = settings.seo || {};

  const cssVars: Record<string, string> = {};
  if (typeof theme.primaryColor === "string") {
    cssVars["--brand-primary"] = theme.primaryColor;
    const rgb = hexToRgb(theme.primaryColor);
    if (rgb) cssVars["--brand-primary-glow"] = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`;
  }

  if (typeof theme.backgroundColor === "string") {
    cssVars["--zenith-black"] = theme.backgroundColor;
    cssVars["--bg-start"] = theme.backgroundColor;
    cssVars["--bg-end"] = theme.backgroundColor;
  }

  const adsenseEnabled = seo.adsenseEnabled === true;
  const adsenseClient = typeof seo.adsenseClient === "string" ? seo.adsenseClient : "";
  const schemaData = getOrganizationJsonLd();

  return (
    <html
      lang="ar"
      dir="rtl"
      className="h-full antialiased"
      data-scroll-behavior="smooth"
      style={cssVars}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
        />
      </head>
      <body className="min-h-full bg-brand-secondary font-sans text-brand-accent" suppressHydrationWarning>
        {adsenseEnabled && adsenseClient ? (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseClient)}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        ) : null}
        <Providers>
          <TelemetryTracker />
          <RealityUIProvider />
          <MainLayout>{children}</MainLayout>
        </Providers>
        <Toaster
          position="bottom-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#1A1A1A",
              color: "#C5A059",
              border: "1px solid #C5A059",
              fontFamily: "monospace",
              fontSize: "12px",
              letterSpacing: "0.05em",
            },
            success: {
              iconTheme: {
                primary: "#C5A059",
                secondary: "#1A1A1A",
              },
            },
            error: {
              iconTheme: {
                primary: "#C5A059",
                secondary: "#1A1A1A",
              },
            },
          }}
        />
        <ConsultantWidgetWrapper />
      </body>
    </html>
  );
}
