import type { Metadata } from "next";

import { Toaster } from "react-hot-toast";

import { Providers } from "./providers";
import ConsultantWidgetWrapper from "./ConsultantWidgetWrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "أزينث ليفينج | تصميم داخلي فاخر في مصر",
  description: "نحول المساحات إلى تجارب فاخرة. خدمات تصميم داخلي متميزة للمنازل والشركات في القاهرة وكل مصر.",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased" data-scroll-behavior="smooth" suppressHydrationWarning>
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
        <ConsultantWidgetWrapper />
      </body>
    </html>
  );
}
