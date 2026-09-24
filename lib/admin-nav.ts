/**
 * Admin Navigation — Source of Truth (v2 Ready)
 * البيت الجديد والقديم يقرآن من هنا — لا تكرار
 * KIRO-safe: هذا الملف معزول عن planning_engine
 */

export type NavItem = {
  href: string;
  label: string;
  labelEn?: string;
  icon: string;
  badge?: string;
  requiresLegacy?: boolean;
};

export type NavCategory = {
  title: string;
  titleEn?: string;
  items: NavItem[];
};

// Legacy (القديم) — يُقرأ من app/admin/layout-client.tsx
export const LEGACY_NAV: NavCategory[] = [
  {
    title: "الرئيسية",
    items: [
      { href: "/admin", label: "نظرة عامة", icon: "Home" },
      { href: "/admin/owner-dashboard", label: "لوحة المالك", icon: "Crown" },
    ],
  },
  {
    title: "العمل",
    items: [
      { href: "/admin/work", label: "مركز العمل", icon: "TrendingUp" },
      { href: "/admin/sales", label: "المبيعات", icon: "MessageSquare" },
      { href: "/admin/elite", label: "دعوات النخبة", icon: "Crown" },
    ],
  },
  {
    title: "الوكلاء الذكية",
    items: [{ href: "/admin/agents", label: "مركز قيادة الوكلاء", icon: "Cpu" }],
  },
  {
    title: "النظام",
    items: [
      { href: "/admin/system", label: "مركز النظام", icon: "Settings" },
      { href: "/admin/settings", label: "الإعدادات", icon: "Database" },
      { href: "/admin/database", label: "حالة قاعدة البيانات", icon: "Activity" },
    ],
  },
];

// V2 — مطابق للقديم بالمللي — نفس القائمة الجانبية، كل صفحة فاضية
// كما طلبت: "داشبورد مطابق للقديم بس فاضي فيه بس القائمة الجانبية"
export const V2_NAV: NavCategory[] = JSON.parse(JSON.stringify(LEGACY_NAV.map(cat => ({
  ...cat,
  items: cat.items.map(it => ({
    ...it,
    href: it.href.replace("/admin", "/admin/v2"),
  }))
}))));

// Helper: is active path
export function isV2Active(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/admin/v2") return pathname === "/admin/v2";
  return pathname === href || pathname.startsWith(href + "/");
}

export function isLegacyActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  const cleanHref = href.split("?")[0];
  const cleanPath = pathname.split("?")[0];
  if (cleanHref === "/admin") return cleanPath === "/admin";
  return cleanPath === cleanHref || cleanPath.startsWith(cleanHref);
}
