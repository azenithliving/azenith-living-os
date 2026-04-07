"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { Instagram, Facebook, Send, ChevronLeft } from "lucide-react";
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
const phone = process.env.NEXT_PUBLIC_CONTACT_PHONE || "+20 115 490 2746";
const officeAddress = process.env.NEXT_PUBLIC_OFFICE_ADDRESS || "al salam, Cairo, Egypt";

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
    <footer className="relative z-20 bg-black border-t border-[#1A1A1A]">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        className="max-w-7xl mx-auto px-6 py-24 md:px-12 lg:px-16"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-16 lg:gap-32 items-start">
          <motion.div variants={columnVariants} className="space-y-8">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-start"
            >
              <img 
                src="/logo.png" 
                alt="Azenith Living Logo" 
                className="w-24 h-24 object-contain"
              />
              <p className="text-gray-400 text-sm font-light italic mt-6 leading-relaxed">
                راحة وفخامة تدوم إلى الأبد
              </p>
              <p className="text-[10px] text-gray-600 mt-3 font-mono tracking-wider uppercase">
                Azenith OS: Autonomous Manufacturing System
              </p>
            </motion.div>
          </motion.div>

          <motion.div variants={columnVariants} className="space-y-8">
            <h4 className="text-gray-500 text-xs font-light tracking-widest uppercase">
              الملاحة الذكية
            </h4>
            <ul className="space-y-4">
              {[
                { label: "قصة الإرث", href: "/about" },
                { label: "استكشف الوحدات", href: "/rooms" },
                { label: "معرض الأعمال", href: "/portfolio" },
                { label: "خدمات التنفيذ", href: "/services" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-300 text-sm font-light transition-all duration-300 hover:text-[#C5A059] hover:-translate-x-1 block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div variants={columnVariants} className="space-y-8">
            <h4 className="text-gray-500 text-xs font-light tracking-widest uppercase">
              تواصل مباشر
            </h4>
            <ul className="space-y-4">
              <li className="text-gray-300 text-sm font-light">
                <span className="text-gray-600">البريد:</span>{" "}
                <a
                  href={`mailto:${email}`}
                  className="transition-all duration-300 hover:text-[#C5A059]"
                >
                  {email}
                </a>
              </li>
              <li className="text-gray-300 text-sm font-light">
                <span className="text-gray-600">الهاتف:</span>{" "}
                <a href={`tel:${phone}`} className="transition-all duration-300 hover:text-[#C5A059]">
                  {phone}
                </a>
              </li>
              <li className="text-gray-300 text-sm font-light">
                <span className="text-gray-600">العنوان:</span>{" "}
                <span>{officeAddress}</span>
              </li>
            </ul>
          </motion.div>

          <motion.div variants={columnVariants} className="space-y-8">
            <h4 className="text-gray-500 text-xs font-light tracking-widest uppercase">
              قائمة النخبة
            </h4>
            <form onSubmit={handleEliteSubmit} className="space-y-6">
              <div className="relative">
                <input
                  type="email"
                  value={eliteEmail}
                  onChange={(e) => setEliteEmail(e.target.value)}
                  placeholder="أدخل بريدك الإلكتروني"
                  className="w-full bg-transparent border-0 border-b border-[#C5A059]/30 text-white text-sm font-light py-3 px-0 focus:outline-none focus:border-[#C5A059] placeholder:text-gray-600 placeholder:font-light transition-all duration-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full border border-[#C5A059] text-[#C5A059] text-xs font-light py-4 px-6 hover:bg-[#C5A059] hover:text-black transition-all duration-500 tracking-widest uppercase flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-[#C5A059]/30 border-t-[#C5A059] rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  <>
                    انضم الآن
                    <ChevronLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      </motion.div>

      <div className="border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-6 py-6 md:px-12 lg:px-16">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-mono tracking-widest">
            <span className="text-gray-600">
              © {new Date().getFullYear()} AZENITH LIVING // ALL RIGHTS RESERVED
            </span>
            <span className="text-gray-600">
              SYSTEM_STATUS: OPERATIONAL // BY: <span className="text-[#C5A059] drop-shadow-[0_0_8px_rgba(197,160,89,0.5)]">ALAA_AZIZ</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
