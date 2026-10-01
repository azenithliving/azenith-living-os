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
const BASE_NAV: NavCategory[] = [
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
      { href: "/admin/v2/sketches", label: "ورق المقاسات", icon: "ScanLine" },
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

/**
 * The menu is generated from the office map, not remembered by whoever last edited it.
 *
 * An address in the new house carries the name of the office it belongs to — and only
 * when the map records that page as actually moved. Until tonight the new house was a
 * literal clone of the old labels, so «مدير المبيعات» — the employee the owner finished
 * and moved — could not be read in the menu, and the old house carried no door to him at
 * all: he had to type the address to reach the employee the program had just finished.
 * The second half is what task #39 (the ledger badges in the old house) starts with.
 */
import { EXPLICIT, OFFICES } from "@/lib/ops/migration-map";

/** Already-addressed entries stay as they are, so a new-house door is not doubled. */
const v2Address = (href: string) =>
  href.startsWith("/admin/v2") ? href : href.replace("/admin", "/admin/v2");

/** The page record behind an address, when the map carries one. */
function pageRecord(href: string) {
  return EXPLICIT.find((e) => e.id === `app${href}/page.tsx`) ?? null;
}

/** The office's Arabic name for an address in the new house, only once its page has moved. */
function officeLabelFor(href: string): string | null {
  const record = pageRecord(href);
  if (!record || record.status !== "moved") return null;
  return OFFICES.find((o) => o.id === record.office)?.label ?? null;
}

export const LEGACY_NAV: NavCategory[] = BASE_NAV.map((category) => ({
  ...category,
  items: category.items.flatMap((item) => {
    const twin = v2Address(item.href);
    const label = twin !== item.href ? officeLabelFor(twin) : null;
    if (!label) return [item];
    return [item, { href: twin, label, icon: item.icon, badge: "البيت الجديد" }];
  }),
}));

export const V2_NAV: NavCategory[] = BASE_NAV.map((category) => ({
  ...category,
  items: category.items.map((item) => {
    const href = v2Address(item.href);
    return { ...item, href, label: officeLabelFor(href) ?? item.label };
  }),
}));

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
