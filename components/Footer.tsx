"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "react-hot-toast";
import { subscribeToNewsletter } from "@/app/actions/subscribeAction";

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

const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "azenithliving@gmail.com";
const phone = process.env.NEXT_PUBLIC_CONTACT_PHONE || "201090819584";
const officeAddress = process.env.NEXT_PUBLIC_OFFICE_ADDRESS || "al salam_cairo_egypt";

export default function Footer() {
  const [eliteEmail, setEliteEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleEliteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!eliteEmail.trim()) {
      toast.error("Please enter your email address");
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    formData.append("email", eliteEmail);
    formData.append("source", "footer_elite_form");

    try {
      const result = await subscribeToNewsletter(formData);

      if (result.success) {
        toast.success(result.message);
        setEliteEmail("");
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("An unexpected error occurred. Please try again.");
      console.error("Newsletter subscription error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <footer className="relative z-20 border-t border-[#1A1A1A] bg-black">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        className="mx-auto max-w-7xl px-6 py-24 md:px-12 lg:px-16"
      >
        <div className="grid grid-cols-1 items-start gap-12 md:grid-cols-4 md:gap-16 lg:gap-32">
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
              <p className="mt-6 text-sm font-light italic leading-relaxed text-gray-400">
                راحة وفخامة تدوم إلى الأبد
              </p>
              <p className="mt-3 text-[10px] font-mono uppercase tracking-wider text-gray-600">
                Azenith OS: Autonomous Manufacturing System
              </p>
            </motion.div>
          </motion.div>

          <motion.div variants={columnVariants} className="space-y-8">
            <h4 className="text-xs font-light uppercase tracking-widest text-gray-500">الملاحة الذكية</h4>
            <ul className="space-y-4">
              {[
                { label: "قصة الإرث", href: "/about" },
                { label: "استكشف الوحدات", href: "/rooms" },
                { label: "معرض الأثاث", href: "/furniture" },
                { label: "ابدأ رحلتك", href: "/start" },
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
            <h4 className="text-xs font-light uppercase tracking-widest text-gray-500">تواصل مباشر</h4>
            <ul className="space-y-4">
              <li className="text-sm font-light text-gray-300">
                <span className="text-gray-600">البريد:</span>{" "}
                <a href={`mailto:${email}`} className="transition-all duration-300 hover:text-[#C5A059]">
                  {email}
                </a>
              </li>
              <li className="text-sm font-light text-gray-300">
                <span className="text-gray-600">الهاتف:</span>{" "}
                <a href={`tel:${phone}`} className="transition-all duration-300 hover:text-[#C5A059]">
                  {phone}
                </a>
              </li>
              <li className="text-sm font-light text-gray-300">
                <span className="text-gray-600">العنوان:</span> <span>{officeAddress}</span>
              </li>
            </ul>
          </motion.div>

          <motion.div variants={columnVariants} className="space-y-8">
            <h4 className="text-xs font-light uppercase tracking-widest text-gray-500">قائمة النخبة</h4>
            <form onSubmit={handleEliteSubmit} className="space-y-6">
              <div className="relative">
                <label htmlFor="footer-email" className="sr-only">
                  البريد الإلكتروني
                </label>
                <input
                  id="footer-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={eliteEmail}
                  onChange={(e) => setEliteEmail(e.target.value)}
                  placeholder="أدخل بريدك الإلكتروني"
                  className="w-full border-0 border-b border-[#C5A059]/30 bg-transparent px-0 py-3 text-sm font-light text-white transition-all duration-500 placeholder:font-light placeholder:text-gray-600 focus:border-[#C5A059] focus:outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="group flex w-full items-center justify-center gap-2 border border-[#C5A059] px-6 py-4 text-xs font-light uppercase tracking-widest text-[#C5A059] transition-all duration-500 hover:bg-[#C5A059] hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#C5A059]/30 border-t-[#C5A059]" />
                    Processing...
                  </span>
                ) : (
                  <>
                    انضم الآن
                    <ChevronLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
                  </>
                )}
              </button>
            </form>
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
