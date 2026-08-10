import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "عن أزينث ليفينج",
  description:
    "تعرف على أزينث ليفينج وخبرتها في التصميم الداخلي الفاخر، التشطيبات، الأثاث المخصص، وتجهيز المساحات السكنية في مصر.",
  path: "/about",
  keywords: ["شركة تصميم داخلي", "أزينث", "Azenith", "ديكور القاهرة"],
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
