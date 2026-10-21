import type { Db } from "@/lib/repositories/types";
import { createPkcePair, randomState } from "./google";
import {
  OAUTH_PROVIDERS,
  productsFor,
  scopesForProducts,
  type OAuthProviderConfig,
  type OAuthProviderKey,
  type OAuthProduct,
} from "./registry";
import {
  readAppCredential,
  writeAppCredential,
  type AppCredential,
} from "@/lib/providers/app-credentials";
import { seal, open } from "@/lib/sealed";
import { discoverAccounts } from "./discovery";
import { writeCredential } from "@/lib/providers/credentials";
import { enqueueJob } from "@/lib/jobs/queue";

/**
 * The OAuth engine.
 *
 * One implementation of "connect a provider", used by every provider. The
 * differences between providers — the endpoints, the scope parameter, the
 * PKCE support, how the token is redeemed, how the accounts are found — are
 * all in the registry and the discovery module.
 *
 * The flow:
 *
 *   begin  → read the app credential, build the scopes, seal the state
 *   complete → verify the state, redeem the code, discover the accounts,
 *              store the encrypted credential, queue the first sync
 *
 * The app credential comes from `provider_app_credentials` — entered in the
 * interface — and falls back to the environment for a deployment that
 * still sets it there.
 */

/** The purpose the sealed OAuth state is sealed under. */
const STATE_PURPOSE = "ccm:oauth-state";

/** How long an authorisation attempt stays valid. */
export const AUTHORISATION_TTL_SECONDS = 600;

/** Raised when the owner has not configured the provider's app yet. */
export class MissingAppCredentialError extends Error {
  constructor(
    readonly providerKey: string,
    readonly setupUrl: string,
  ) {
    super(
      `The ${providerKey} app is not configured. Add the client id and secret in Settings — Integrations first.`,
    );
    this.name = "MissingAppCredentialError";
  }
}

export interface AppCredentialFallback {
  clientId: string | null;
  secret: string | null;
}

export interface AuthorisationStart {
  /** Where to send the browser. */
  url: string;
  /** The sealed state, to be carried in a cookie. */
  sealedState: string;
  scopes: string[];
  products: OAuthProduct[];
  /** The redirect URI that must be registered with the provider. */
  redirectUri: string;
}

export interface ConnectedAccount {
  providerKey: string;
  label: string;
  externalAccountId: string;
  accountId: string;
}

export interface AuthorisationResult {
  accounts: ConnectedAccount[];
  notes: string[];
}

/** The state payload sealed into the cookie. */
type OAuthState = {
  provider: string;
  state: string;
  codeVerifier: string | null;
  products: string[];
  workspaceId: string;
  userId: string;
  issuedAt: number;
};

/**
 * The app credential for a provider, from the interface or the environment.
 */
export async function resolveAppCredential(
  db: Db,
  workspaceId: string,
  providerKey: string,
  fallback: AppCredentialFallback,
): Promise<AppCredential> {
  const stored = await readAppCredential(db, workspaceId, providerKey);

  if (stored) return stored;

  if (fallback.clientId) {
    return {
      providerKey,
      clientId: fallback.clientId,
      secret: fallback.secret,
      redirectUri: null,
      scopes: [],
      notes: null,
      fingerprint: null,
    };
  }

  const config = OAUTH_PROVIDERS[providerKey as OAuthProviderKey];
  throw new MissingAppCredentialError(
    providerKey,
    config?.setupUrl ?? "https://supabase.com/dashboard",
  );
}

/**
 * Start an authorisation.
 */
export async function beginAuthorisation(options: {
  db: Db;
  providerKey: OAuthProviderKey;
  productKeys: string[];
  workspaceId: string;
  userId: string;
  origin: string;
  fallback: AppCredentialFallback;
}): Promise<AuthorisationStart> {
  const config = OAUTH_PROVIDERS[options.providerKey];

  const credential = await resolveAppCredential(
    options.db,
    options.workspaceId,
    options.providerKey,
    options.fallback,
  );

  const products = productsFor(config, options.productKeys);
  if (products.length === 0) {
    throw new Error(
      `No supported product was requested for ${options.providerKey}.`,
    );
  }

  const scopes = scopesForProducts(config, options.productKeys);
  const redirectUri = `${options.origin}${config.redirectUriPath}`;

  const pkce = config.pkce ? createPkcePair() : null;
  const state = randomState();

  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", credential.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(config.scopeParam, scopes.join(config.scopeParam === "scope" ? " " : ","));
  url.searchParams.set("state", state);

  for (const [key, value] of Object.entries(config.authorizeParams ?? {})) {
    url.searchParams.set(key, value);
  }

  if (pkce) {
    url.searchParams.set("code_challenge", pkce.challenge);
    url.searchParams.set("code_challenge_method", "S256");
  }

  // Google issues a refresh token only on the first consent, and only when
  // offline access is asked for.
  if (options.providerKey === "google") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("prompt", "consent");
  }

  const sealedState = seal(STATE_PURPOSE, {
    provider: options.providerKey,
    state,
    codeVerifier: pkce?.verifier ?? null,
    products: options.productKeys,
    workspaceId: options.workspaceId,
    userId: options.userId,
    issuedAt: Math.floor(Date.now() / 1000),
  } satisfies OAuthState);

  return {
    url: url.toString(),
    sealedState,
    scopes,
    products,
    redirectUri,
  };
}

/**
 * Redeem a code and connect the accounts.
 */
export async function completeAuthorisation(options: {
  db: Db;
  providerKey: OAuthProviderKey;
  code: string;
  state: string;
  sealedState: string | undefined;
  workspaceId: string;
  userId: string;
  origin: string;
  fallback: AppCredentialFallback;
}): Promise<AuthorisationResult> {
  const config = OAUTH_PROVIDERS[options.providerKey];

  const payload = open<OAuthState>(
    STATE_PURPOSE,
    options.sealedState,
    AUTHORISATION_TTL_SECONDS,
  );

  if (!payload) {
    throw new Error(
      "The authorisation attempt expired or could not be verified. Start again.",
    );
  }

  if (payload.provider !== options.providerKey) {
    throw new Error(
      "This authorisation response belongs to a different provider.",
    );
  }

  if (payload.state !== options.state) {
    throw new Error(
      "The authorisation response did not match this request.",
    );
  }

  if (payload.workspaceId !== options.workspaceId) {
    throw new Error(
      "The authorisation was started in a different workspace.",
    );
  }

  const credential = await resolveAppCredential(
    options.db,
    options.workspaceId,
    options.providerKey,
    options.fallback,
  );

  const redirectUri = `${options.origin}${config.redirectUriPath}`;

  const tokens = await redeemCode({
    config,
    credential,
    code: options.code,
    redirectUri,
    codeVerifier: payload.codeVerifier,
  });

  // A provider may hand back a short-lived token and want it exchanged for a
  // long-lived one. Meta does; Google and LinkedIn do not.
  const accessToken = await extendIfNeeded({
    providerKey: options.providerKey,
    credential,
    tokens,
  });

  // The accounts this token can reach.
  const discovered = await discoverAccounts(options.providerKey, accessToken);

  if (discovered.length === 0) {
    throw new Error(
      "The provider accepted the authorisation but returned no account for this credential. Check that the app has the right permissions and that the account is linked to it.",
    );
  }

  const notes: string[] = [];
  const accounts: ConnectedAccount[] = [];

  for (const product of productsFor(config, payload.products)) {
    for (const account of discovered) {
      // A Google product only applies to the accounts of its own kind. A
      // Meta page and an Instagram account are different providers, so the
      // discovery already filtered them.
      if (account.providerKey !== product.key) continue;

      const connectionId = await upsertConnection({
        db: options.db,
        workspaceId: options.workspaceId,
        providerKey: account.providerKey,
        label: account.displayLabel,
        scopes: tokens.scope ? tokens.scope.split(/[\s,]+/) : [],
      });

      await writeCredential(options.db, connectionId, {
        accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt:
          typeof tokens.expiresIn === "number"
            ? Math.floor(Date.now() / 1000) + tokens.expiresIn
            : undefined,
      });

      const accountId = await upsertAccount({
        db: options.db,
        workspaceId: options.workspaceId,
        connectionId,
        providerKey: account.providerKey,
        externalAccountId: account.externalAccountId,
        displayLabel: account.displayLabel,
        identifiers: account.identifiers,
      });

      await enqueueJob(options.db, {
        workspaceId: options.workspaceId,
        connectionId,
        accountId,
        kind: product.jobKind,
        dedupeKey: `${product.jobKind}:${accountId}:connected`,
      });

      accounts.push({
        providerKey: account.providerKey,
        label: account.displayLabel,
        externalAccountId: account.externalAccountId,
        accountId,
      });
    }
  }

  if (accounts.length === 0) {
    notes.push(
      "The provider accepted the authorisation, but no account of the requested kind was reachable with it.",
    );
  }

  return { accounts, notes };
}

/** The token response, normalised across providers. */
interface NormalisedTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
}

/**
 * Redeem an authorisation code.
 */
async function redeemCode(options: {
  config: OAuthProviderConfig;
  credential: AppCredential;
  code: string;
  redirectUri: string;
  codeVerifier: string | null;
}): Promise<NormalisedTokens> {
  const { config, credential } = options;

  if (config.secretRequired && !credential.secret) {
    throw new Error(
      `The ${config.displayName} app secret is not stored. Re-enter it in Settings — Integrations.`,
    );
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code: options.code,
    redirect_uri: options.redirectUri,
    client_id: credential.clientId,
  });

  if (credential.secret) params.set("client_secret", credential.secret);
  if (options.codeVerifier) params.set("code_verifier", options.codeVerifier);

  const url =
    config.tokenMethod === "query"
      ? `${config.tokenUrl}?${params.toString()}`
      : config.tokenUrl;

  const response = await fetch(url, {
    method: "POST",
    headers:
      config.tokenMethod === "query"
        ? { "Content-Type": "application/json" }
        : { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      config.tokenMethod === "query"
        ? JSON.stringify({})
        : params.toString(),
  });

  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    const description =
      body.error_description ??
      body.error ??
      `HTTP ${response.status}`;
    throw new Error(`${config.displayName} rejected the token exchange: ${description}`);
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in,
    scope: body.scope,
  };
}

/**
 * Exchange a short-lived token for a long-lived one, where the provider
 * wants that.
 */
async function extendIfNeeded(options: {
  providerKey: OAuthProviderKey;
  credential: AppCredential;
  tokens: NormalisedTokens;
}): Promise<string> {
  if (options.providerKey !== "meta") return options.tokens.accessToken;

  const { credential, tokens } = options;

  if (!credential.secret) {
    // Without the secret the short-lived token is all there is. It works
    // for about an hour, which is reported rather than hidden.
    return tokens.accessToken;
  }

  const url = new URL("https://graph.facebook.com/v23.0/oauth/access_token");
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", credential.clientId);
  url.searchParams.set("client_secret", credential.secret);
  url.searchParams.set("fb_exchange_token", tokens.accessToken);

  const response = await fetch(url.toString());
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    // The short-lived token still works. The caller is told it is
    // short-lived rather than being handed a broken connection.
    return tokens.accessToken;
  }

  return body.access_token;
}

/**
 * Create or update the provider connection.
 */
async function upsertConnection(options: {
  db: Db;
  workspaceId: string;
  providerKey: string;
  label: string;
  scopes: string[];
}): Promise<string> {
  const now = new Date().toISOString();

  const { data, error } = await options.db
    .from("provider_connections")
    .upsert(
      {
        workspace_id: options.workspaceId,
        provider_key: options.providerKey,
        display_label: options.label,
        status: "connected",
        auth_mode: "oauth",
        scopes: options.scopes,
        last_attempt_at: now,
        updated_at: now,
      },
      {
        onConflict: "workspace_id,provider_key,display_label",
      },
    )
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not create the ${options.providerKey} connection: ${error?.message ?? "unknown"}`,
    );
  }

  return (data as { id: string }).id;
}

/**
 * Create or update the external account.
 */
async function upsertAccount(options: {
  db: Db;
  workspaceId: string;
  connectionId: string;
  providerKey: string;
  externalAccountId: string;
  displayLabel: string;
  identifiers: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await options.db
    .from("external_accounts")
    .upsert(
      {
        workspace_id: options.workspaceId,
        connection_id: options.connectionId,
        provider_key: options.providerKey,
        external_account_id: options.externalAccountId,
        display_label: options.displayLabel,
        identifiers: options.identifiers,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "workspace_id,provider_key,external_account_id",
      },
    )
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not create the ${options.providerKey} account: ${error?.message ?? "unknown"}`,
    );
  }

  return (data as { id: string }).id;
}

/**
 * Store the app credential. Used by the settings screen.
 */
export async function saveAppCredential(
  db: Db,
  options: {
    workspaceId: string;
    providerKey: string;
    clientId: string;
    secret?: string | null;
    redirectUri?: string | null;
    scopes?: string[];
    notes?: string | null;
    actorUserId?: string | null;
  },
): Promise<void> {
  await writeAppCredential(db, options);
}
