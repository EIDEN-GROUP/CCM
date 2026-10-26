import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deleteAppCredential,
  listAppCredentials,
  writeAppCredential,
} from "@/lib/providers/app-credentials";
import { OAUTH_PROVIDER_LIST } from "@/lib/oauth/registry";
import type { OAuthProviderKey } from "@/lib/oauth/registry";
import { writeAuditEvent } from "@/lib/repositories/alerts";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const oauthProviderKeys = OAUTH_PROVIDER_LIST.map(({ key }) => key) as [
  OAuthProviderKey,
  ...OAuthProviderKey[],
];

const saveSchema = z.object({
  providerKey: z.enum(oauthProviderKeys),
  clientId: z.string().min(1).max(500),
  /** Omit to leave the stored secret alone; empty string clears it. */
  secret: z.string().max(2000).optional(),
  redirectUri: z.string().url().max(1000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

/**
 * The provider app credentials.
 *
 * This is what makes a provider connectable without a redeploy: the owner
 * pastes the client id and the client secret of their app into the
 * interface, and the secret is encrypted before it is stored.
 *
 * The response never contains a secret — only whether one is stored.
 */
export async function GET() {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("settings.manage")) {
    return NextResponse.json(
      { error: "You do not have permission to manage integrations" },
      { status: 403 },
    );
  }

  const db = createAdminClient();

  try {
    const credentials = await listAppCredentials(db, session.workspaceId);

    // The origin the owner must register with each provider.
    const origin = serverEnv.appOrigin();

    const providers = OAUTH_PROVIDER_LIST.map((config) => ({
      key: config.key,
      displayName: config.displayName,
      clientIdLabel: config.clientIdLabel,
      secretLabel: config.secretLabel,
      secretRequired: config.secretRequired,
      setupUrl: config.setupUrl,
      docsUrl: config.docsUrl,
      requirement: config.requirement,
      redirectUriPath: config.redirectUriPath,
      products: config.products.map((product) => ({
        key: product.key,
        label: product.label,
      })),
    }));

    return NextResponse.json({
      providers,
      credentials,
      origin,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The credentials could not be read.",
      },
      { status: 400 },
    );
  }
}

/**
 * Save a provider's app credential.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("settings.manage")) {
    return NextResponse.json(
      { error: "You do not have permission to manage integrations" },
      { status: 403 },
    );
  }

  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  try {
    await writeAppCredential(db, {
      workspaceId: session.workspaceId,
      providerKey: parsed.data.providerKey,
      clientId: parsed.data.clientId,
      // An absent secret leaves the stored one alone; an empty one clears it.
      secret:
        parsed.data.secret === undefined
          ? undefined
          : parsed.data.secret.trim() === ""
            ? null
            : parsed.data.secret,
      redirectUri: parsed.data.redirectUri ?? null,
      notes: parsed.data.notes ?? null,
      actorUserId: session.userId,
    });

    await writeAuditEvent(db, {
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: "integration.credentials_saved",
      entityType: "provider_app_credential",
      entityId: parsed.data.providerKey,
      targetLabel: parsed.data.providerKey,
      severity: "warning",
    });

    const credentials = await listAppCredentials(db, session.workspaceId);
    return NextResponse.json({ ok: true, credentials });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The credential could not be saved.",
      },
      { status: 400 },
    );
  }
}

/**
 * Remove a provider's app credential.
 */
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("settings.manage")) {
    return NextResponse.json(
      { error: "You do not have permission to manage integrations" },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const providerKey = url.searchParams.get("providerKey");
  if (!providerKey || !oauthProviderKeys.includes(providerKey as OAuthProviderKey)) {
    return NextResponse.json(
      { error: "providerKey is required" },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  try {
    await deleteAppCredential(db, session.workspaceId, providerKey);

    await writeAuditEvent(db, {
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: "integration.credentials_removed",
      entityType: "provider_app_credential",
      entityId: providerKey,
      targetLabel: providerKey,
      severity: "warning",
    });

    const credentials = await listAppCredentials(db, session.workspaceId);
    return NextResponse.json({ ok: true, credentials });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The credential could not be removed.",
      },
      { status: 400 },
    );
  }
}
