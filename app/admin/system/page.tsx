import Link from "next/link";
import { Settings, Database, Globe, Code, Shield } from "lucide-react";

const links = [
  {
    href: "/admin/settings",
    label: "الإعدادات",
    desc: "مفاتيح API والتفضيلات",
    icon: Settings,
  },
  {
    href: "/admin/database",
    label: "قاعدة البيانات",
    desc: "جداول ونسخ احتياطي",
    icon: Database,
  },
  {
    href: "/admin/browser",
    label: "تصفح الأتمتة",
    desc: "أتمتة المتصفح",
    icon: Globe,
  },
  {
    href: "/admin/sandbox",
    label: "بيئة الاختبار",
    desc: "تجارب آمنة",
    icon: Code,
  },
  {
    href: "/admin/assistant",
    label: "فحص الصحة",
    desc: "اسأل: هل الموقع شغال تمام؟",
    icon: Shield,
  },
];

export default function AdminSystemPage() {
  return (
    <div className="space-y-6 p-4 lg:p-8">
      <header>
        <h1 className="text-2xl font-bold text-white">النظام</h1>
        <p className="text-sm text-white/50 mt-1">
          إعدادات تقنية وأدوات متقدمة
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-[#C5A059]/40 transition"
          >
            <item.icon className="h-8 w-8 text-[#C5A059] mb-3" />
            <h2 className="text-lg font-semibold text-white">{item.label}</h2>
            <p className="text-sm text-white/50 mt-1">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
