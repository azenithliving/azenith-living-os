import { SectionIntake } from "@/components/admin/v2/SectionIntake";

export default function V2DatabasePage() {
  return (
    <SectionIntake
      title="البيانات"
      purpose="جداول المتجر وأحجامها وصحة صلتها: أين يسكن العميل، وأين تسكن ورقة الغرفة، وأين يقفل العدّاد."
      doors={[
        { href: "/admin/database", label: "باب البيانات الشغال دلوقت" },
        { href: "/admin/v2/sketches", label: "أوراق الغرف — أعلى جدول حركة في المتجر" },
      ]}
    />
  );
}
