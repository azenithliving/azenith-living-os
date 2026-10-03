import { SectionIntake } from "@/components/admin/v2/SectionIntake";

export default function V2OwnerDashboardPage() {
  return (
    <SectionIntake
      title="لوحة المالك"
      purpose="مجمل ما يجري اليوم: الإيراد، والطلبات المعلّقة، وقرار مستنى كلمتك."
      doors={[
        { href: "/admin/v2", label: "مصفوفة القيادة — نبض المتجر وأبواب الموظفين" },
        { href: "/admin/owner-dashboard", label: "لوحة المالك الشغالة دلوقت" },
      ]}
    />
  );
}
