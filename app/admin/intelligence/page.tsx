import Link from "next/link";
import { Bot, Sparkles, Brain, Image } from "lucide-react";

const links = [
  {
    href: "/admin/assistant",
    label: "المساعد الموحّد",
    desc: "محادثة واحدة لكل المهام والوكلاء والأدوات",
    icon: Brain,
  },
  {
    href: "/admin/agents",
    label: "مهام الوكلاء",
    desc: "تفاصيل التنفيذ والسجل",
    icon: Bot,
  },
  {
    href: "/admin/fate",
    label: "تسويق القدر",
    desc: "حملات ومحتوى ذكي",
    icon: Sparkles,
  },
  {
    href: "/admin/assistant?from=intel",
    label: "حصاد الصور",
    desc: "من خلال المساعد (كان Intel)",
    icon: Image,
  },
];

export default function AdminIntelligencePage() {
  return (
    <div className="space-y-6 p-4 lg:p-8">
      <header>
        <h1 className="text-2xl font-bold text-white">الذكاء</h1>
        <p className="text-sm text-white/50 mt-1">
          الوكلاء، المساعد، والأتمتة الذكية
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
