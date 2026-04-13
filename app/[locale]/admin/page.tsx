import { redirect } from "next/navigation";

/**
 * Admin Route Handler
 * Redirects /admin to /dashboard for unified access
 */
export default function AdminPage() {
  redirect("/dashboard");
}
