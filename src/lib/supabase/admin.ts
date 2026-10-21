import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Service-role Supabase client.
 *
 * Bypasses Row Level Security. It exists for exactly two callers:
 *   - the sync worker, which processes queued jobs on behalf of a connection
 *     whose own authorisation was already verified when the job was queued; and
 *   - administrative maintenance scripts.
 *
 * It must never be used to read data that a request handler then returns to a
 * user, because doing so would silently bypass RLS.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase admin access is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
