import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  completeAuthorisation,
  type AppCredentialFallback,
} from "@/lib/oauth/engine";
import {
  OAUTH_PROVIDERS,
  type OAuthProviderKey,
} from "@/lib/oauth/registry";
import { writeAuditEvent } from "@/lib/repositories/alerts";
import { OAUTH_STATE_COOKIE_PREFIX, fallbackFor } from "../authorize/route";

export const dynamic = "force-dynamic";

/**
 * The OAuth callback.
 *
 * The code is redeemed server-side; the browser never sees a token. The
 * sealed state is checked, the accounts are discovered, the credential is
 * stored encrypted, and the first sync is queued — so the owner lands on
 * the Integrations screen with a connection that is already fetching.
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
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");
  const providerErrorDetail = url.searchParams.get("error_description");

  const store = await cookies();
  const sealed = store.get(
    `${OAUTH_STATE_COOKIE_PREFIX}${providerKey}`,
  )?.value;

  // The state cookie is single use, whatever happens next.
  store.delete(`${OAUTH_STATE_COOKIE_PREFIX}${providerKey}`);

  if (providerError) {
    return NextResponse.redirect(
      `${url.origin}/integrations?error=${encodeURIComponent(
        providerErrorDetail
          ? `${providerError}: ${providerErrorDetail}`
          : providerError,
      )}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${url.origin}/integrations?error=${encodeURIComponent(
        "The authorisation response was incomplete.",
      )}`,
    );
  }

  const db = createAdminClient();

  try {
    const result = await completeAuthorisation({
      db,
      providerKey: providerKey as OAuthProviderKey,
      code,
      state,
      sealedState: sealed,
      workspaceId: session.workspaceId,
      userId: session.userId,
      origin: url.origin,
      fallback: fallbackFor(providerKey) as AppCredentialFallback,
    });

    await writeAuditEvent(db, {
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: "connection.authorised",
      entityType: "provider_connection",
      entityId: result.accounts[0]?.accountId ?? null,
      targetLabel: result.accounts.map((account) => account.label).join(", "),
      details: {
        provider: providerKey,
        accounts: result.accounts.map((account) => ({
          providerKey: account.providerKey,
          externalAccountId: account.externalAccountId,
        })),
      },
    });

    const connected = result.accounts
      .map((account) => account.providerKey)
      .join(",");

    return NextResponse.redirect(
      `${url.origin}/integrations?connected=${encodeURIComponent(connected)}`,
    );
  } catch (error) {
    return NextResponse.redirect(
      `${url.origin}/integrations?error=${encodeURIComponent(
        error instanceof Error
          ? error.message
          : "The authorisation could not be completed.",
      )}`,
    );
  }
}
