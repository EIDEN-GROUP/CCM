/**
 * Provider registry — the single place that knows what each provider can do
 * and where its accounts live.
 *
 * Two responsibilities, deliberately kept together so they cannot drift:
 *
 *  1. **Capabilities** — what CCM may read from a provider, which scopes and
 *     approvals that needs, and whether it is implemented yet.
 *  2. **Launch targets** — the exact native destination for an account.
 *
 * The launch builders are the security boundary of the account launcher. They
 * are pure functions of *server-side* account identifiers: the browser never
 * supplies a URL, so it can never smuggle one in. Each builder's output is
 * re-validated against `hosts` before it leaves the server.
 */

export type ProviderKey =
  | "google_ads"
  | "ga4"
  | "gsc"
  | "gtm"
  | "youtube"
  | "gmail"
  | "meta"
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "ahrefs"
  | "clarity"
  | "pagespeed"
  | "uptime";

export type ProviderCategory =
  | "advertising"
  | "analytics"
  | "search"
  | "tagging"
  | "social"
  | "email"
  | "seo"
  | "ux"
  | "site";

export type CapabilityKey =
  | "read.metrics"
  | "read.accounts"
  | "read.content"
  | "read.mail"
  | "read.site"
  | "read.backlinks"
  | "read.ranks"
  | "launch.account"
  | "launch.management"
  | "write.publish"
  | "write.send"
  | "write.budget";

export interface ProviderCapability {
  key: CapabilityKey;
  /** `true` only when CCM implements it today, not when the provider allows it. */
  implemented: boolean;
  /** What the owner must have approved for this to work. */
  requires?: string;
  /** Honest limitation. */
  limitation?: string;
}

/** Identifiers CCM stores for an account. All server-side. */
export interface AccountIdentifiers {
  google_ads?: { customerId?: string; managerCustomerId?: string };
  ga4?: { propertyId?: string; measurementId?: string };
  gsc?: { propertyUrl?: string };
  gtm?: { containerId?: string };
  youtube?: { channelId?: string };
  gmail?: { mailboxEmail?: string };
  meta?: { pageId?: string; igBusinessAccountId?: string; username?: string };
  tiktok?: { username?: string; accountId?: string };
  linkedin?: { organizationId?: string; pageSlug?: string };
  ahrefs?: { projectId?: string };
  clarity?: { projectId?: string };
}

export interface LaunchTarget {
  /** Where clicking "Open account" should land. */
  account?: (ids: AccountIdentifiers) => string | null;
  /** Where clicking "Open management" should land. */
  management?: (ids: AccountIdentifiers) => string | null;
}

export interface ProviderDefinition {
  key: ProviderKey;
  displayName: string;
  category: ProviderCategory;
  /** lucide-react icon name. */
  icon: string;
  /** HTTPS hostnames the launcher is allowed to open for this provider. */
  hosts: string[];
  /** Pinned API version. Central so a deprecation is a one-file change. */
  apiVersion: string;
  capabilities: ProviderCapability[];
  launch: LaunchTarget;
  docsUrl: string;
  /** Approvals the owner must obtain before this provider can report live data. */
  blockingApprovals: string[];
}

/* --------------------------------------------------------------------------
 * URL builders. Each returns null when the required identifier is missing —
 * CCM never guesses an identifier and never falls back to a provider homepage
 * when an exact destination exists.
 * ----------------------------------------------------------------------- */

function googleAdsAccount(ids: AccountIdentifiers): string | null {
  const id = ids.google_ads?.customerId;
  if (!id) return null;
  return `https://ads.google.com/aw?ocid=${encodeURIComponent(id)}`;
}

function googleAdsManagement(ids: AccountIdentifiers): string | null {
  const manager = ids.google_ads?.managerCustomerId;
  const customer = ids.google_ads?.customerId;
  if (manager) {
    return `https://ads.google.com/adsmanager/aw?ocid=${encodeURIComponent(manager)}`;
  }
  if (customer) {
    return `https://ads.google.com/adsmanager/aw?ocid=${encodeURIComponent(customer)}`;
  }
  return null;
}

function ga4Account(ids: AccountIdentifiers): string | null {
  const property = ids.ga4?.propertyId;
  if (!property) return null;
  // /analytics/web/data/reports is not a valid deep link; the property
  // parameter on the web entry point is.
  return `https://analytics.google.com/analytics/web/?property=${encodeURIComponent(property)}`;
}

function ga4Management(ids: AccountIdentifiers): string | null {
  const property = ids.ga4?.propertyId;
  if (!property) return null;
  return `https://analytics.google.com/analytics/web/admin/property/${encodeURIComponent(property)}/usage`;
}

function gscAccount(ids: AccountIdentifiers): string | null {
  const property = ids.gsc?.propertyUrl;
  if (!property) return null;
  return `https://search.google.com/search-console?resource_id=${encodeURIComponent(property)}`;
}

function gscManagement(): string | null {
  return "https://search.google.com/search-console/";
}

function gtmAccount(ids: AccountIdentifiers): string | null {
  const container = ids.gtm?.containerId;
  if (!container) return null;
  return `https://tagmanager.google.com/#/versions?gmid=${encodeURIComponent(container)}`;
}

function gtmManagement(ids: AccountIdentifiers): string | null {
  const container = ids.gtm?.containerId;
  if (!container) return null;
  return `https://tagmanager.google.com/#/containers/${encodeURIComponent(container)}/settings`;
}

function youtubeAccount(ids: AccountIdentifiers): string | null {
  const channel = ids.youtube?.channelId;
  if (!channel) return null;
  return `https://studio.youtube.com/channel/${encodeURIComponent(channel)}/videos/upload`;
}

function youtubeManagement(ids: AccountIdentifiers): string | null {
  const channel = ids.youtube?.channelId;
  if (!channel) return null;
  return `https://studio.youtube.com/channel/${encodeURIComponent(channel)}/analytics/advanced`;
}

function gmailAccount(_ids: AccountIdentifiers): string | null {
  // mail.google.com/mail/u/0 is the first signed-in account. When the
  // mailbox differs we still land in the mailbox list rather than a wrong
  // folder, and the UI shows which identity will be used.
  return "https://mail.google.com/mail/u/0/#inbox";
}

function gmailManagement(ids: AccountIdentifiers): string | null {
  const mailbox = ids.gmail?.mailboxEmail;
  if (!mailbox) return "https://mail.google.com/mail/u/0/";
  return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(mailbox)}`;
}

function metaAccount(ids: AccountIdentifiers): string | null {
  const page = ids.meta?.pageId;
  if (!page) return null;
  return `https://www.facebook.com/${encodeURIComponent(page)}`;
}

function metaManagement(ids: AccountIdentifiers): string | null {
  const page = ids.meta?.pageId;
  if (page) {
    return `https://business.facebook.com/latest/home?business_id=${encodeURIComponent(page)}`;
  }
  return "https://business.facebook.com/latest/home";
}

function instagramAccount(ids: AccountIdentifiers): string | null {
  const username = ids.meta?.username;
  if (username) {
    return `https://www.instagram.com/${encodeURIComponent(username)}/`;
  }
  const igAccount = ids.meta?.igBusinessAccountId;
  if (igAccount) {
    return `https://www.facebook.com/${encodeURIComponent(igAccount)}`;
  }
  return null;
}

function instagramManagement(): string | null {
  return "https://www.instagram.com/professional/";
}

function tiktokAccount(ids: AccountIdentifiers): string | null {
  const username = ids.tiktok?.username?.replace(/^@/, "");
  if (!username) return "https://www.tiktok.com/login";
  return `https://www.tiktok.com/@${encodeURIComponent(username)}`;
}

function tiktokManagement(): string | null {
  return "https://www.tiktok.com/creator-center/";
}

function linkedinAccount(ids: AccountIdentifiers): string | null {
  const slug = ids.linkedin?.pageSlug;
  if (slug) {
    return `https://www.linkedin.com/company/${encodeURIComponent(slug)}/`;
  }
  const org = ids.linkedin?.organizationId;
  if (org) {
    return `https://www.linkedin.com/company/${encodeURIComponent(org)}/`;
  }
  return null;
}

function linkedinManagement(): string | null {
  return "https://www.linkedin.com/company/page/manage/";
}

function ahrefsAccount(ids: AccountIdentifiers): string | null {
  const project = ids.ahrefs?.projectId;
  if (!project) return null;
  return `https://app.ahrefs.com/rank-tracker/${encodeURIComponent(project)}`;
}

function clarityAccount(ids: AccountIdentifiers): string | null {
  const project = ids.clarity?.projectId;
  if (!project) return null;
  return `https://clarity.microsoft.com/projects/${encodeURIComponent(project)}/`;
}

function clarityManagement(ids: AccountIdentifiers): string | null {
  const project = ids.clarity?.projectId;
  if (!project) return null;
  return `https://clarity.microsoft.com/projects/${encodeURIComponent(project)}/explore`;
}

function pagespeedAccount(_ids: AccountIdentifiers): string | null {
  return "https://pagespeed.web.dev/";
}

function uptimeAccount(_ids: AccountIdentifiers): string | null {
  return "https://www.google.com/search?q=site%3Amedicalbay.ma";
}

export const PROVIDERS: Record<ProviderKey, ProviderDefinition> = {
  google_ads: {
    key: "google_ads",
    displayName: "Google Ads",
    category: "advertising",
    icon: "BadgeDollarSign",
    hosts: ["ads.google.com", "adwords.google.com"],
    apiVersion: "v25",
    capabilities: [
      { key: "read.metrics", implemented: true, requires: "Google Ads API access level granted on the Google Cloud project" },
      { key: "read.accounts", implemented: true, requires: "Manager account linked to the target account" },
      { key: "launch.account", implemented: true },
      { key: "launch.management", implemented: true },
      {
        key: "write.budget",
        implemented: false,
        limitation: "Read-only in v1. All writes require explicit approval, preview and audit.",
      },
    ],
    launch: { account: googleAdsAccount, management: googleAdsManagement },
    docsUrl: "https://developers.google.com/google-ads/api/docs/start",
    blockingApprovals: [
      "Google Ads API access level applied for on the Google Cloud project (Explorer for production read access).",
      "Brand verification for Basic or Standard access levels.",
    ],
  },
  ga4: {
    key: "ga4",
    displayName: "GA4",
    category: "analytics",
    icon: "ChartPie",
    hosts: ["analytics.google.com"],
    apiVersion: "v1beta",
    capabilities: [
      { key: "read.metrics", implemented: true, requires: "Analytics Data API scope" },
      { key: "read.accounts", implemented: true, requires: "Analytics Admin API scope for property discovery" },
      { key: "launch.account", implemented: true },
      { key: "launch.management", implemented: true },
    ],
    launch: { account: ga4Account, management: ga4Management },
    docsUrl: "https://developers.google.com/analytics/devguides/reporting/data/v1",
    blockingApprovals: ["Analytics Data API enabled on the Google Cloud project"],
  },
  gsc: {
    key: "gsc",
    displayName: "Search Console",
    category: "search",
    icon: "Search",
    hosts: ["search.google.com"],
    apiVersion: "v1",
    capabilities: [
      {
        key: "read.metrics",
        implemented: true,
        requires: "Search Console API scope + verified property",
        limitation:
          "The searchanalytics.query endpoint returns aggregated rows. It does not return every query; a site with many long-tail queries will be sampled and grouped.",
      },
      { key: "read.accounts", implemented: true },
      { key: "launch.account", implemented: true },
      { key: "launch.management", implemented: true },
    ],
    launch: { account: gscAccount, management: gscManagement },
    docsUrl: "https://developers.google.com/webmaster-tools/v1/searchanalytics/query",
    blockingApprovals: [
      "Search Console API enabled",
      "Property verified (the site already carries a google-site-verification tag).",
    ],
  },
  gtm: {
    key: "gtm",
    displayName: "GTM",
    category: "tagging",
    icon: "Tags",
    hosts: ["tagmanager.google.com"],
    apiVersion: "v2",
    capabilities: [
      { key: "read.metrics", implemented: true, requires: "Tag Manager API scope" },
      { key: "read.accounts", implemented: true },
      { key: "launch.account", implemented: true },
      { key: "launch.management", implemented: true },
      {
        key: "write.publish",
        implemented: false,
        limitation:
          "Publishing a container version requires preview, an authorised approver, a before/after version reference and an audit record.",
      },
    ],
    launch: { account: gtmAccount, management: gtmManagement },
    docsUrl: "https://developers.google.com/tag-platform/tag-manager/api/v2",
    blockingApprovals: ["Tag Manager API enabled and container shared with the OAuth client"],
  },
  youtube: {
    key: "youtube",
    displayName: "YouTube",
    category: "social",
    icon: "Youtube",
    hosts: ["studio.youtube.com", "www.youtube.com"],
    apiVersion: "v3",
    capabilities: [
      {
        key: "read.metrics",
        implemented: false,
        limitation:
          "Not implemented in the current slice. The YouTube channel is not linked from the public site yet.",
      },
      { key: "read.accounts", implemented: false, limitation: "Account discovery is not wired up: the YouTube channel is not linked from the public site yet." },
      { key: "launch.account", implemented: true },
      { key: "launch.management", implemented: true },
    ],
    launch: { account: youtubeAccount, management: youtubeManagement },
    docsUrl: "https://developers.google.com/youtube/v3",
    blockingApprovals: ["YouTube Data API + YouTube Analytics API enabled"],
  },
  gmail: {
    key: "gmail",
    displayName: "Gmail",
    category: "email",
    icon: "Mail",
    hosts: ["mail.google.com"],
    apiVersion: "v1",
    capabilities: [
      {
        key: "read.mail",
        implemented: false,
        limitation: "Implemented in the mailbox stage; not yet wired to the inbox workspace.",
      },
      {
        key: "read.accounts",
        implemented: false,
        limitation:
          "Mailbox discovery is wired up in the mailbox stage, not yet in the connection catalogue.",
      },
      { key: "launch.account", implemented: true },
      { key: "launch.management", implemented: true },
      {
        key: "write.send",
        implemented: false,
        limitation:
          "Sending requires an explicit confirmation step showing the sending identity, plus an audit record.",
      },
    ],
    launch: { account: gmailAccount, management: gmailManagement },
    docsUrl: "https://developers.google.com/workspace/gmail/api/guides",
    blockingApprovals: [
      "Gmail API enabled on the Google Cloud project",
      "Restricted-scope verification or security assessment if the Gmail scopes used are restricted.",
    ],
  },
  meta: {
    key: "meta",
    displayName: "Meta / Instagram",
    category: "social",
    icon: "Instagram",
    hosts: [
      "www.facebook.com",
      "business.facebook.com",
      "www.instagram.com",
      "graph.facebook.com",
    ],
    apiVersion: "v23.0",
    capabilities: [
      {
        key: "read.metrics",
        implemented: false,
        limitation:
          "Organic Instagram insights and paid Meta ads come from different surfaces and are never merged.",
      },
      {
        key: "read.accounts",
        implemented: false,
        limitation:
          "Page discovery needs the Meta Graph API pages edge; it is not implemented in this slice.",
      },
      { key: "launch.account", implemented: true },
      { key: "launch.management", implemented: true },
      {
        key: "write.publish",
        implemented: false,
        limitation: "Publishing requires app review and a confirmed target preview.",
      },
    ],
    launch: { account: metaAccount, management: metaManagement },
    docsUrl: "https://developers.facebook.com/docs/graph-api/",
    blockingApprovals: [
      "Meta app with the pages_read_engagement / instagram insights permissions",
      "App review for any publishing permission",
    ],
  },
  instagram: {
    key: "instagram",
    displayName: "Instagram",
    category: "social",
    icon: "Instagram",
    hosts: ["www.instagram.com", "graph.facebook.com"],
    apiVersion: "v23.0",
    capabilities: [
      {
        key: "read.metrics",
        implemented: false,
        limitation:
          "Organic Instagram insights require an Instagram professional account linked to a Facebook Page and an app with the relevant permissions. Paid Instagram results belong to the Meta ads connection, not this one.",
      },
      {
        key: "read.accounts",
        implemented: false,
        limitation:
          "Organisation discovery needs the LinkedIn organisation API; it is not implemented in this slice.",
      },
      { key: "launch.account", implemented: true },
      { key: "launch.management", implemented: true },
      {
        key: "write.publish",
        implemented: false,
        limitation: "Publishing requires app review and a confirmed target preview.",
      },
    ],
    launch: { account: instagramAccount, management: instagramManagement },
    docsUrl: "https://developers.facebook.com/docs/instagram-api/",
    blockingApprovals: [
      "Instagram professional (business/creator) account linked to a Facebook Page",
      "App with instagram_basic and the required insights permissions",
    ],
  },
  tiktok: {
    key: "tiktok",
    displayName: "TikTok",
    category: "social",
    icon: "Video",
    hosts: ["www.tiktok.com"],
    apiVersion: "n/a",
    capabilities: [
      { key: "read.metrics", implemented: false, limitation: "TikTok analytics are not connected in this version; this entry only opens TikTok in the paired browser." },
      { key: "read.accounts", implemented: false, limitation: "TikTok account discovery is not connected; add a saved browser login or enter the profile username." },
      { key: "launch.account", implemented: true },
      { key: "launch.management", implemented: true },
    ],
    launch: { account: tiktokAccount, management: tiktokManagement },
    docsUrl: "https://developers.tiktok.com/",
    blockingApprovals: [],
  },
  linkedin: {
    key: "linkedin",
    displayName: "LinkedIn",
    category: "social",
    icon: "Linkedin",
    hosts: ["www.linkedin.com"],
    apiVersion: "2026-10",
    capabilities: [
      {
        key: "read.metrics",
        implemented: false,
        limitation:
          "LinkedIn Marketing API versions are time-based and require scheduled migration; the version is pinned centrally in this registry.",
      },
      { key: "read.accounts", implemented: false, limitation: "Organisation discovery needs the LinkedIn organisation API; it is not implemented in this slice." },
      { key: "launch.account", implemented: true },
      { key: "launch.management", implemented: true },
    ],
    launch: { account: linkedinAccount, management: linkedinManagement },
    docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/integrations/migrations",
    blockingApprovals: ["LinkedIn app with organisation admin access and approved Marketing API scopes"],
  },
  ahrefs: {
    key: "ahrefs",
    displayName: "SEO / Rankings",
    category: "seo",
    icon: "TrendingUp",
    hosts: ["app.ahrefs.com", "docs.ahrefs.com"],
    apiVersion: "v3",
    capabilities: [
      {
        key: "read.ranks",
        implemented: false,
        limitation:
          "Third-party rank observations. Never presented as Google Search Console data and never merged with it.",
      },
      { key: "read.backlinks", implemented: false, limitation: "Site Explorer is not wired up in this slice; only rank observations are planned." },
      { key: "read.accounts", implemented: false, limitation: "Ahrefs project discovery is not wired up; the project id is configured by the owner." },
      { key: "launch.account", implemented: true },
    ],
    launch: { account: ahrefsAccount },
    docsUrl: "https://docs.ahrefs.com/",
    blockingApprovals: ["Ahrefs API key with units available on the subscribed plan"],
  },
  clarity: {
    key: "clarity",
    displayName: "Clarity / UX",
    category: "ux",
    icon: "Eye",
    hosts: ["clarity.microsoft.com"],
    apiVersion: "export-v1",
    capabilities: [
      {
        key: "read.metrics",
        implemented: false,
        limitation:
          "Only aggregate metrics and snapshots that the official export surface provides. CCM does not store session recordings or form fields.",
      },
      { key: "read.accounts", implemented: false, limitation: "Clarity project discovery is not wired up; the project id is configured by the owner." },
      { key: "launch.account", implemented: true },
      { key: "launch.management", implemented: true },
    ],
    launch: { account: clarityAccount, management: clarityManagement },
    docsUrl: "https://learn.microsoft.com/en-us/clarity/",
    blockingApprovals: ["Clarity project ID; API token if the plan exposes one"],
  },
  pagespeed: {
    key: "pagespeed",
    displayName: "PageSpeed",
    category: "site",
    icon: "Gauge",
    hosts: ["pagespeed.web.dev", "www.googleapis.com"],
    apiVersion: "v5",
    capabilities: [
      {
        key: "read.site",
        implemented: true,
        limitation:
          "A Lighthouse lab run for the target URL, on the mobile or desktop strategy. Field data is reported separately and is unavailable until the URL has enough real traffic.",
      },
      { key: "read.accounts", implemented: false, limitation: "PageSpeed has no accounts; the target URLs come from the website registry." },
      { key: "launch.account", implemented: true },
    ],
    launch: { account: pagespeedAccount },
    docsUrl: "https://developers.google.com/speed/docs/insights/v5/get-started",
    blockingApprovals: ["PageSpeed Insights API enabled; API key optional but recommended for quota"],
  },
  uptime: {
    key: "uptime",
    displayName: "Uptime / SSL",
    category: "site",
    icon: "Activity",
    hosts: ["www.google.com"],
    apiVersion: "n/a",
    capabilities: [
      {
        key: "read.site",
        implemented: true,
        limitation:
          "An HTTP reachability check and a TLS certificate read, from CCM's server. It is not a real-user measurement.",
      },
      { key: "read.accounts", implemented: false, limitation: "Uptime has no accounts; the target hosts come from the website registry." },
      { key: "launch.account", implemented: true },
    ],
    launch: { account: uptimeAccount },
    docsUrl: "https://developers.google.com/speed/docs/insights/v5/get-started",
    blockingApprovals: [],
  },
};

export const PROVIDER_LIST: ProviderDefinition[] = Object.values(PROVIDERS);

export function getProvider(key: ProviderKey): ProviderDefinition {
  const provider = PROVIDERS[key];
  if (!provider) throw new Error(`Unknown provider: ${key}`);
  return provider;
}

export function providerSupports(
  provider: ProviderDefinition,
  capability: CapabilityKey,
): boolean {
  return provider.capabilities.some(
    (c) => c.key === capability && c.implemented,
  );
}

/** Every capability that a provider declares, implemented or not. */
export function providerCapability(
  provider: ProviderDefinition,
  capability: CapabilityKey,
): ProviderCapability | undefined {
  return provider.capabilities.find((c) => c.key === capability);
}
