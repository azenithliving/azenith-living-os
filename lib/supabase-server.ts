import { createClient as supabaseCreateClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://placeholder-for-build.local";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

// Public Server Client (Anon)
export const supabaseServer = supabaseCreateClient(
  supabaseUrl,
  anonKey,
  {
    auth: { persistSession: false }
  }
);

// Admin Server Client (Service Role)
// Use this for storage, bypassing RLS, etc.
export const supabaseAdmin = supabaseCreateClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: { persistSession: false }
  }
);

/**
 * Compatibility function
 */
export async function createClient() {
  return supabaseServer;
}
