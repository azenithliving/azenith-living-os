import { createClient as supabaseCreateClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://placeholder-for-build.local";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

// Singleton instance for server-side services with safety for build time
export const supabaseServer = supabaseCreateClient(
  supabaseUrl,
  supabaseKey,
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
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn("⚠️ Warning: Supabase URL is missing. This might be fine during build time.");
  }
  return supabaseServer;
}
