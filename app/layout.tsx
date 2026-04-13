import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Azenith Living | Luxury Interior Design in Egypt",
  description: "We transform spaces into luxury experiences. Premium interior design services for homes and businesses in Cairo and all of Egypt.",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
