import { SectionIntake } from "@/components/admin/v2/SectionIntake";

export default function V2WorkPage() {
  return (
    <SectionIntake
      title="العمل"
      purpose="المهام الجارية: أوراق الغرف المرسومة، وطلبات البيع، وما استنى كلمة المالك فيه."
      doors={[
        { href: "/admin/v2/sketches", label: "أوراق الغرف — الرسومات المرفوعة وأرقامها" },
        { href: "/admin/v2/sales", label: "قسم المبيعات — محادثة مدير المبيعات" },
        { href: "/admin/v2/ops", label: "الاستوديو — مهام الموظفين وحالتهم" },
      ]}
    />
  );
}
