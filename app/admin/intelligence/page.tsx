import Link from "next/link";
import { Bot, Sparkles, Brain, Image } from "lucide-react";

const links = [
  {
    href: "/admin/agents?tab=assistant",
    label: "المساعد الموحّد",
    desc: "محادثة واحدة لكل المهام والوكلاء والأدوات",
    icon: Brain,
  },
  {
    href: "/admin/agents?tab=command",
    label: "مركز القيادة",
    desc: "تفاصيل التنفيذ وإدارة الوكلاء",
    icon: Bot,
  },
  {
    href: "/admin/agents?tab=manufacturing",
    label: "التصنيع",
    desc: "إدارة خط الإنتاج والتصنيع",
    icon: Sparkles,
  },
  {
    href: "/admin/agents?tab=teams",
    label: "فريق الوكلاء",
    desc: "إدارة الوكلاء السبعة",
    icon: Image,
  },
];

export default function AdminIntelligencePage() {
  return (
    <div className="space-y-6 p-4 lg:p-8">
      <header>
        <h1 className="text-2xl font-bold text-white">الذكاء</h1>
        <p className="text-sm text-white/50 mt-1">
          الوكلاء، المساعد، والأتمتة الذكية - كل شيء موحد الآن في مركز واحد
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
      
      <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border border-purple-500/20">
        <p className="text-center text-white/80">
          💡 <strong>تحديث:</strong> جميع أقسام الوكلاء تم دمجها في صفحة واحدة موحدة للوصول السريع
        </p>
      </div>
    </div>
  );
}
