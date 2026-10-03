import { SectionIntake } from "@/components/admin/v2/SectionIntake";

export default function V2SystemPage() {
  return (
    <SectionIntake
      title="مركز النظام"
      purpose="صحة المتجر وحراسته: بوابات الدخول، وعدّادات الأعطال، وسير الموظفين أمام دستورهم."
      doors={[
        { href: "/admin/v2/ops", label: "الاستوديو — سير الموظفين ودستورهم" },
        { href: "/admin/v2/keys", label: "خزانة المفاتيح — مفاتيح المزودين وحارسها" },
      ]}
    />
  );
}
