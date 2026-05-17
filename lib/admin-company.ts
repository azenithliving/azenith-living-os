import { supabaseServer } from '@/lib/dal/unified-supabase';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolveAdminCompanyId(companyId?: string | null) {
  if (companyId && UUID_PATTERN.test(companyId)) {
    return companyId;
  }

  const { data, error } = await supabaseServer
    .from('companies')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Company resolution error:', error);
    return null;
  }

  return data?.id || null;
}
