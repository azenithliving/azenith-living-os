/**
 * Standalone Supabase Service Role Client
 * For use in scripts and non-request contexts (background jobs, bulk operations)
 * Uses SERVICE_ROLE_KEY which bypasses RLS policies
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase environment variables. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
  );
}

export const supabaseService = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Check if we're in a request context (Next.js server component/API route)
 * vs a script/background context
 */
export function isRequestContext(): boolean {
  try {
    // In Next.js, headers/cookies are only available in request context
    // This will throw if called outside a request
    const { headers } = require("next/headers");
    headers();
    return true;
  } catch {
    return false;
  }
}
