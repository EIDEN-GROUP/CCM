import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import {
  beginAuthorisation,
  MissingAppCredentialError,
  type AppCredentialFallback,
} from "@/lib/oauth/engine";
import {
  OAUTH_PROVIDERS,
  type OAuthProviderKey,
} from "@/lib/oauth/registry";

export const dynamic = "force-dynamic";

/** The cookie that carries the sealed authorisation state. */
export const OAUTH_STATE_COOKIE_PREFIX = "ccm_oauth_state_";

/**
 * The environment fallback for a provider's app credential.
 *
 * The interface is the primary place. This keeps a deployment that still
 * sets the variables in `.env` working.
 */
export function fallbackFor(providerKey: string): AppCredentialFallback {
  switch (providerKey) {
    case "google":
      return {
        clientId: serverEnv.googleOAuthClientId(),
        secret: serverEnv.googleOAuthClientSecret(),
      };
    case "meta":
      return {
        clientId: serverEnv.metaAppId(),
        secret: serverEnv.metaAppSecret(),
      };
    case "linkedin":
      return {
        clientId: serverEnv.linkedinClientId(),
        secret: serverEnv.linkedinClientSecret(),
      };
    default:
      return { clientId: null, secret: null };
  }
}

/**
 * Start an authorisation.
 *
 * The owner chooses the products to connect; CCM requests only the scopes
 * those products need. The app's client id and secret come from the
 * interface, so no deployment is needed to connect a provider.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerKey } = await params;

  const config = OAUTH_PROVIDERS[providerKey as OAuthProviderKey];
  if (!config) {
    return NextResponse.json(
      { error: `"${providerKey}" is not a provider CCM can connect.` },
      { status: 404 },
    );
  }

  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("integrations.manage")) {
    return NextResponse.json(
      { error: "You do not have permission to connect providers" },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const requested = url.searchParams.get("products");
  const productKeys =
    requested && requested.length > 0
      ? requested.split(",").map((value) => value.trim()).filter(Boolean)
      : config.products.map((product) => product.key);

  const db = createAdminClient();

  try {
    const start = await beginAuthorisation({
      db,
      providerKey: providerKey as OAuthProviderKey,
      productKeys,
      workspaceId: session.workspaceId,
      userId: session.userId,
      origin: url.origin,
      fallback: fallbackFor(providerKey),
    });

    const store = await cookies();
    store.set(
      `${OAUTH_STATE_COOKIE_PREFIX}${providerKey}`,
      start.sealedState,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: url.protocol === "https:",
        path: "/api/auth",
        maxAge: 600,
      },
    );

    return NextResponse.redirect(start.url);
  } catch (error) {
    if (error instanceof MissingAppCredentialError) {
      // The owner has not configured the app yet. Send them to the place
      // where they can, rather than showing a bare error.
      return NextResponse.redirect(
        `${url.origin}/settings/integrations?provider=${providerKey}&error=not_configured`,
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The authorisation could not be started.",
      },
      { status: 400 },
    );
  }
}
