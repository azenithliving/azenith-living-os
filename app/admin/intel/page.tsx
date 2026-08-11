import { redirect } from "next/navigation";

/** مركز الاستخبارات → مركز قيادة الوكلاء الموحّد */
export default function IntelRedirectPage() {
  redirect("/admin/agents");
}
