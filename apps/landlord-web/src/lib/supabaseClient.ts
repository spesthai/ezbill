import { createClient } from "@supabase/supabase-js";
import { assertSupabaseConfigured, ENV } from "./env";

// Landlord web uses the anon key with RLS enforced (authenticated session via Supabase Auth).
// Never ship service_role keys to the browser.
export const supabase =
  ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY
    ? createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
        auth: {
          flowType: "pkce",
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true
        }
      })
    : null;

export function getSupabase() {
  assertSupabaseConfigured();
  if (!supabase) throw new Error("[supabase] client not initialized");
  return supabase;
}
