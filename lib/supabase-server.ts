import { createClient as supabaseCreateClient } from "@supabase/supabase-js";

// Singleton instance for server-side services
export const supabaseServer = supabaseCreateClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
    }
  }
);

/**
 * Compatibility function for existing modules (like real-tool-executor.ts)
 * that expect a createClient function.
 */
export async function createClient() {
  return supabaseServer;
}
