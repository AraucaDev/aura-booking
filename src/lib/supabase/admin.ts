import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con service_role. SOLO usar en el servidor
 * (route handlers, server actions). Bypassa RLS.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
