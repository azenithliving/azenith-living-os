import type { Metadata } from "next";
import { getTranslations } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import { Toaster } from "react-hot-toast";

import { Providers } from "./providers";
import "./globals.css";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return {
    title: t('title'),
    description: t('description'),
    keywords: t('keywords'),
    icons: { icon: "/favicon.png" },
  };
}

export default async function LocaleLayout({
  children,
  params
}: Props) {
  const { locale } = await params;

  // Providing all messages to the client side
  const messages = await getMessages();

  // Determine text direction based on locale
  const isRTL = locale === 'ar';

  return (
    <html lang={locale} dir={isRTL ? 'rtl' : 'ltr'} className="h-full antialiased" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="min-h-full bg-brand-secondary font-sans text-brand-accent" suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
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
