import { redirect } from "next/navigation";

/**
 * Consultation requests are collected through the complete request flow.
 * The old page was an unauthenticated, non-functional admin booking list.
 */
export default function BookingsPage() {
  redirect("/request");
}
