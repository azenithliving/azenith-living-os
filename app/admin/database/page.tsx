"use client";

import { motion } from "framer-motion";
import { Database, RefreshCw, HardDrive, Search, AlertTriangle } from "lucide-react";

export default function DatabasePage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-12">
        <h1 className="text-4xl font-black text-white mb-2 flex items-center gap-3">
          <Database className="text-[#C5A059]" /> إدارة البيانات
        </h1>
        <p className="text-white/50">مراقبة حالة الجداول، النسخ الاحتياطي، وفحص سلامة البيانات.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {[
          { label: "حجم البيانات", value: "248 MB", icon: HardDrive, color: "text-blue-400" },
          { label: "الجداول النشطة", value: "32", icon: Database, color: "text-green-400" },
          { label: "آخر فحص", value: "منذ ساعتين", icon: RefreshCw, color: "text-[#C5A059]" },
        ].map((stat) => (
          <div key={stat.label} className="p-6 rounded-3xl bg-white/5 border border-white/10">
            <stat.icon className={`w-5 h-5 ${stat.color} mb-4`} />
            <p className="text-white/40 text-sm">{stat.label}</p>
            <p className="text-2xl font-black text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-amber-500" />
            <span className="text-amber-200 text-sm font-bold">تنبيه: يوجد 5 استعلامات بطيئة تم رصدها مؤخراً.</span>
          </div>
          <button className="text-xs font-bold text-amber-500 hover:underline">عرض التفاصيل</button>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-bold text-white">الجداول الأساسية</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input type="text" placeholder="بحث..." className="pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#C5A059]" />
            </div>
          </div>
          <div className="p-6">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="text-white/30 border-b border-white/5">
                  <th className="pb-4 font-medium">اسم الجدول</th>
                  <th className="pb-4 font-medium">السجلات</th>
                  <th className="pb-4 font-medium">الحجم</th>
                  <th className="pb-4 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="text-white/70">
                {[
                  { name: "users", count: "1,240", size: "1.2 MB", status: "متزامن" },
                  { name: "consultant_sessions", count: "5,820", size: "45 MB", status: "متزامن" },
                  { name: "ai_tasks", count: "12,450", size: "120 MB", status: "نشط" },
                  { name: "inventory_items", count: "850", size: "0.8 MB", status: "متزامن" },
                ].map((row) => (
                  <tr key={row.name} className="border-b border-white/5">
                    <td className="py-4 font-mono text-xs">{row.name}</td>
                    <td className="py-4">{row.count}</td>
                    <td className="py-4">{row.size}</td>
                    <td className="py-4">
                      <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-500 text-[10px]">● {row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
