/**
 * Environment access.
 *
 * Every environment variable CCM reads is declared here with its type and
 * whether it may be exposed to the browser. Server-only modules import from
 * this file; anything prefixed with `NEXT_PUBLIC_` is the only thing that
 * may cross into the client bundle.
 *
 * Nothing in this file logs a value. Missing variables surface as `null` and
 * the calling feature renders an honest "not configured" state.
 */

export const PUBLIC_ENV = {
  appUrl: "NEXT_PUBLIC_APP_URL",
  supabaseUrl: "NEXT_PUBLIC_SUPABASE_URL",
  supabaseAnonKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  bridgeExtensionId: "NEXT_PUBLIC_BRIDGE_EXTENSION_ID",
} as const;

export const SERVER_ENV = {
  supabaseServiceRoleKey: "SUPABASE_SERVICE_ROLE_KEY",
  databaseUrl: "DATABASE_URL",
  appEncryptionKey: "APP_ENCRYPTION_KEY",
  launchSigningPrivateKey: "LAUNCH_SIGNING_PRIVATE_KEY",
  launchSigningPublicKey: "LAUNCH_SIGNING_PUBLIC_KEY",
  launchSigningKeyId: "LAUNCH_SIGNING_KEY_ID",
  cronSecret: "CRON_SECRET",
  googleCloudProjectId: "GOOGLE_CLOUD_PROJECT_ID",
  appOrigin: "NEXT_PUBLIC_APP_ORIGIN",
  googleOAuthClientId: "GOOGLE_OAUTH_CLIENT_ID",
  googleOAuthClientSecret: "GOOGLE_OAUTH_CLIENT_SECRET",
  googleAdsCustomerId: "GOOGLE_ADS_CUSTOMER_ID",
  googleAdsApiAccessLevel: "GOOGLE_ADS_API_ACCESS_LEVEL",
  ga4PropertyId: "GA4_PROPERTY_ID",
  ga4MeasurementId: "GA4_MEASUREMENT_ID",
  gscPropertyUrl: "GSC_PROPERTY_URL",
  gtmContainerId: "GTM_CONTAINER_ID",
  youtubeChannelId: "YOUTUBE_CHANNEL_ID",
  metaAppId: "META_APP_ID",
  metaAppSecret: "META_APP_SECRET",
  metaAdAccountId: "META_AD_ACCOUNT_ID",
  metaPageId: "META_PAGE_ID",
  linkedinClientId: "LINKEDIN_CLIENT_ID",
  linkedinClientSecret: "LINKEDIN_CLIENT_SECRET",
  linkedinOrgId: "LINKEDIN_ORG_ID",
  linkedinPageId: "LINKEDIN_PAGE_ID",
  ahrefsApiKey: "AHREFS_API_KEY",
  ahrefsRankTrackerProjectId: "AHREFS_RANK_TRACKER_PROJECT_ID",
  clarityProjectId: "CLARITY_PROJECT_ID",
  pagespeedApiKey: "PAGESPEED_API_KEY",
  bridgePairingSecret: "BRIDGE_PAIRING_SECRET",
  geminiApiKey: "GEMINI_API_KEY",
  aiModel: "AI_MODEL",
} as const;

export type PublicEnvKey = (typeof PUBLIC_ENV)[keyof typeof PUBLIC_ENV];
export type ServerEnvKey = (typeof SERVER_ENV)[keyof typeof SERVER_ENV];

function readPublic(key: PublicEnvKey): string | null {
  const value = process.env[key];
  return value && value.length > 0 ? value : null;
}

function readServer(key: ServerEnvKey): string | null {
  const value = process.env[key];
  return value && value.length > 0 ? value : null;
}

export const publicEnv = {
  appUrl: () => readPublic(PUBLIC_ENV.appUrl),
  supabaseUrl: () => readPublic(PUBLIC_ENV.supabaseUrl),
  supabaseAnonKey: () => readPublic(PUBLIC_ENV.supabaseAnonKey),
  bridgeExtensionId: () => readPublic(PUBLIC_ENV.bridgeExtensionId),
};

export const serverEnv = {
  supabaseServiceRoleKey: () => readServer(SERVER_ENV.supabaseServiceRoleKey),
  databaseUrl: () => readServer(SERVER_ENV.databaseUrl),
  appEncryptionKey: () => readServer(SERVER_ENV.appEncryptionKey),
  launchSigningPrivateKey: () => readServer(SERVER_ENV.launchSigningPrivateKey),
  launchSigningPublicKey: () => readServer(SERVER_ENV.launchSigningPublicKey),
  launchSigningKeyId: () => readServer(SERVER_ENV.launchSigningKeyId),
  cronSecret: () => readServer(SERVER_ENV.cronSecret),
  googleCloudProjectId: () => readServer(SERVER_ENV.googleCloudProjectId),
  appOrigin: () => readServer(SERVER_ENV.appOrigin),
  googleOAuthClientId: () => readServer(SERVER_ENV.googleOAuthClientId),
  googleOAuthClientSecret: () => readServer(SERVER_ENV.googleOAuthClientSecret),
  googleAdsCustomerId: () => readServer(SERVER_ENV.googleAdsCustomerId),
  googleAdsApiAccessLevel: () => readServer(SERVER_ENV.googleAdsApiAccessLevel),
  ga4PropertyId: () => readServer(SERVER_ENV.ga4PropertyId),
  ga4MeasurementId: () => readServer(SERVER_ENV.ga4MeasurementId),
  gscPropertyUrl: () => readServer(SERVER_ENV.gscPropertyUrl),
  gtmContainerId: () => readServer(SERVER_ENV.gtmContainerId),
  youtubeChannelId: () => readServer(SERVER_ENV.youtubeChannelId),
  metaAppId: () => readServer(SERVER_ENV.metaAppId),
  metaAppSecret: () => readServer(SERVER_ENV.metaAppSecret),
  metaAdAccountId: () => readServer(SERVER_ENV.metaAdAccountId),
  metaPageId: () => readServer(SERVER_ENV.metaPageId),
  linkedinClientId: () => readServer(SERVER_ENV.linkedinClientId),
  linkedinClientSecret: () => readServer(SERVER_ENV.linkedinClientSecret),
  linkedinOrgId: () => readServer(SERVER_ENV.linkedinOrgId),
  linkedinPageId: () => readServer(SERVER_ENV.linkedinPageId),
  ahrefsApiKey: () => readServer(SERVER_ENV.ahrefsApiKey),
  ahrefsRankTrackerProjectId: () => readServer(SERVER_ENV.ahrefsRankTrackerProjectId),
  clarityProjectId: () => readServer(SERVER_ENV.clarityProjectId),
  pagespeedApiKey: () => readServer(SERVER_ENV.pagespeedApiKey),
  bridgePairingSecret: () => readServer(SERVER_ENV.bridgePairingSecret),
  geminiApiKey: () => readServer(SERVER_ENV.geminiApiKey),
  aiModel: () => readServer(SERVER_ENV.aiModel),
};

/**
 * Whether the app has the minimum configuration it needs to serve pages.
 * Used by /api/health and by the shell to show a setup banner.
 */
export function configurationReport(): {
  ready: boolean
  missing: string[]
  present: string[]
} {
  const checks: Array<[string, string | null]> = [
    ["Supabase URL", publicEnv.supabaseUrl()],
    ["Supabase anon key", publicEnv.supabaseAnonKey()],
    ["Supabase service role key", serverEnv.supabaseServiceRoleKey()],
    ["App encryption key", serverEnv.appEncryptionKey()],
    ["Launch signing private key", serverEnv.launchSigningPrivateKey()],
    ["Launch signing public key", serverEnv.launchSigningPublicKey()],
    ["Cron secret", serverEnv.cronSecret()],
  ];
  const missing = checks.filter(([, value]) => !value).map(([label]) => label);
  const present = checks.filter(([, value]) => Boolean(value)).map(([label]) => label);
  return { ready: missing.length === 0, missing, present };
}
