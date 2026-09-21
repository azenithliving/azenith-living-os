import { redirect } from "next/navigation";

// The previous screen was a visual-only sandbox with no server-side workflow.
// Keep legacy links useful by taking administrators to the real task history.
export default function SandboxPage() {
  redirect("/admin/agents?tab=teams");
}
