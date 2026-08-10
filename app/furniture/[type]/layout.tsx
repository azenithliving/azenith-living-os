import type { Metadata } from "next";

import { buildPageMetadata, FURNITURE_SEO_TYPES } from "@/lib/seo";

type FurnitureTypeLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ type: string }>;
};

export async function generateMetadata({ params }: FurnitureTypeLayoutProps): Promise<Metadata> {
  const { type } = await params;
  const pageSeo = FURNITURE_SEO_TYPES[type];

  if (!pageSeo) {
    return {
      title: "أثاث فاخر",
      description: "كتالوج أثاث فاخر من أزينث ليفينج حسب الغرفة والمساحة.",
      robots: { index: false, follow: true },
    };
  }

  return buildPageMetadata({
    title: pageSeo.title,
    description: pageSeo.description,
    path: `/furniture/${type}`,
    keywords: [pageSeo.title, "أثاث فاخر", "Luxury furniture"],
  });
}

export default function FurnitureTypeLayout({ children }: FurnitureTypeLayoutProps) {
  return children;
}
