import type { Metadata } from "next";

import { Toaster } from "react-hot-toast";

import { Providers } from "./providers";
import { SITE_METADATA } from "@/lib/metadata-translations";
import "./globals.css";

// Default metadata (Arabic - primary market)
export const metadata: Metadata = {
  title: SITE_METADATA.ar.title,
  description: SITE_METADATA.ar.description,
  keywords: SITE_METADATA.ar.keywords,
  openGraph: {
    title: SITE_METADATA.ar.ogTitle,
    description: SITE_METADATA.ar.ogDescription,
  },
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar-EG" dir="rtl" className="h-full antialiased" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="min-h-full bg-brand-secondary font-sans text-brand-accent" suppressHydrationWarning>
        <Providers>{children}</Providers>
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
      </body>
    </html>
  );
}
