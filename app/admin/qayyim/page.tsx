import { redirect } from 'next/navigation';

/**
 * P5-M3 moved the studio out of the v1 address, P7-M3 moved it again. A 307 keeps
 * the bookmark working; the target is the only studio the swarm has.
 */
export default function LegacyStudioAddressPage() {
  redirect('/admin/v2/ops');
}
