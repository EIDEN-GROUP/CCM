import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Server Supabase client bound to the current request's cookies.
 *
 * Uses the anonymous key plus the user's session cookie, so Row Level
 * Security applies to every query. This is the client every repository
 * function must use; the service-role client in `admin.ts` is reserved for
 * the sync worker and is never called from a request handler that serves
 * user-facing data.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, _headers) {
        // The response headers (@supabase/ssr asks for them on auth cookie
        // writes) are applied by the middleware, which owns the response
        // object. A Server Component cannot set them, and duplicating them
        // here would be wrong.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
