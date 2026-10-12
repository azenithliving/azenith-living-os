import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "متجر القطع الجاهزة",
  description:
    "قطع أثاث وتشطيبات جاهزة عند أزينث ليفينج — اتنفّزت فعلاً ومتاحة للّاقي. اللي مش لاقيه على الرفّ بننفّذه على مقاسك.",
  path: "/shop",
  keywords: ["قطع جاهزة", "أثاث جاهز", "تشطيبات داخلية", "متجر أزينث", "أثاث فاخر"],
});

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
