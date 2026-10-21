import { GOOGLE_SCOPES } from "./google";

/**
 * The OAuth providers CCM can connect from the interface.
 *
 * Each entry says how to start an authorisation, how to redeem the code,
 * and what the owner has to fill in first. The client id and the client
 * secret live in `provider_app_credentials`, so they are entered in the
 * interface rather than in the deployment environment.
 *
 * The scope list is **per product**, so a connection asks only for what it
 * needs. A GA4 connection does not request the Ads scope.
 */

export type OAuthProviderKey = "google" | "meta" | "linkedin";

export interface OAuthProduct {
  /** The provider key this product creates a connection for. */
  key: string;
  label: string;
  /** The scopes this product needs. */
  scopes: string[];
  /** The job kind the first sync uses. */
  jobKind: string;
}

export interface OAuthProviderConfig {
  key: OAuthProviderKey;
  displayName: string;
  /** The authorisation endpoint. */
  authorizeUrl: string;
  /** The token endpoint. */
  tokenUrl: string;
  /** How the scope list is sent on the authorisation request. */
  scopeParam: "scope" | "scopes";
  /** Whether the provider supports PKCE. */
  pkce: boolean;
  /** Extra query parameters on the authorisation request. */
  authorizeParams?: Record<string, string>;
  /** How the token request is sent. */
  tokenMethod: "body" | "query";
  /** The products this app can connect. */
  products: OAuthProduct[];
  /** The name of the public field, for the settings form. */
  clientIdLabel: string;
  /** The name of the private field, for the settings form. */
  secretLabel: string;
  /** Whether the provider needs a secret to redeem a code. */
  secretRequired: boolean;
  /** Where the owner creates the app. */
  setupUrl: string;
  /** The provider's own documentation. */
  docsUrl: string;
  /** The redirect URI the owner must register, shown in the settings form. */
  redirectUriPath: string;
  /** A note about what the provider needs before the connection works. */
  requirement: string;
}

export const OAUTH_PROVIDERS: Record<OAuthProviderKey, OAuthProviderConfig> = {
  google: {
    key: "google",
    displayName: "Google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopeParam: "scope",
    pkce: true,
    tokenMethod: "body",
    products: [
      {
        key: "ga4",
        label: "Google Analytics 4",
        scopes: [...new Set(GOOGLE_SCOPES.ga4)],
        jobKind: "ga4.sessions",
      },
      {
        key: "gsc",
        label: "Google Search Console",
        scopes: [...GOOGLE_SCOPES.gsc],
        jobKind: "gsc.query",
      },
      {
        key: "gtm",
        label: "Google Tag Manager",
        scopes: [...GOOGLE_SCOPES.gtm],
        jobKind: "gtm.inventory",
      },
      {
        key: "google_ads",
        label: "Google Ads",
        scopes: [...GOOGLE_SCOPES.ads],
        jobKind: "ads.campaign",
      },
      {
        key: "youtube",
        label: "YouTube",
        scopes: [...GOOGLE_SCOPES.youtube],
        jobKind: "ga4.sessions",
      },
      {
        key: "gmail",
        label: "Gmail / Google Workspace",
        scopes: [...GOOGLE_SCOPES.gmail],
        jobKind: "mail.sync",
      },
    ],
    clientIdLabel: "OAuth client ID",
    secretLabel: "OAuth client secret",
    secretRequired: true,
    setupUrl:
      "https://console.cloud.google.com/apis/credentials",
    docsUrl:
      "https://developers.google.com/identity/protocols/oauth2/web-server",
    redirectUriPath: "/api/auth/google/callback",
    requirement:
      "Enable the API on the Cloud project, then create an OAuth client of type 'Web application' and register the redirect URI shown here.",
  },

  meta: {
    key: "meta",
    displayName: "Meta (Facebook & Instagram)",
    authorizeUrl: "https://www.facebook.com/v23.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v23.0/oauth/access_token",
    scopeParam: "scopes",
    // Meta's OAuth does not support PKCE. The state is still sealed and
    // checked, and the code is redeemed server-side with the client
    // secret, so an intercepted code is useless on its own.
    pkce: false,
    authorizeParams: {
      response_type: "code",
      display: "page",
    },
    tokenMethod: "query",
    products: [
      {
        key: "meta",
        label: "Facebook Pages",
        scopes: [
          "pages_show_list",
          "pages_read_engagement",
          "pages_manage_metadata",
          "read_insights",
        ],
        jobKind: "social.snapshot",
      },
      {
        key: "instagram",
        label: "Instagram",
        scopes: [
          "instagram_basic",
          "instagram_manage_insights",
          "pages_show_list",
          "read_insights",
        ],
        jobKind: "social.snapshot",
      },
    ],
    clientIdLabel: "App ID",
    secretLabel: "App secret",
    secretRequired: true,
    setupUrl: "https://developers.facebook.com/apps/",
    docsUrl:
      "https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/",
    redirectUriPath: "/api/auth/meta/callback",
    requirement:
      "Add the Facebook Login product, put the redirect URI in 'Valid OAuth redirect URIs', and request the permissions you need. Reading insights for a Page or an Instagram professional account needs a live app and a review unless the account is yours.",
  },

  linkedin: {
    key: "linkedin",
    displayName: "LinkedIn",
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopeParam: "scope",
    pkce: false,
    authorizeParams: {
      response_type: "code",
    },
    tokenMethod: "body",
    products: [
      {
        key: "linkedin",
        label: "Organisation page",
        scopes: [
          "openid",
          "profile",
          "email",
          "r_organization_social",
          "r_organization_admin",
        ],
        jobKind: "social.snapshot",
      },
    ],
    clientIdLabel: "Client ID",
    secretLabel: "Client secret",
    secretRequired: true,
    setupUrl: "https://www.linkedin.com/developers/apps",
    docsUrl:
      "https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow",
    redirectUriPath: "/api/auth/linkedin/callback",
    requirement:
      "Create a LinkedIn app, add 'Sign in with LinkedIn' with the company pages product, and register the redirect URI shown here. Organisation page analytics is a restricted partnership API: without it, the connection works but no figures are returned.",
  },
};

export const OAUTH_PROVIDER_LIST = Object.values(OAUTH_PROVIDERS);

/**
 * The OAuth app that serves a provider key.
 *
 * One Google app covers Analytics, Search Console, Tag Manager, Ads,
 * YouTube and Gmail. Meta covers Facebook Pages and Instagram.
 */
export function oauthProviderFor(providerKey: string): OAuthProviderKey | null {
  if (
    ["ga4", "gsc", "gtm", "google_ads", "youtube", "gmail"].includes(
      providerKey,
    )
  ) {
    return "google";
  }
  if (providerKey === "meta" || providerKey === "instagram") return "meta";
  if (providerKey === "linkedin") return "linkedin";
  return null;
}

/** The configuration for a provider, or null when it is not an OAuth one. */
export function oauthConfigFor(
  key: string,
): OAuthProviderConfig | null {
  return OAUTH_PROVIDERS[key as OAuthProviderKey] ?? null;
}

/**
 * The scopes for a set of products.
 *
 * The union, without duplicates, so requesting two products asks for the
 * shared scopes once.
 */
export function scopesForProducts(
  config: OAuthProviderConfig,
  productKeys: string[],
): string[] {
  const scopes = new Set<string>();

  for (const product of config.products) {
    if (!productKeys.includes(product.key)) continue;
    for (const scope of product.scopes) scopes.add(scope);
  }

  return [...scopes];
}

/**
 * The products a set of product keys refers to.
 */
export function productsFor(
  config: OAuthProviderConfig,
  productKeys: string[],
): OAuthProduct[] {
  return config.products.filter((product) =>
    productKeys.includes(product.key),
  );
}
