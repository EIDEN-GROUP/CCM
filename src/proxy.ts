import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy`.
 *
 * CCM's proxy refreshes the Supabase session on every request, blocks
 * unauthenticated access to the application, and marks auth-cookie responses
 * as private so a CDN cannot cache one user's session for another.
 */
export default function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *  - static assets and images
     *  - favicon / manifest
     *  - the browser bridge extension directory (served as static files)
     *  - the downloadable browser bridge package
     *  - API routes, which authenticate their own request
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|apps/ccm-browser-bridge|downloads/ccm-browser-bridge\\.zip|api/).*)",
  ],
};
