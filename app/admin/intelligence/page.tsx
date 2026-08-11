import { redirect } from "next/navigation";

/** الذكاء → مركز قيادة الوكلاء الموحّد */
export default function AdminIntelligencePage() {
  redirect("/admin/agents");
}
