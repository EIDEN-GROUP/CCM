import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

/** Routes reachable without a session. */
const PUBLIC_PATHS = ["/login", "/accept-invite", "/setup", "/api/health"];

/**
 * Refresh the Supabase session cookie on every request.
 *
 * Two things happen here:
 *  1. The session token is validated (`getClaims()` verifies the JWT against
 *     the project's signing keys) and refreshed when close to expiry.
 *  2. Responses that carry auth cookies are marked private/no-store so a CDN
 *     or reverse proxy cannot serve one user's session to another.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Not configured yet: let the request through so the setup screen can
    // explain what is missing instead of failing with an opaque error.
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
        // Auth cookie responses must never be cached.
        for (const [key, value] of Object.entries(headers ?? {})) {
          supabaseResponse.headers.set(key, value);
        }
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it can cause
  // hard-to-debug session desync errors.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims ?? null;

  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!claims && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(redirectUrl);
    redirect.headers.set("Cache-Control", "private, no-store, max-age=0");
    return redirect;
  }

  if (claims && (pathname === "/login" || pathname === "/accept-invite")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/overview";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  supabaseResponse.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, must-revalidate, max-age=0",
  );

  return supabaseResponse;
}
