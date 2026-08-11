/**
 * admin-env-resolver.ts
 *
 * يحلّ المتغيرات الحرجة تلقائياً من قاعدة البيانات لو لم تكن موجودة في .env
 * يعمل على production (Vercel) بدون الحاجة لإعداد يدوي.
 *
 * المتغيرات التي يحلّها:
 *   - MASTER_ADMIN_EMAILS   → أول user بدور admin/owner في جدول users
 *   - MASTER_COMPANY_ID     → أول company_id في جدول companies
 *   - CRON_SECRET           → مشتق من INTERNAL_API_KEY
 *   - NEXT_PUBLIC_SITE_URL  → من PRIMARY_DOMAIN أو site_settings
 */

import { createClient } from "@supabase/supabase-js";

let _resolvedOnce = false;
const _cache: Record<string, string> = {};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * يُعيد MASTER_ADMIN_EMAILS — من .env أو من DB
 */
export async function resolveMasterAdminEmails(): Promise<string[]> {
  // إذا موجود في env → استخدمه مباشرة
  const envVal = process.env.MASTER_ADMIN_EMAILS;
  if (envVal?.trim()) return envVal.split(",").map((e) => e.trim()).filter(Boolean);

  // cache
  if (_cache.MASTER_ADMIN_EMAILS) return _cache.MASTER_ADMIN_EMAILS.split(",");

  const sb = getServiceClient();
  if (!sb) return [];

  try {
    // ابحث عن أول user بدور admin/owner/master
    const { data } = await sb
      .from("users")
      .select("email")
      .in("role", ["admin", "owner", "master", "super_admin"])
      .order("created_at", { ascending: true })
      .limit(3);

    const emails = (data ?? []).map((r: { email: string }) => r.email).filter(Boolean);
    if (emails.length > 0) {
      _cache.MASTER_ADMIN_EMAILS = emails.join(",");
      return emails;
    }

    // fallback: أول user بـ is_admin=true
    const { data: adminData } = await sb
      .from("users")
      .select("email")
      .eq("is_admin", true)
      .order("created_at", { ascending: true })
      .limit(1);

    const adminEmails = (adminData ?? []).map((r: { email: string }) => r.email).filter(Boolean);
    if (adminEmails.length > 0) {
      _cache.MASTER_ADMIN_EMAILS = adminEmails.join(",");
      return adminEmails;
    }
  } catch { /* صامت */ }

  return [];
}

/**
 * يُعيد MASTER_COMPANY_ID — من .env أو من DB
 */
export async function resolveMasterCompanyId(): Promise<string | null> {
  const envVal = process.env.MASTER_COMPANY_ID;
  if (envVal?.trim()) return envVal.trim();
  if (_cache.MASTER_COMPANY_ID) return _cache.MASTER_COMPANY_ID;

  const sb = getServiceClient();
  if (!sb) return null;

  try {
    const { data } = await sb
      .from("companies")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (data?.id) {
      _cache.MASTER_COMPANY_ID = data.id as string;
      return data.id as string;
    }
  } catch { /* صامت */ }

  return null;
}

/**
 * يُعيد CRON_SECRET — من .env أو مشتق من INTERNAL_API_KEY
 */
export function resolveCronSecret(): string {
  const envVal = process.env.CRON_SECRET;
  if (envVal?.trim()) return envVal.trim();

  // اشتق من INTERNAL_API_KEY (موجود دائماً)
  const base = process.env.INTERNAL_API_KEY || process.env.NEXT_PUBLIC_INTERNAL_API_KEY || "fallback-secret";
  // خذ أول 32 حرف وأضف prefix للتمييز
  return `cron-${base.slice(0, 28)}`;
}

/**
 * يُعيد NEXT_PUBLIC_SITE_URL — من متغيرات البيئة أو PRIMARY_DOMAIN
 */
export function resolveSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.PRIMARY_DOMAIN?.trim() ||
    process.env.NEXT_PUBLIC_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://azenith-living.vercel.app"
  );
}

/**
 * يُعيد OPENAI_API_KEY — أول key من OPENAI_KEYS pool
 */
export function resolveOpenAIKey(): string {
  const single = process.env.OPENAI_API_KEY;
  if (single?.trim()) return single.trim();

  const pool = process.env.OPENAI_KEYS;
  if (pool?.trim()) return pool.split(",")[0].trim();

  return "";
}

/**
 * يُعيد ANTHROPIC_API_KEY — أول key من ANTHROPIC_KEYS pool
 */
export function resolveAnthropicKey(): string {
  const single = process.env.ANTHROPIC_API_KEY;
  if (single?.trim()) return single.trim();

  const pool = process.env.ANTHROPIC_KEYS;
  if (pool?.trim()) return pool.split(",")[0].trim();

  return "";
}

/**
 * يُحقق أن أي AI provider يعمل
 */
export function hasAnyAIProvider(): boolean {
  return !!(
    process.env.GROQ_KEYS ||
    process.env.OPENROUTER_KEYS ||
    process.env.OPENAI_KEYS ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_KEYS ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.MISTRAL_KEYS ||
    process.env.TOGETHER_API_KEYS ||
    process.env.CEREBRAS_API_KEY
  );
}

/**
 * تهيئة شاملة — يُستدعى مرة واحدة عند بدء أي cron أو API route حساس
 */
export async function initializeAdminEnv(): Promise<{
  masterEmails: string[];
  companyId: string | null;
  cronSecret: string;
  siteUrl: string;
  hasAI: boolean;
}> {
  if (_resolvedOnce) {
    return {
      masterEmails: _cache.MASTER_ADMIN_EMAILS?.split(",") ?? [],
      companyId: _cache.MASTER_COMPANY_ID ?? null,
      cronSecret: resolveCronSecret(),
      siteUrl: resolveSiteUrl(),
      hasAI: hasAnyAIProvider(),
    };
  }

  const [masterEmails, companyId] = await Promise.all([
    resolveMasterAdminEmails(),
    resolveMasterCompanyId(),
  ]);

  // اكتب في process.env لو مفيش (فقط في runtime)
  if (masterEmails.length > 0 && !process.env.MASTER_ADMIN_EMAILS) {
    process.env.MASTER_ADMIN_EMAILS = masterEmails.join(",");
  }
  if (companyId && !process.env.MASTER_COMPANY_ID) {
    process.env.MASTER_COMPANY_ID = companyId;
  }
  if (!process.env.CRON_SECRET) {
    process.env.CRON_SECRET = resolveCronSecret();
  }

  _resolvedOnce = true;

  return {
    masterEmails,
    companyId,
    cronSecret: resolveCronSecret(),
    siteUrl: resolveSiteUrl(),
    hasAI: hasAnyAIProvider(),
  };
}
