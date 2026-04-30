import { createClient } from "@supabase/supabase-js";
import { cache } from "react";

export const getSupabaseServerClient = cache(() =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ),
);



