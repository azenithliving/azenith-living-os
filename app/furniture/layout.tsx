import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "كتالوج أثاث فاخر حسب الغرفة",
  description:
    "تصفح كتالوج أثاث أزينث ليفينج: كنب، أسرّة، طاولات، وحدات تخزين، وقطع مخصصة لكل غرفة بتصميم فاخر.",
  path: "/furniture",
  keywords: ["أثاث فاخر", "كنب مودرن", "أثاث مخصص", "كتالوج أثاث", "Furniture Egypt"],
});

export default function FurnitureLayout({ children }: { children: React.ReactNode }) {
  return children;
}
