/**
 * The seed data: roles, the permission matrix, the provider catalogue and
 * the metric registry.
 *
 * This module is the single source of truth. Two consumers read it:
 *
 *   - `scripts/seed-database.mts` applies it to a database through the
 *     service-role client (used when the SQL migrations have not been run);
 *   - `scripts/generate-seed-migration.mts` renders it into
 *     `supabase/migrations/20260101000012_reconcile.sql`, so the migration
 *     and the live rows cannot drift apart.
 *
 * The permission matrix here is the authority for what each role may read
 * and write. `src/domain/permissions.ts` mirrors it for the interface, and
 * a test asserts the two agree.
 */

import {
  DEFAULT_TAB_LEVELS,
  ROLE_PERMISSIONS,
} from "./permissions";

export const ROLE_SEED = [
  {
    key: "owner",
    label: "Owner",
    account_scoped: false,
    description:
      "Full control including workspace ownership and deletion.",
  },
  {
    key: "admin",
    label: "Administrator",
    account_scoped: false,
    description: "Full control of features, users and connections.",
  },
  {
    key: "marketing_analyst",
    label: "Marketing Analyst",
    account_scoped: false,
    description: "Reads every channel; manages alerts and exports.",
  },
  {
    key: "seo",
    label: "SEO",
    account_scoped: false,
    description: "Search Console, rankings and technical SEO.",
  },
  {
    key: "ads_manager",
    label: "Ads Manager",
    account_scoped: false,
    description: "Paid media reporting.",
  },
  {
    key: "social_manager",
    label: "Social Manager",
    account_scoped: false,
    description: "Social accounts, content and inbox.",
  },
  {
    key: "mailbox_user",
    label: "Mailbox User",
    account_scoped: true,
    description: "Only the mailboxes explicitly granted to them.",
  },
  {
    key: "read_only",
    label: "Read-only",
    account_scoped: false,
    description: "Can view reporting but change nothing.",
  },
] as const;

/** Every permission, in the order it is granted. */
export const ALL_PERMISSIONS = [
  "overview.read",
  "websites.read",
  "ads.read",
  "analytics.read",
  "gtm.read",
  "seo.read",
  "ux.read",
  "social.read",
  "inbox.read",
  "inbox.send",
  "alerts.read",
  "alerts.manage",
  "reports.read",
  "reports.export",
  "integrations.read",
  "integrations.manage",
  "settings.manage",
  "roles.manage",
  "audit.read",
  "launch.read",
  "launch.execute",
  "ai.query",
] as const;

/** Permissions granted to each role. */
/**
 * Permissions granted to each role.
 *
 * Derived from the tab levels rather than written out by hand, so the
 * database and the interface cannot disagree about what a role may do.
 */
export const ROLE_PERMISSION_SEED: Record<string, readonly string[]> =
  Object.fromEntries(
    Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => [
      role,
      permissions as readonly string[],
    ]),
  );

/**
 * The tab levels each role starts with.
 *
 * This is what the owner sees and edits. The permission set above is
 * derived from it.
 */
export const ROLE_TAB_ACCESS_SEED: Record<string, Record<string, string>> =
  Object.fromEntries(
    Object.entries(DEFAULT_TAB_LEVELS).map(([role, levels]) => [
      role,
      levels as Record<string, string>,
    ]),
  );
export const PROVIDER_SEED = [
  {
    key: "google_ads",
    display_name: "Google Ads",
    category: "advertising",
    api_version: "v25",
    hosts: ["ads.google.com", "adwords.google.com"],
    docs_url: "https://developers.google.com/google-ads/api/docs/start",
    blocking_approvals: [
      "Google Ads API access level applied for on the Google Cloud project (Explorer for production read access).",
      "Brand verification for Basic or Standard access levels.",
    ],
  },
  {
    key: "ga4",
    display_name: "GA4",
    category: "analytics",
    api_version: "v1beta",
    hosts: ["analytics.google.com"],
    docs_url:
      "https://developers.google.com/analytics/devguides/reporting/data/v1",
    blocking_approvals: [
      "Analytics Data API enabled on the Google Cloud project",
    ],
  },
  {
    key: "gsc",
    display_name: "Search Console",
    category: "search",
    api_version: "v1",
    hosts: ["search.google.com"],
    docs_url:
      "https://developers.google.com/webmaster-tools/v1/searchanalytics/query",
    blocking_approvals: ["Search Console API enabled", "Property verified"],
  },
  {
    key: "gtm",
    display_name: "GTM",
    category: "tagging",
    api_version: "v2",
    hosts: ["tagmanager.google.com"],
    docs_url:
      "https://developers.google.com/tag-platform/tag-manager/api/v2",
    blocking_approvals: [
      "Tag Manager API enabled and container shared with the OAuth client",
    ],
  },
  {
    key: "youtube",
    display_name: "YouTube",
    category: "social",
    api_version: "v3",
    hosts: ["studio.youtube.com", "www.youtube.com"],
    docs_url: "https://developers.google.com/youtube/v3",
    blocking_approvals: [
      "YouTube Data API and YouTube Analytics API enabled",
    ],
  },
  {
    key: "gmail",
    display_name: "Gmail",
    category: "email",
    api_version: "v1",
    hosts: ["mail.google.com"],
    docs_url: "https://developers.google.com/workspace/gmail/api/guides",
    blocking_approvals: [
      "Gmail API enabled",
      "Restricted-scope verification or security assessment if the scopes used are restricted",
    ],
  },
  {
    key: "meta",
    display_name: "Meta / Instagram",
    category: "social",
    api_version: "v23.0",
    hosts: [
      "www.facebook.com",
      "business.facebook.com",
      "graph.facebook.com",
      "www.instagram.com",
    ],
    docs_url: "https://developers.facebook.com/docs/graph-api/",
    blocking_approvals: [
      "Meta app with the required pages and insights permissions",
      "App review for any publishing permission",
    ],
  },
  {
    key: "instagram",
    display_name: "Instagram",
    category: "social",
    api_version: "v23.0",
    hosts: ["www.instagram.com", "graph.facebook.com"],
    docs_url: "https://developers.facebook.com/docs/instagram-api/",
    blocking_approvals: [
      "Instagram professional account linked to a Facebook Page",
      "App review for the insights permissions",
    ],
  },
  {
    key: "tiktok",
    display_name: "TikTok",
    category: "social",
    api_version: "n/a",
    hosts: ["www.tiktok.com"],
    docs_url: "https://developers.tiktok.com/",
    blocking_approvals: [],
  },
  {
    key: "linkedin",
    display_name: "LinkedIn",
    category: "social",
    api_version: "2026-10",
    hosts: ["www.linkedin.com"],
    docs_url:
      "https://learn.microsoft.com/en-us/linkedin/marketing/integrations/migrations",
    blocking_approvals: [
      "LinkedIn app with organisation admin access and approved Marketing API scopes",
    ],
  },
  {
    key: "ahrefs",
    display_name: "SEO / Rankings",
    category: "seo",
    api_version: "v3",
    hosts: ["app.ahrefs.com", "docs.ahrefs.com"],
    docs_url: "https://docs.ahrefs.com/",
    blocking_approvals: [
      "Ahrefs API key with units available on the subscribed plan",
    ],
  },
  {
    key: "clarity",
    display_name: "Clarity / UX",
    category: "ux",
    api_version: "export-v1",
    hosts: ["clarity.microsoft.com"],
    docs_url: "https://learn.microsoft.com/en-us/clarity/",
    blocking_approvals: [
      "Clarity project ID; API token if the plan exposes one",
    ],
  },
  {
    key: "pagespeed",
    display_name: "PageSpeed",
    category: "site",
    api_version: "v5",
    hosts: ["pagespeed.web.dev", "www.googleapis.com"],
    docs_url:
      "https://developers.google.com/speed/docs/insights/v5/get-started",
    blocking_approvals: ["PageSpeed Insights API enabled"],
  },
  {
    key: "uptime",
    display_name: "Uptime / SSL",
    category: "site",
    api_version: "n/a",
    hosts: ["www.google.com"],
    docs_url:
      "https://developers.google.com/speed/docs/insights/v5/get-started",
    blocking_approvals: [],
  },
] as const;

export const METRIC_SEED = [
  {
    key: "ads.spend",
    display_name: "Ad spend",
    definition:
      "Total spend reported by Google Ads for the selected period.",
    formula: "SUM(cost_micros) / 1000000",
    connector: "google_ads",
    source_field: "metrics.cost_micros",
    unit: "currency",
    grain: "day",
    currency_aware: true,
    aggregation: "sum",
    dimensions: ["campaign", "ad_group", "device", "geo", "network"],
    attribution_notes:
      "Spend is attributed by Google Ads reporting, not by CCM.",
    caveats: [
      "Stored in micros of the account currency.",
      "Do not sum across accounts with different currencies without a dated exchange rate.",
      "Google Ads conversion data lags roughly 24-48 hours.",
    ],
    freshness_target_seconds: 10800,
  },
  {
    key: "ads.conversions",
    display_name: "Conversions",
    definition:
      "Conversions attributed by Google Ads for the selected period.",
    formula: "SUM(conversions)",
    connector: "google_ads",
    source_field: "metrics.conversions",
    unit: "count",
    grain: "day",
    currency_aware: false,
    aggregation: "sum",
    dimensions: ["campaign", "ad_group", "device", "geo", "network"],
    attribution_notes:
      "Uses the Google Ads attribution model and the conversion actions configured in the account.",
    caveats: [
      "Not comparable with GA4 key events: different attribution windows and different conversion definitions.",
      "Attribution model, lookback window and conversion-action scope are account settings, not CCM settings.",
    ],
    freshness_target_seconds: 10800,
  },
  {
    key: "ads.conversion_value",
    display_name: "Conversion value",
    definition:
      "Monetary value Google Ads attributes to conversions.",
    formula: "SUM(conversion_value_micros) / 1000000",
    connector: "google_ads",
    source_field: "metrics.conversion_value_micros",
    unit: "currency",
    grain: "day",
    currency_aware: true,
    aggregation: "sum",
    dimensions: ["campaign", "ad_group"],
    attribution_notes:
      "Only present when the account reports conversion value. If absent, ROAS is unavailable rather than zero.",
    caveats: [
      "Reported by the provider; CCM does not model or forecast value.",
    ],
    freshness_target_seconds: 10800,
  },
  {
    key: "ads.clicks",
    display_name: "Clicks",
    definition: "Clicks reported by Google Ads.",
    formula: "SUM(clicks)",
    connector: "google_ads",
    source_field: "metrics.clicks",
    unit: "count",
    grain: "day",
    currency_aware: false,
    aggregation: "sum",
    dimensions: ["campaign", "ad_group", "device", "geo", "network"],
    attribution_notes: null,
    caveats: [],
    freshness_target_seconds: 10800,
  },
  {
    key: "ads.impressions",
    display_name: "Impressions",
    definition: "Impressions reported by Google Ads.",
    formula: "SUM(impressions)",
    connector: "google_ads",
    source_field: "metrics.impressions",
    unit: "count",
    grain: "day",
    currency_aware: false,
    aggregation: "sum",
    dimensions: ["campaign", "ad_group", "device", "geo", "network"],
    attribution_notes: null,
    caveats: [],
    freshness_target_seconds: 10800,
  },
  {
    key: "ads.ctr",
    display_name: "Click-through rate",
    definition: "Clicks divided by impressions.",
    formula: "SUM(clicks) / SUM(impressions)",
    connector: "google_ads",
    source_field: "metrics.ctr",
    unit: "ratio",
    grain: "day",
    currency_aware: false,
    aggregation: "ratio",
    dimensions: ["campaign", "ad_group", "device"],
    attribution_notes: null,
    caveats: [
      "Undefined when impressions are zero; shown as unavailable rather than 0%.",
    ],
    freshness_target_seconds: 10800,
  },
  {
    key: "ads.cpc",
    display_name: "Average cost per click",
    definition: "Spend divided by clicks.",
    formula: "SUM(cost_micros) / SUM(clicks) / 1000000",
    connector: "google_ads",
    source_field: "metrics.average_cpc",
    unit: "currency",
    grain: "day",
    currency_aware: true,
    aggregation: "ratio",
    dimensions: ["campaign", "ad_group", "device"],
    attribution_notes: null,
    caveats: ["Undefined when clicks are zero."],
    freshness_target_seconds: 10800,
  },
  {
    key: "ads.cpa",
    display_name: "Cost per conversion",
    definition: "Spend divided by conversions.",
    formula: "SUM(cost_micros) / SUM(conversions) / 1000000",
    connector: "google_ads",
    source_field: "metrics.cost_per_conversion",
    unit: "currency",
    grain: "day",
    currency_aware: true,
    aggregation: "ratio",
    dimensions: ["campaign", "ad_group"],
    attribution_notes: "Inherits the Google Ads attribution model.",
    caveats: ["Undefined when conversions are zero."],
    freshness_target_seconds: 10800,
  },
  {
    key: "ads.roas",
    display_name: "Return on ad spend",
    definition: "Conversion value divided by spend.",
    formula: "SUM(conversion_value_micros) / SUM(cost_micros)",
    connector: "google_ads",
    source_field: "metrics.roas",
    unit: "ratio",
    grain: "day",
    currency_aware: true,
    aggregation: "ratio",
    dimensions: ["campaign", "ad_group"],
    attribution_notes: null,
    caveats: [
      "Unavailable when the account does not report conversion value.",
      "Requires matching currencies.",
    ],
    freshness_target_seconds: 10800,
  },
  {
    key: "ga4.sessions",
    display_name: "Sessions",
    definition: "Sessions reported by GA4.",
    formula: "SUM(sessions)",
    connector: "ga4",
    source_field: "sessions",
    unit: "count",
    grain: "day",
    currency_aware: false,
    aggregation: "sum",
    dimensions: ["source", "landing_page", "device", "geo"],
    attribution_notes: null,
    caveats: ["GA4 reports with roughly 24 hours of delay."],
    freshness_target_seconds: 10800,
  },
  {
    key: "ga4.active_users",
    display_name: "Active users",
    definition: "Distinct active users reported by GA4.",
    formula: "SUM(active_users)",
    connector: "ga4",
    source_field: "activeUsers",
    unit: "count",
    grain: "day",
    currency_aware: false,
    aggregation: "sum",
    dimensions: ["source", "landing_page", "device", "geo"],
    attribution_notes: null,
    caveats: [
      "Active users are not additive across days; a daily sum is not a monthly total.",
    ],
    freshness_target_seconds: 10800,
  },
  {
    key: "ga4.key_events",
    display_name: "Key events",
    definition: "Key events reported by GA4.",
    formula: "SUM(key_events)",
    connector: "ga4",
    source_field: "keyEvents",
    unit: "count",
    grain: "day",
    currency_aware: false,
    aggregation: "sum",
    dimensions: ["event", "landing_page", "source"],
    attribution_notes:
      "Key events use the GA4 attribution model, which differs from Google Ads.",
    caveats: [
      "Not comparable with Google Ads conversions without a stated definition check.",
    ],
    freshness_target_seconds: 10800,
  },
  {
    key: "ga4.engagement_rate",
    display_name: "Engagement rate",
    definition: "Engaged sessions divided by sessions.",
    formula: "SUM(engaged_sessions) / SUM(sessions)",
    connector: "ga4",
    source_field: "engagedSessions",
    unit: "ratio",
    grain: "day",
    currency_aware: false,
    aggregation: "ratio",
    dimensions: ["source", "landing_page", "device"],
    attribution_notes: null,
    caveats: [],
    freshness_target_seconds: 10800,
  },
  {
    key: "gsc.clicks",
    display_name: "Organic clicks",
    definition: "Clicks reported by Google Search Console.",
    formula: "SUM(clicks)",
    connector: "gsc",
    source_field: "clicks",
    unit: "count",
    grain: "day",
    currency_aware: false,
    aggregation: "sum",
    dimensions: ["query", "page", "country", "device", "search_type"],
    attribution_notes: null,
    caveats: [
      "The query endpoint returns aggregated rows; it does not return every query.",
    ],
    freshness_target_seconds: 43200,
  },
  {
    key: "gsc.impressions",
    display_name: "Organic impressions",
    definition: "Impressions reported by Google Search Console.",
    formula: "SUM(impressions)",
    connector: "gsc",
    source_field: "impressions",
    unit: "count",
    grain: "day",
    currency_aware: false,
    aggregation: "sum",
    dimensions: ["query", "page", "country", "device", "search_type"],
    attribution_notes: null,
    caveats: ["Aggregated by the API, not a complete query list."],
    freshness_target_seconds: 43200,
  },
  {
    key: "gsc.ctr",
    display_name: "Organic click-through rate",
    definition: "Clicks divided by impressions.",
    formula: "SUM(clicks) / SUM(impressions)",
    connector: "gsc",
    source_field: "ctr",
    unit: "ratio",
    grain: "day",
    currency_aware: false,
    aggregation: "ratio",
    dimensions: ["query", "page", "country", "device"],
    attribution_notes: null,
    caveats: ["Undefined when impressions are zero."],
    freshness_target_seconds: 43200,
  },
  {
    key: "gsc.position",
    display_name: "Average position",
    definition: "Impression-weighted average position.",
    formula: "SUM(position * impressions) / SUM(impressions)",
    connector: "gsc",
    source_field: "position",
    unit: "position",
    grain: "day",
    currency_aware: false,
    aggregation: "weighted_average",
    dimensions: ["query", "page", "country", "device"],
    attribution_notes: null,
    caveats: [
      "Impression-weighted, matching how Google reports a blended average.",
      "Distinct from third-party rank observations, which CCM stores separately.",
    ],
    freshness_target_seconds: 43200,
  },
  {
    key: "social.impressions",
    display_name: "Social impressions",
    definition: "Impressions reported by the social platform.",
    formula: "SUM(impressions)",
    connector: "meta,instagram,linkedin,youtube",
    source_field: "impressions",
    unit: "count",
    grain: "day",
    currency_aware: false,
    aggregation: "sum",
    dimensions: ["platform", "account", "post"],
    attribution_notes: null,
    caveats: [
      "Organic profile analytics and paid social results are separate series and are never merged.",
      "Availability depends on account type and API approval.",
    ],
    freshness_target_seconds: 21600,
  },
  {
    key: "social.engagements",
    display_name: "Social engagements",
    definition: "Engagements reported by the social platform.",
    formula: "SUM(engagements)",
    connector: "meta,instagram,linkedin,youtube",
    source_field: "engagements",
    unit: "count",
    grain: "day",
    currency_aware: false,
    aggregation: "sum",
    dimensions: ["platform", "account", "post"],
    attribution_notes: null,
    caveats: [
      "Platforms define engagement differently; cross-platform totals are not comparable.",
    ],
    freshness_target_seconds: 21600,
  },
  {
    key: "social.engagement_rate",
    display_name: "Social engagement rate",
    definition:
      "Engagements divided by reach, using the documented CCM formula.",
    formula: "SUM(engagements) / SUM(reach)",
    connector: "meta,instagram,linkedin,youtube",
    source_field: "derived",
    unit: "ratio",
    grain: "day",
    currency_aware: false,
    aggregation: "ratio",
    dimensions: ["platform", "account"],
    attribution_notes: null,
    caveats: [
      "Formula is engagements / reach. Platforms publishing their own rate may use a different denominator.",
    ],
    freshness_target_seconds: 21600,
  },
  {
    key: "site.uptime",
    display_name: "Site uptime",
    definition: "Share of checks that succeeded.",
    formula: "successful_checks / total_checks",
    connector: "uptime",
    source_field: "status",
    unit: "ratio",
    grain: "day",
    currency_aware: false,
    aggregation: "ratio",
    dimensions: ["website"],
    attribution_notes: null,
    caveats: [],
    freshness_target_seconds: 300,
  },
  {
    key: "site.response_time",
    display_name: "Response time",
    definition: "Median response time for successful checks.",
    formula: "median(response_time_ms)",
    connector: "uptime",
    source_field: "response_time_ms",
    unit: "milliseconds",
    grain: "day",
    currency_aware: false,
    aggregation: "median",
    dimensions: ["website"],
    attribution_notes: null,
    caveats: [],
    freshness_target_seconds: 300,
  },
] as const;

/**
 * The scheduled digest definitions.
 *
 * These are per workspace, so the repair script creates one of each for
 * every workspace that exists. They are the digests the brief asks for: a
 * daily, a weekly and a monthly read of the same synced records.
 */
export const REPORT_SEED = [
  {
    key: "daily-performance",
    title: "Daily performance digest",
    description:
      "The previous day's paid, organic and search performance, with the connections that were not reporting.",
    cadence: "daily",
    sections: ["ads", "ga4", "gsc", "alerts", "connections"],
    formats: ["csv"],
    enabled: true,
  },
  {
    key: "weekly-performance",
    title: "Weekly performance digest",
    description:
      "The last seven days across the whole site portfolio, with the campaigns that moved the most.",
    cadence: "weekly",
    sections: ["ads", "ga4", "gsc", "alerts", "connections"],
    formats: ["csv"],
    enabled: true,
  },
  {
    key: "monthly-performance",
    title: "Monthly performance digest",
    description:
      "The last thirty days, for the monthly review of spend, traffic and search.",
    cadence: "monthly",
    sections: ["ads", "ga4", "gsc", "alerts", "connections"],
    formats: ["csv"],
    enabled: true,
  },
] as const;
