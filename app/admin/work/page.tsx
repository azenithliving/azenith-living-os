import Link from "next/link";
import {
  TrendingUp,
  MessageSquare,
  Monitor,
} from "lucide-react";

const workLinks = [
  {
    href: "/admin/sales",
    label: "المبيعات والعملاء",
    desc: "العملاء، المعرفة، والأسئلة المعلّقة",
    icon: TrendingUp,
  },
  {
    href: "/admin/sales",
    label: "متابعة العملاء",
    desc: "الطلبات والأسئلة المعلّقة في مركز المبيعات",
    icon: MessageSquare,
  },
  {
    href: "/admin/browser",
    label: "جلسة المتصفح",
    desc: "عرض جلسة متصفح مُهيأة عندما تكون متاحة",
    icon: Monitor,
  },
];

export default function AdminWorkPage() {
  return (
    <div className="space-y-6 p-4 lg:p-8">
      <header>
        <h1 className="text-2xl font-bold text-white">العمل</h1>
        <p className="text-sm text-white/50 mt-1">
          كل ما يخص المبيعات والتشغيل اليومي في مكان واحد
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {workLinks.map((item) => (
          <Link
            key={item.label}
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

