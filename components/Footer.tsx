"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import type { RuntimeConfig } from "@/lib/runtime-config";
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
};

export default function Footer({ contactEmail, contactPhone, businessAddress }: FooterProps) {
  const currentLang = useSessionStore((state) => state.language);
  const isRTL = currentLang === "ar";
  const email = contactEmail ?? "azenithliving@gmail.com";
  const phone = contactPhone ?? "201090819584";
  const officeAddress = businessAddress ?? "السلام، القاهرة، مصر";

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
              <p className="mt-6 text-sm font-light italic leading-relaxed text-gray-400">{isRTL ? "راحة وفخامة تدوم إلى الأبد" : "Comfort and luxury that lasts forever"}</p>
              <p className="mt-3 text-[10px] font-mono uppercase tracking-wider text-gray-600">
                Azenith OS: Autonomous Manufacturing System
              </p>
            </motion.div>
          </motion.div>

          <motion.div variants={columnVariants} className="space-y-8">
            <h4 className="text-xs font-light uppercase tracking-widest text-gray-500">{isRTL ? "الملاحة الذكية" : "Smart Navigation"}</h4>
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
            <h4 className="text-xs font-light uppercase tracking-widest text-gray-500">{isRTL ? "تواصل مباشر" : "Direct Contact"}</h4>
            <ul className="space-y-4">
              <li className="text-sm font-light text-gray-300">
                <span className="text-gray-600">{isRTL ? "البريد:" : "Email:"}</span>{" "}
                <a href={`mailto:${email}`} className="transition-all duration-300 hover:text-[#C5A059]">
                  {email}
                </a>
              </li>
              <li className="text-sm font-light text-gray-300">
                <span className="text-gray-600">{isRTL ? "الهاتف:" : "Phone:"}</span>{" "}
                <a href={`tel:${phone}`} className="transition-all duration-300 hover:text-[#C5A059]">
                  {phone}
                </a>
              </li>
              <li className="text-sm font-light text-gray-300">
                <span className="text-gray-600">{isRTL ? "العنوان:" : "Address:"}</span> <span>{officeAddress}</span>
              </li>
            </ul>
          </motion.div>
        </div>
      </motion.div>

      <div className="border-t border-white/[0.05]">
        <div className="mx-auto max-w-7xl px-6 py-6 md:px-12 lg:px-16">
          <div className="flex flex-col items-center justify-between gap-4 text-[10px] font-mono tracking-widest md:flex-row">
            <span className="text-gray-600">© {new Date().getFullYear()} AZENITH LIVING // ALL RIGHTS RESERVED</span>
            <span className="text-gray-600">
              SYSTEM_STATUS: OPERATIONAL // BY:{" "}
              <span className="text-[#C5A059] drop-shadow-[0_0_8px_rgba(197,160,89,0.5)]">ALAA_AZIZ</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
