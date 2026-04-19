/**
 * Standalone Supabase Service Role Client
 * For use in scripts and non-request contexts (background jobs, bulk operations)
 * Uses SERVICE_ROLE_KEY which bypasses RLS policies
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let _supabaseService: ReturnType<typeof createClient> | null = null;

/**
 * Lazy-loaded Supabase Service Client
 * Throws only when accessed if environment variables are missing
 */
export const supabaseService = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    if (!_supabaseService) {
      if (!supabaseUrl || !serviceRoleKey) {
        // In build environment, we might not have these, so we shouldn't throw 
        // unless a method is actually called during the build process.
        if (process.env.NEXT_PHASE === 'phase-production-build') {
          console.warn("⚠️ Warning: Supabase Service Client accessed during build without environment variables.");
          return () => { throw new Error("Supabase Service Client is not available during build."); };
        }
        throw new Error(
          "Missing Supabase environment variables. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
        );
      }
      _supabaseService = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
    return ( _supabaseService as any)[prop];
  }
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
