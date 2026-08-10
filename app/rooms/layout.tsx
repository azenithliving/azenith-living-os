import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "غرف ومساحات بتصميم داخلي فاخر",
  description:
    "اختار المساحة التي تريد تصميمها: غرف نوم، غرف معيشة، مطابخ، دريسنج، مكاتب منزلية، حمامات، مداخل، وغرف أطفال.",
  path: "/rooms",
  keywords: ["غرف نوم", "غرف معيشة", "مطابخ", "دريسنج روم", "تصميم غرف"],
});

export default function RoomsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
