import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "اطلب تصميم داخلي من أزينث ليفينج",
  description:
    "أرسل طلبك لفريق أزينث ليفينج للحصول على تصور مبدئي لتصميم داخلي فاخر يناسب مساحتك وميزانيتك.",
  path: "/request",
  keywords: ["طلب تصميم داخلي", "استشارة ديكور", "تشطيب شقة", "تصميم فيلا"],
});

export default function RequestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
