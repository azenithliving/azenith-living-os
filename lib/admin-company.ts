import { supabaseServer } from '@/lib/dal/unified-supabase';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolve the company that owns administrative data.
 *
 * We intentionally do not select the first company in the database: that can
 * silently write an admin action into the wrong tenant. Configure
 * ADMIN_COMPANY_ID (or pass a validated company id from a trusted server
 * context) instead.
 */
export async function resolveAdminCompanyId(companyId?: string | null) {
  const configured = process.env.ADMIN_COMPANY_ID?.trim();
  const candidate = companyId?.trim() || configured;
  if (!candidate || !UUID_PATTERN.test(candidate)) return null;

  const { data, error } = await supabaseServer
    .from('companies')
    .select('id')
    .eq('id', candidate)
    .maybeSingle();

  if (error) {
    console.error('Company resolution error:', error);
    return null;
  }

  return data?.id || null;
}
