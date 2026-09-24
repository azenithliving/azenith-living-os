import { redirect } from 'next/navigation';

/** P5-M3: single studio surface lives at /admin/v2/qayyim. */
export default function LegacyQayyimPage() {
  redirect('/admin/v2/qayyim');
}
