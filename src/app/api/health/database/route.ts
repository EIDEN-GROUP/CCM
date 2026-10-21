import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Reports whether the database's Row Level Security authorisation layer is
 * installed.
 *
 * The helper functions are the foundation of every policy. If they are
 * missing — because a migration aborted, or because PostgREST's schema cache
 * has not been reloaded — every policy that calls them fails and every
 * authenticated user sees nothing. The setup screen uses this to tell the
 * operator exactly what to apply.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json(
      { configured: false, authorisationLayer: null },
      { status: 503 },
    );
  }

  let authorisationLayer:
    | { ready: boolean; reason: string | null }
    | null = null;

  try {
    const response = await fetch(`${url}/rest/v1/rpc/has_permission`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target_workspace: "00000000-0000-0000-0000-000000000000",
        perm: "overview.read",
      }),
    });

    if (response.status === 404) {
      authorisationLayer = {
        ready: false,
        reason:
          "The RLS helper functions are not visible to PostgREST. Either a migration aborted before creating them, or the schema cache has not been reloaded.",
      };
    } else if (response.status >= 500) {
      authorisationLayer = {
        ready: false,
        reason: `The authorisation check returned ${response.status}.`,
      };
    } else {
      authorisationLayer = { ready: true, reason: null };
    }
  } catch (error) {
    authorisationLayer = {
      ready: false,
      reason:
        error instanceof Error
          ? `The authorisation check could not run: ${error.message}`
          : "The authorisation check could not run.",
    };
  }

  return NextResponse.json(
    { configured: true, authorisationLayer },
    { headers: { "Cache-Control": "no-store" } },
  );
}
