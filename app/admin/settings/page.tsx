"use client";

import { motion } from "framer-motion";
import { Settings, User, Bell, Shield, Globe, Save } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <header className="mb-12">
        <h1 className="text-4xl font-black text-white mb-2">إعدادات النظام</h1>
        <p className="text-white/50">تخصيص الهوية، الإشعارات، ومعايير الأمان.</p>
      </header>

      <div className="space-y-6">
        {[
          { icon: User, label: "الملف الشخصي", desc: "تعديل بياناتك وكلمة المرور" },
          { icon: Globe, label: "إعدادات الموقع", desc: "تعديل اسم العلامة التجارية، الروابط، والألوان" },
          { icon: Bell, label: "الإشعارات", desc: "تحكم في تنبيهات التليجرام والواتساب" },
          { icon: Shield, label: "الأمان", desc: "إدارة صلاحيات الوصول ومفاتيح الـ API" },
        ].map((item) => (
          <motion.div
            key={item.label}
            whileHover={{ x: 10 }}
            className="flex items-center gap-6 p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-[#C5A059]/30 transition-all cursor-pointer"
          >
            <div className="p-4 rounded-2xl bg-white/5 text-[#C5A059]">
              <item.icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white">{item.label}</h3>
              <p className="text-white/40 text-sm">{item.desc}</p>
            </div>
            <div className="text-white/20">→</div>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 flex justify-end">
        <button className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-[#C5A059] text-black font-black shadow-xl shadow-[#C5A059]/20 hover:scale-105 transition-all">
          <Save className="w-5 h-5" /> حفظ التغييرات
        </button>
      </div>
    </div>
  );
}
