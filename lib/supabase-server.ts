import { createClient as supabaseCreateClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(supabaseUrl && anonKey && serviceRoleKey);

// Public Server Client (Anon)
export const supabaseServer = configured
  ? supabaseCreateClient(
      supabaseUrl,
      anonKey,
      {
        auth: { persistSession: false }
      }
    )
  : null;

// Admin Server Client (Service Role)
// Use this for storage, bypassing RLS, etc.
export const supabaseAdmin = configured
  ? supabaseCreateClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: { persistSession: false }
      }
    )
  : null;

/**
 * Compatibility function
 */
export async function createClient() {
  return supabaseServer;
}
