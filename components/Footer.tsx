"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import type { RuntimeConfig } from "@/lib/runtime-config";
import { localForm, whatsappHref } from "@/lib/store-numbers/format";
import { arabicNumerals } from "@/lib/arabic";
import { BRAND_NAME_AR, BRAND_NAME_EN } from "@/lib/seo";
import useSessionStore from "@/stores/useSessionStore";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const columnVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

type FooterProps = {
  contactEmail?: RuntimeConfig["contactEmail"];
  contactPhone?: RuntimeConfig["contactPhone"];
  businessAddress?: RuntimeConfig["businessAddress"];
  /** Every number the store answers on, read from the store's own record by the root layout. */
  storeNumbers?: { value: string; label: string; primary: boolean }[];
  /** The owner's sentence about the working hours, quoted from his record — null when nothing is recorded. */
  workingHours?: string | null;
  /** His own words on why there is nothing to visit. */
  noShowroom?: string;
};

export default function Footer({ contactEmail, contactPhone, businessAddress, storeNumbers = [], workingHours = null, noShowroom = "" }: FooterProps) {
  const currentLang = useSessionStore((state) => state.language);
  const isRTL = currentLang === "ar";
  const email = contactEmail ?? null;
  const phone = contactPhone ?? null;
  const officeAddress = businessAddress ?? null;

  return (
    <footer className="relative z-20 border-t border-[#1A1A1A] bg-black">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        className="mx-auto max-w-7xl px-6 py-24 md:px-12 lg:px-16"
      >
        <div className="grid grid-cols-1 items-start gap-12 md:grid-cols-3 md:gap-16 lg:gap-32">
          <motion.div variants={columnVariants} className="space-y-8">
            <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.3 }} className="flex flex-col items-start">
              <Image
                src="/logo.png"
                alt="Azenith Living Logo"
                width={150}
                height={150}
                className="h-auto w-24 object-contain"
                style={{ height: 'auto' }}
              />
              <p className="mt-6 text-sm font-light italic leading-relaxed text-gray-400">{isRTL ? "تصميم داخلي يبدأ بفهم المساحة" : "Interior design that starts with understanding the space"}</p>
            </motion.div>
          </motion.div>

          <motion.div variants={columnVariants} className="space-y-8">
            <h2 className="text-xs font-light uppercase tracking-widest text-gray-400">{isRTL ? "الملاحة الذكية" : "Smart Navigation"}</h2>
            <ul className="space-y-4">
              {[
                { label: isRTL ? "قصة الإرث" : "Legacy Story", href: "/about" },
                { label: isRTL ? "استكشف الوحدات" : "Explore Units", href: "/rooms" },
                { label: isRTL ? "معرض الأثاث" : "Furniture Gallery", href: "/furniture" },
                { label: isRTL ? "ابدأ رحلتك" : "Start Journey", href: "/start" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block text-sm font-light text-gray-300 transition-all duration-300 hover:-translate-x-1 hover:text-[#C5A059]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div variants={columnVariants} className="space-y-8">
            <h2 className="text-xs font-light uppercase tracking-widest text-gray-400">{isRTL ? "تواصل مباشر" : "Direct Contact"}</h2>
            <ul className="space-y-4">
              {storeNumbers.map((n) => (
                <li key={n.value} className="text-sm font-light text-gray-300">
                  <span className="text-gray-400">{n.label}:</span>{" "}
                  <a
                    href={whatsappHref(n.value) ?? "/request"}
                    target="_blank"
                    rel="noreferrer"
                    className="transition-all duration-300 hover:text-[#C5A059]"
                    dir="ltr"
                  >
                    {arabicNumerals(localForm(n.value))}
                  </a>
                </li>
              ))}
              {workingHours ? (
                <li className="text-sm font-light leading-7 text-gray-300">
                  <span className="text-gray-400">{isRTL ? "المواعيد:" : "Hours:"}</span>{" "}
                  {String(workingHours).replace(/^مواعيد العمل[:：]\s*/, "")}
                </li>
              ) : null}
              {noShowroom ? (
                <li className="text-sm font-light leading-7 text-gray-300">{noShowroom}</li>
              ) : null}
              {email ? (
                <li className="text-sm font-light text-gray-300">
                  <span className="text-gray-400">{isRTL ? "البريد:" : "Email:"}</span>{" "}
                  <a href={`mailto:${email}`} className="transition-all duration-300 hover:text-[#C5A059]">
                    {email}
                  </a>
                </li>
              ) : null}
              {phone ? (
                <li className="text-sm font-light text-gray-300">
                  <span className="text-gray-400">{isRTL ? "الهاتف:" : "Phone:"}</span>{" "}
                  <a href={`tel:${phone}`} className="transition-all duration-300 hover:text-[#C5A059]">
                    {phone}
                  </a>
                </li>
              ) : null}
              {officeAddress ? (
                <li className="text-sm font-light text-gray-300">
                  <span className="text-gray-400">{isRTL ? "العنوان:" : "Address:"}</span> <span>{officeAddress}</span>
                </li>
              ) : null}
              {storeNumbers.length === 0 && !email && !phone && !officeAddress && !workingHours && !noShowroom ? (
                <li className="text-sm font-light text-gray-400">
                  {isRTL ? "استخدم نموذج الطلب للتواصل مع الفريق." : "Use the request form to contact the team."}
                </li>
              ) : null}
            </ul>
          </motion.div>
        </div>
      </motion.div>

      <div className="border-t border-white/[0.05]">
        <div className="mx-auto max-w-7xl px-6 py-6 md:px-12 lg:px-16">
          <div className="flex flex-col items-center justify-between gap-4 text-[10px] font-mono tracking-widest md:flex-row">
            <span className="text-gray-400">
              {isRTL
                ? arabicNumerals(`© ${new Date().getFullYear()} ${BRAND_NAME_AR} — كل الحقوق محفوظة`)
                : `© ${new Date().getFullYear()} ${BRAND_NAME_EN} // ALL RIGHTS RESERVED`}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
