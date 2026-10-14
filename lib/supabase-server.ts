import { createClient as supabaseCreateClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

/**
 * Server doors read the store's record on the store's own credential — nobody else's.
 *
 * This client used to be built from the key the browser already ships. Measured 2026-10-15: the only
 * reason its queries answered was a hundred policies written `to public using (true)`, which is the
 * same sentence as «the record is open to the street» — 69 of 155 tables handed rows to a stranger
 * holding nothing but that public key, among them `users` (staff names, emails and phones), `leads`
 * (customers' names, emails and messages), `agent_messages` (the owner's own conversation with his
 * employees) and every `_p6_backup_*` / `_p7_backup_*` copy of them. So the public roles are being
 * locked out of the record at the database, and a door that reads the record has to arrive with the
 * server's own credential rather than the visitor's.
 *
 * The auth half of the session stays where it belongs: nobody authenticates through this file, the
 * gate has its own doors in `app/api/admin/*`.
 */
export const supabaseServer: SupabaseClient = supabaseCreateClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

/** The same client under its older name, for readers who ask for the admin one. */
export const supabaseAdmin: SupabaseClient = supabaseServer;

/**
 * Compatibility function
 */
export async function createClient(): Promise<SupabaseClient> {
  return supabaseServer;
}
