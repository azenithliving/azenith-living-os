import { redirect } from "next/navigation";

/** مركز الاستخبارات → المساعد الموحّد (المرحلة 1) */
export default function IntelRedirectPage() {
  redirect("/admin/assistant?from=intel");
}
