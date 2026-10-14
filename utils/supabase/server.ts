import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * The session does the signing in; the store's own credential does the table work.
 *
 * Every door in the old house and the elite flow was reading the record through the key the browser
 * already holds, and the database was made to answer by opening its policies to everyone — measured
 * 2026-10-15: 69 of 155 tables handed rows to a stranger with that public key. Locking the public
 * roles out (the migration `20261015_a_lock_the_public_gate.sql`) would otherwise take the login
 * screen, the preview window and the elite flow down with them, because they were all reading as a
 * visitor rather than as the store.
 *
 * So the object handed to those doors keeps its shape — `supabase.auth.*` still runs on the session,
 * which is what the gate needs to set and read its cookies — while `from`/`rpc`/`schema` are answered
 * by the server's own client, the one that stands outside row level security. Nothing about a call
 * site changes; what changes is whose credential is behind it.
 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  const session = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );

  const records = getSupabaseAdminClient();
  if (!records) return session as unknown as SupabaseClient;

  const TABLE_WORK = new Set(["from", "rpc", "schema"]);

  return new Proxy(session as unknown as SupabaseClient, {
    get(target, property) {
      const source = TABLE_WORK.has(String(property)) ? records : (target as unknown as Record<string, unknown>);
      const value = (source as Record<string, unknown>)[String(property)];
      // Supabase's client methods read `this`, so a detached function has to stay tied to its client.
      return typeof value === "function" ? value.bind(source) : value;
    },
  }) as SupabaseClient;
}
