import type { Metadata } from "next";

import { getRuntimeConfig } from "@/lib/runtime-config";
import { Toaster } from "react-hot-toast";

import { Providers } from "./providers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const appConfig = await getRuntimeConfig();

  return {
    title: `${appConfig.brandNameAr} | تصميم داخلي فاخر`,
    description: `${appConfig.freeHookOffer} مع تجربة عربية أولًا ومسار تحويل واضح من الاستكشاف حتى التواصل.`,
    icons: { icon: appConfig.faviconPath },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar-EG" dir="rtl" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full bg-brand-secondary font-sans text-brand-accent">
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
