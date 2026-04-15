"use client";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-[#0A0A0A]">
        {children}
      </body>
    </html>
  );
}
