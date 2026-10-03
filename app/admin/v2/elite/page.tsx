import { SectionIntake } from "@/components/admin/v2/SectionIntake";

export default function V2ElitePage() {
  return (
    <SectionIntake
      title="دعوات النخبة"
      purpose="ملفات العملاء المميزة ودعواتهم الخاصة: من دخل برابط، وماذا طلب، وهل استحق الدعوة."
      doors={[
        { href: "/admin/elite", label: "باب النخبة الشغال دلوقت" },
        { href: "/admin/v2/sales", label: "قسم المبيعات — من يتصل بمن اليوم" },
      ]}
    />
  );
}
