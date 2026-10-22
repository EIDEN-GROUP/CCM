/**
 * The `pages.channels` strings, in English.
 *
 * Part of the message catalogue. The three locales must have the same
 * shape, which the `Messages` type enforces at build time.
 */
export const channels = {
  overview: {
    title: "Welcome to CCM",
    subtitle: "Your central hub for marketing, growth and digital operations.",
    portfolioKpis: "Portfolio performance",
    channelTrends: "Channel trends",
    topCampaigns: "Top campaigns",
    topKeywords: "Keyword rankings",
    alerts: "Alerts & Actions",
    connections: "Data Freshness & Connections",
    viewAllCampaigns: "View all campaigns",
    viewAllKeywords: "View all keywords",
    flow: "The CCM Flow",
    flowBody: "From external platforms to actionable insights.",
    adSpend: "Ad spend",
    conversions: "Conversions",
    organicClicks: "Organic clicks",
    socialEngagement: "Social engagement",
    siteHealth: "Site health",
    sessions: "GA4 sessions",
    costPerConversion: "Cost per conversion",
    roas: "ROAS",
    impressions: "Impressions",
    ctr: "CTR",
    averagePosition: "Average position",
    connectSource: "Connect a source",
    noLiveDataTitle: "No live data yet",
    noLiveDataBody:
      "CCM is connected to your workspace but no provider has reported yet. The figures below stay empty until a source syncs — CCM does not substitute zeros for missing data. Connect a provider from",
    ga4KeyEvents: "GA4 key events",
    clicks: "Clicks",
    channelTrendsSubtitle: "Performance across all channels",
    noTrendDataTitle: "No trend data yet",
    noTrendDataBody: "The chart fills in as soon as the first sync lands.",
    organicSearch: "Organic search",
    paidSearch: "Paid search",
    chartSummarySeries:
      "{value} by day — {series} — {firstDay} to {lastDay}.",
    chartDataTableCaption:
      "The daily values plotted in the channel trends chart.",
    topCampaignsSubtitle: "By spend in the selected period",
    noCampaignsTitle: "No campaigns",
    noCampaignsBody: "Connect Google Ads to see campaign performance.",
    noConversionValue: "No conversion value reported",
    conversionValueOverSpend: "Conversion value ÷ spend",
    impressionWeighted: "Impression-weighted, Search Console",
    connectionsSubtitle: "Every source, its state and how old its data is",
    manageConnections: "Manage",
    connectionsError: "Could not read provider connections: {message}",
    noProvidersTitle: "No providers connected",
    noProvidersBody:
      "Connect Google Ads, GA4, Search Console, GTM or a mailbox to start reporting.",
    goToIntegrations: "Go to integrations",
    metricsError: "The metrics could not be read.",
    freshnessUpToDate: "Up to date",
    freshnessRefreshOverdue: "Refresh overdue",
    freshnessStale: "Data is stale",
    freshnessSyncFailing: "Sync failing — no successful run yet",
    freshnessNotConnected: "Not connected — no data yet",
    freshnessLastSyncFailed: "Last sync failed — showing last good data",
  },
  websites: {
    title: "Websites",
    subtitle: "Portfolio of sites, pages, traffic and health.",
    register: "Register a website",
    domain: "Domain",
    owner: "Owner",
    services: "Services",
    languages: "Languages",
    health: "Health",
    pages: "Pages",
    lastSync: "Last sync",
    addingSiteTitle: "Adding a site",
    addingSiteBody:
      "Registering a site links it to a Google Search Console property, a GA4 property and optionally a GTM container. The registry stores only the domain and the provider identifiers — never a page snapshot of the site.",
    portfolio: "Portfolio",
    portfolioCountOne: "{count} site",
    portfolioCountMany: "{count} sites",
    noSitesTitle: "No sites registered",
    noSitesBody:
      "Register medicalbay.ma to start reporting on traffic, search and site health.",
    site: "Site",
    hostnames: "Hostnames",
    lastCheck: "Last check",
    pagesLandingTitle: "Pages & landing pages",
    pagesLandingSubtitle:
      "Inventory grouped by language, service and page class",
    noPagesTitle: "No pages inventoried yet",
    noPagesBody:
      "The technical crawl fills this in. CCM records the URL, locale, page class and metadata — not a copy of the page.",
    websitePages: "Website pages",
    locale: "Locale",
    pageClass: "Class",
    service: "Service",
  },
  googleAds: {
    title: "Google Ads",
    subtitle: "Spend, campaigns, conversions and pacing.",
    account: "Account",
    campaigns: "Campaigns",
    adGroups: "Ad groups",
    keywords: "Keywords",
    searchTerms: "Search terms",
    spend: "Spend",
    impressions: "Impressions",
    clicks: "Clicks",
    ctr: "CTR",
    avgCpc: "Avg. CPC",
    conversions: "Conversions",
    convValue: "Conversion value",
    cpa: "CPA",
    roas: "ROAS",
    budget: "Budget",
    pacing: "Pacing",
    readOnlyNotice:
      "Read-only. Campaign edits, budget changes and pauses are disabled and require explicit approval, preview and audit logging.",
    readOnlyTitle: "Read-only",
    readOnlyBody:
      "Campaign edits, budget changes, pauses and bulk operations are disabled in this release. They require a preview, an explicit approval, an audit record and a reversible version reference before they can be offered.",
    campaignsSubtitle: "Account performance for the selected period",
    noCampaignsTitle: "No campaign data yet",
    noCampaignsBody:
      "Connect a Google Ads account. The Google Ads API access level is granted on the Google Cloud project — see Integrations for the setup steps.",
    metricsError: "The Google Ads metrics could not be read.",
  },
  analytics: {
    title: "GA4 & Attribution",
    subtitle: "Traffic sources, events, funnels and key events.",
    property: "Property",
    sessions: "Sessions",
    activeUsers: "Active users",
    newUsers: "New users",
    keyEvents: "Key events",
    revenue: "Revenue",
    landingPages: "Landing pages",
    sources: "Traffic sources",
    funnel: "Funnel",
    engagement: "Engagement",
    content: "Content performance",
    discrepancyNotice:
      "Google Ads conversions and GA4 key events use different attribution windows and definitions. They are shown side by side, never merged.",
    comparabilityTitle: "Comparability",
    comparabilityBody:
      "Google Ads conversions and GA4 key events use different attribution windows and different conversion definitions. CCM shows them side by side and flags the difference; it never silently reconciles them.",
    keyEventRate: "Key event rate",
    pageViews: "Page views",
    landingPagesSubtitle: "Sessions by landing page",
    noLandingDataTitle: "No landing page data",
    noLandingDataBody:
      "Connect a GA4 property to see which pages drive sessions.",
    sourcesSubtitle: "Sessions by source / medium",
    noSourceDataTitle: "No source data",
    noSourceDataBody: "Traffic source data appears once GA4 has reported.",
    funnelSubtitle: "Sessions → engaged sessions → key events",
    noFunnelDataTitle: "No funnel data",
    noFunnelDataBody:
      "The funnel is built from GA4 session and key-event data.",
    engagedSessions: "Engaged sessions",
    metricsError: "The GA4 metrics could not be read.",
  },
  gtm: {
    title: "GTM & Tracking",
    subtitle: "Container inventory, tags, triggers and validation.",
    container: "Container",
    workspace: "Workspace",
    tags: "Tags",
    triggers: "Triggers",
    variables: "Variables",
    versions: "Versions",
    environments: "Environments",
    expectedMeasurementId: "Expected GA4 Measurement ID",
    verification: "Verification",
    publishNotice:
      "Publishing a container version requires a preview, an authorised approver, a before/after version reference and an audit record.",
    publishingUnavailableTitle: "Publishing is not available",
    publishingUnavailableBody:
      "CCM inventories the container and checks the expected GA4 Measurement ID. Publishing a version requires a preview, an authorised approver, a before/after version reference and an audit record, so the publish action is absent rather than merely disabled.",
    inventoryError: "The container inventory could not be read: {message}",
    containerVersions: "Container versions",
    containerVersionsSubtitle: "Most recent inventory per container",
    noInventoryTitle: "No container inventory yet",
    noInventoryBody:
      "Connect a Tag Manager container. The Medical Bay site currently ships GTM-WF77DFJD.",
    version: "Version",
    expectedGa4Id: "Expected GA4 ID",
    captured: "Captured",
    trackingChecklist: "Tracking checklist",
    trackingChecklistSubtitle:
      "Each row is decided on the capture that was read; a check that cannot be computed says so",
    containerLabel: "Container {container}",
    capturedSuffix: "· captured {age}",
    captureCounted: "The capture counted {tags} and {triggers}.",
    unknownCountOf: "an unknown number of",
    tagSingular: "tag",
    tagsPlural: "tags",
    triggerSingular: "trigger",
    triggersPlural: "triggers",
    notChecked: "Not checked",
    pass: "Pass",
    fail: "Fail",
    stale: "Stale",
    captureNoDate:
      "The capture carries no readable capture date, so it cannot be compared with the published version.",
    captureNoPublishedVersion:
      "The capture records no published version, so there is no date to compare the capture against.",
    capturePredatesPublished:
      "The capture ({captured}) predates the published version ({published}).",
    captureNewerThanPublished:
      "The capture ({captured}) is newer than the published version ({published}).",
    measurementNoDefinitions:
      "The capture stored a count of tags rather than the tag definitions, so CCM cannot say which Measurement ID they reference.",
    measurementNoExpectedId:
      "The snapshot records no expected GA4 Measurement ID, so there is nothing to compare the tags against.",
    measurementMissingIds: "No tag in the capture references {ids}.",
    measurementAllIds:
      "A tag in the capture references every expected Measurement ID ({ids}).",
    duplicateNoDefinitions:
      "The capture stored a count of tags rather than the tag definitions, so duplicates cannot be ruled out.",
    duplicateNoTags:
      "The capture holds no GA4 tag, so there is no duplicate to rule out.",
    duplicateSharedIdOne:
      "{ids} is referenced by more than one tag in the capture.",
    duplicateSharedIdMany:
      "{ids} are referenced by more than one tag in the capture.",
    duplicateSharedTriggerOne:
      "{count} trigger fires more than one GA4 tag in the capture.",
    duplicateSharedTriggerMany:
      "{count} triggers fire more than one GA4 tag in the capture.",
    duplicateCleanOne:
      "No Measurement ID or trigger is shared by the {count} GA4 tag in the capture.",
    duplicateCleanMany:
      "No Measurement ID or trigger is shared by the {count} GA4 tags in the capture.",
    trackingPlanMissing:
      "CCM holds no approved-event tracking plan, so there is no list of events to compare the container against.",
    noCaptureNoDate:
      "No container capture has been recorded, so there is no capture date to compare with a published version.",
    noCaptureNoMeasurement:
      "No container capture has been recorded, so CCM cannot say whether a GA4 tag references the expected Measurement ID.",
    noCaptureNoDuplicates:
      "No container capture has been recorded, so duplicate GA4 tags cannot be ruled out.",
  },
  seo: {
    title: "SEO & Rankings",
    subtitle: "Search Console, technical checks and tracked rankings.",
    clicks: "Clicks",
    impressions: "Impressions",
    ctr: "CTR",
    position: "Average position",
    queries: "Queries",
    pages: "Pages",
    countries: "Countries",
    devices: "Devices",
    technical: "Technical SEO",
    backlinks: "Backlinks",
    content: "Content opportunities",
    sourceNotice:
      "Search Console figures are Google-reported. Third-party rank observations are shown separately and are never blended with them.",
    twoMeasurementsTitle: "Two different measurements",
    twoMeasurementsBody:
      "Search Console clicks, impressions and average position are reported by Google. Rank-tracking observations come from a third-party provider and are shown in their own table. CCM never blends them, because they measure different things.",
    organicImpressions: "Organic impressions",
    topQueries: "Top queries",
    topQueriesSubtitle: "By clicks, from Search Console",
    noQueryDataTitle: "No query data",
    noQueryDataBody:
      "Connect a verified Search Console property to see real query performance.",
    query: "Query",
    rankPosition: "Position",
    trackedRankings: "Tracked rankings",
    trackedRankingsSubtitle:
      "Third-party observations, kept separate from Search Console",
    rankError: "Could not read rank snapshots: {message}",
    noRankSnapshotsTitle: "No rank snapshots",
    noRankSnapshotsBody:
      "Rank observations appear once a rank-tracking provider is connected and a project is configured.",
    rankSnapshots: "Rank snapshots",
    observed: "Observed",
    metricsError: "The Search Console metrics could not be read.",
  },
} as const;
