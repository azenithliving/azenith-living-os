import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "ابدأ رحلة التصميم الداخلي",
  description:
    "ابدأ رحلة التصميم الذكي مع أزينث ليفينج وحدد نوع المساحة، الميزانية، الطابع، والخدمة المطلوبة في خطوات بسيطة.",
  path: "/start",
  keywords: ["ابدأ تصميم", "تصميم داخلي ذكي", "ميزانية تشطيب", "استشارة تصميم"],
});

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
