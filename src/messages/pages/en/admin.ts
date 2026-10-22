/**
 * The `pages.admin` strings, in English.
 *
 * Part of the message catalogue. The three locales must have the same
 * shape, which the `Messages` type enforces at build time.
 */
export const admin = {
  alerts: {
    title: "Alerts & Actions",
    subtitle: "Evidence, impact, owner and resolution history.",
    queue: "Action queue",
    severity: "Severity",
    observed: "Observed",
    baseline: "Baseline",
    confidence: "Confidence",
    owner: "Owner",
    due: "Due",
    status: "Status",
    resolve: "Resolve",
    snooze: "Snooze",
    acknowledge: "Acknowledge",
    rules: "Alert rules",
    newRule: "New rule",
    threshold: "Threshold",
    minVolume: "Minimum volume",
    quietPeriod: "Quiet period",
    hysteresis: "Hysteresis",

    // The standing explanation of why the queue stays quiet.
    whyQuietTitle: "Why alerts stay quiet",
    whyQuietBody:
      "A rule needs a minimum volume, a grace period while it learns its baseline, a hysteresis window before it auto-resolves, and a repeat interval before it fires again. Low-volume metrics and weekend dips therefore do not fill the queue with noise.",

    // The action queue.
    openAlertsOne: "1 open alert",
    openAlertsOther: "{count} open alerts",
    emptyTitle: "No alerts",
    emptyBody:
      "Alerts appear when a rule breaches its threshold. Create rules from the Rules tab once a source is connected.",
    alertsTable: "Alerts",
    columnAlert: "Alert",
    columnReason: "Reason",
    columnOpened: "Opened",

    // The task list.
    tasksTitle: "Tasks",
    tasksSubtitle:
      "Work items raised by rules, by the AI analyst, or by a person",
    tasksEmptyTitle: "No tasks",
    tasksEmptyBody:
      "Tasks are created from an alert, or proposed by the AI analyst for you to approve.",
    tasksTable: "Action items",
    columnTask: "Task",
    columnPriority: "Priority",

    // The rule list.
    rulesSubtitle: "Thresholds, minimum volume, hysteresis and quiet periods",
    rulesEmptyTitle: "No rules configured",
    rulesEmptyBody:
      "A rule needs a metric, a direction, a threshold and a minimum volume before it can fire.",
    rulesTable: "Alert rules",
    columnDirection: "Direction",
    columnEnabled: "Enabled",
    hysteresisWindows: "{count} windows",

    // The vocabulary CCM itself defines. The keys stay; the labels are
    // translated like any other copy.
    on: "On",
    off: "Off",
    severityInfo: "Info",
    severityWarning: "Warning",
    severityCritical: "Critical",
    statusOpen: "Open",
    statusAcknowledged: "Acknowledged",
    statusSnoozed: "Snoozed",
    statusResolved: "Resolved",
    taskStatusInProgress: "In progress",
    taskStatusDone: "Done",
    taskStatusCancelled: "Cancelled",
    priorityHigh: "High",
    priorityNormal: "Normal",
    priorityLow: "Low",
    sourceManual: "Manual",
    sourceRule: "Rule",
    sourceAnalyst: "AI analyst",
    directionIncrease: "Increase",
    directionDecrease: "Decrease",
  },
  reports: {
    title: "Reports & AI Analyst",
    subtitle: "Scheduled briefings and evidence-backed explanations.",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    siteReport: "Site report",
    adsReport: "Ads report",
    seoReport: "SEO report",
    socialReport: "Social report",
    connectionReport: "Connection health",
    emailDigest: "Email operations digest",
    exportCsv: "Export CSV",
    exportPdf: "Export / print",
    safeMode: "Share safe (privacy mode)",
    safeModeBody:
      "Masks customer, mailbox and sensitive account identifiers in the exported view.",
    ask: "Ask the AI analyst",
    askPlaceholder: "Ask about a change in your data…",
    sources: "Sources used",
    caveats: "Caveats",
    notGrounded:
      "This answer needs data CCM has not synced yet. Nothing has been inferred.",

    // The export notice.
    exportContainsTitle: "What an export contains",
    exportContainsBody:
      "Every export carries the same reviewed values as the screen, together with the data freshness, the metric definitions and the caveats that apply. “Share safe” mode masks customer, mailbox and sensitive account identifiers before anything leaves CCM.",
    generateDigest: "Generate the daily digest",

    // The scheduled digests.
    scheduledDigestsTitle: "Scheduled digests",
    scheduledDigestsSubtitle:
      "Built by the worker from the records that have been synced",
    noDigestScheduledTitle: "No digest is scheduled",
    noDigestScheduledBody:
      "A digest is the scheduled briefing that summarises what changed in your channels, campaigns and social accounts over a period. Ask the deployment owner to enable the digests for this workspace.",
    lastRun: "Last run",
    nextRun: "Next run",
    notScheduled: "Not scheduled",
    buildNow: "Build now",
    recentDigests: "Recent digests",
    digestQueuedTitle: "Digest queued",
    digestFailedTitle: "The digest could not be queued",
    digestQueued: "The digest has been queued.",
    digestFallback: "Digest",
    noDataAvailable: "No data was available for this period.",
    periodTo: "{start} to {end}",

    // The report catalogue.
    reportCatalogueTitle: "Report catalogue",
    reportCatalogueSubtitle: "Daily, weekly and monthly briefings",
    noDefinitionsTitle: "No report definitions",
    noDefinitionsBody:
      "Report definitions describe which sections a briefing contains and who receives it. They are created in Settings.",
    reportDefinitionsTable: "Report definitions",
    columnReport: "Report",
    columnCadence: "Cadence",
    columnFormats: "Formats",
    columnLastRun: "Last run",

    // The run history.
    recentRunsTitle: "Recent runs",
    recentRunsSubtitle: "Generated briefings",
    noRunsTitle: "No reports generated yet",
    noRunsBody: "A run appears here once a briefing has been generated.",
    reportRunsTable: "Report runs",
    columnPeriod: "Period",
    columnSafeMode: "Share safe",
    columnGenerated: "Generated",
    onDemand: "On demand",
    runStatusPending: "Pending",
    runStatusReady: "Ready",
    runStatusFailed: "Failed",

    // The analyst card.
    analystCardTitle: "AI analyst",
    analystCardSubtitle:
      "Grounded answers with an inspectable trail of sources",
    analystUnavailableBody:
      "The AI analyst is not available in this deployment. Ask the deployment owner to enable it. The figures in these reports come from the provider apps you connect in {link}.",

    on: "On",
    off: "Off",
    done: "Done.",
    serverUnreachable: "CCM could not reach the server.",
    requestFailed: "The request failed (HTTP {status}).",
  },
  integrations: {
    title: "Integrations",
    subtitle: "Connections, scopes, quotas and freshness.",
    catalogue: "Connection catalogue",
    scopes: "Scopes",
    apiVersion: "API version",
    lastSuccess: "Last success",
    lastFailure: "Last failure",
    quota: "Quota",
    nextRefresh: "Next refresh",
    setupChecklist: "Setup checklist",
    capabilityMatrix: "Capability matrix",
    changelog: "API version watchlist",

    honestStatusTitle: "Honest status",
    honestStatusBody:
      "A tile only says “Connected” when CCM holds a working API token for that account. Everything else shows what is missing, and the setup checklist below lists the approvals that are still outstanding.",

    connectionsTitle: "Connections",
    connectionsSubtitleOne: "1 configured",
    connectionsSubtitleOther: "{count} configured",
    noConnectionsTitle: "No providers connected",
    noConnectionsBody:
      "Connect Google Ads, GA4, Search Console, GTM, Gmail or a social account to start reporting.",
    connectionsTable: "Connections",
    columnConnection: "Connection",
    columnAccessLevel: "Access level",

    providerCatalogueTitle: "Provider catalogue",
    providerCatalogueSubtitle:
      "Every provider CCM knows about, and what it still needs",
    noProviderCatalogueTitle: "No providers in the catalogue",
    noProviderCatalogueBody:
      "CCM's provider registry is empty. Ask the deployment owner to install the provider catalogue.",
    providerCatalogueTable: "Provider catalogue",
    columnCategory: "Category",
    columnStillNeeded: "Still needed",
    columnDocs: "Docs",

    watchlistSubtitle: "Where a deprecation would bite, and how to find out",
    watchlistGoogleAds:
      "developer tokens were sunset on 9 September 2026. Access levels now live on the Google Cloud project (Test, Explorer, Basic, Standard). Basic and Standard require brand verification.",
    watchlistLinkedIn:
      "Marketing API versions are time-based and must be migrated on schedule. The pinned version lives in the provider registry, not scattered through the code.",
    watchlistGoogleApis:
      "the Analytics Data API, Search Console API, Tag Manager API v2 and Gmail API are versioned centrally in the provider registry.",

    // The quick-connect button.
    connectProvider: "Connect a provider",
    close: "Close",
    noAppConfiguredTitle: "No provider app is configured yet",
    noAppConfiguredBody:
      "A provider needs its own client id and client secret before it can be connected. Add them in {link}, then come back here.",
    providerAppsLink: "Settings — Provider apps",
    appNotConfigured: "App not configured",
    setItUp: "Set it up",

    // The provider taxonomy.
    categoryAdvertising: "Advertising",
    categoryAnalytics: "Analytics",
    categorySearch: "Search",
    categoryTagging: "Tagging",
    categorySocial: "Social",
    categoryEmail: "Email",
    categorySeo: "SEO",
    categoryUx: "UX",
    categorySite: "Site",

    serverUnreachable: "CCM could not reach the server.",
    requestFailed: "The request failed (HTTP {status}).",
  },
  audit: {
    title: "Audit & Security",
    subtitle: "Roles, permissions, retention and activity.",
    users: "Users",
    roles: "Roles",
    permissions: "Permissions",
    invite: "Invite a user",
    activity: "Activity log",
    retention: "Data retention",
    backups: "Backups",
    sessions: "Active sessions",
    mfa: "MFA / passkeys",

    leastPrivilegeTitle: "Least privilege by default",
    leastPrivilegeBody:
      "Access is granted by role at workspace level and, where a role is account-scoped such as {mailboxUser}, by an explicit grant on a single account. Row Level Security enforces this in the database, so a hidden navigation item is a convenience rather than the control.",

    membersTitle: "Members",
    membersSubtitle: "Everyone with access to this workspace",
    noMembersTitle: "No members",
    noMembersBody: "Members appear here once they are invited.",
    membersTable: "Workspace members",
    columnUser: "User",
    columnRole: "Role",
    columnInvited: "Invited",

    rolesAndPermissionsTitle: "Roles & permissions",
    rolesAndPermissionsSubtitle: "The matrix the database enforces",
    noRolesTitle: "No roles configured",
    noRolesBody:
      "The roles this workspace enforces appear here once they are installed. Ask the deployment owner to install them.",
    rolesTable: "Roles",
    severity: "Severity",
    columnAccountScoped: "Account scoped",
    perAccount: "Per account",
    workspaceWide: "Workspace wide",
    columnDescription: "Description",

    activitySubtitle: "Append-only record of sensitive actions",
    noActivityTitle: "No activity recorded yet",
    noActivityBody:
      "Launches, connection changes and permission changes are recorded here.",
    activityTable: "Audit events",
    columnAction: "Action",
    columnActor: "Actor",
    columnEntity: "Entity",
    columnTarget: "Target",
    columnWhen: "When",

    statusActive: "Active",
    statusInvited: "Invited",
    statusSuspended: "Suspended",
    severityInfo: "Info",
    severityWarning: "Warning",
    severityCritical: "Critical",
  },
  settings: {
    title: "Settings",
    subtitle: "People, permissions, data retention and the audit log.",

    leastPrivilegeTitle: "Least privilege by default",
    leastPrivilegeBody:
      "A role grants feature-level permissions across the workspace. A mailbox user additionally needs an explicit grant on the individual mailbox, so one person can read one mailbox without seeing the rest.",

    membersTitle: "Members",
    membersSubtitle: "{count} in this workspace",
    noMembersTitle: "No members yet",
    noMembersBody:
      "Members appear here once they have been invited. Invite people from People & roles.",
    membersTable: "Workspace members",
    columnUser: "User",
    columnRole: "Role",
    columnInvited: "Invited",

    accountGrantsTitle: "Account grants",
    accountGrantsSubtitle: "Who may read which individual account",
    noAccountGrantsTitle: "No account grants",
    noAccountGrants:
      "Members with a workspace-wide role reach every account already, so no per-account grant is needed.",
    accountGrantsTable: "Account grants",
    columnAccount: "Account",
    columnPermission: "Permission",

    retentionTitle: "Data retention",
    retentionSubtitle: "How long each kind of record is kept",
    retentionFactsLabel: "Daily metric facts",
    retentionFactsValue: "25 months",
    retentionFactsNote: "Set in the retention settings.",
    retentionSyncLabel: "Sync runs and errors",
    retentionSyncValue: "90 days",
    retentionSyncNote: "Pruned by the retention job.",
    retentionLaunchLabel: "Launch events",
    retentionLaunchValue: "12 months",
    retentionLaunchNote: "Evidence of account launches.",
    retentionAuditLabel: "Audit events",
    retentionAuditValue: "24 months",
    retentionAuditNote:
      "A compliance decision — review before shortening.",
    retentionMailboxLabel: "Mailbox metadata",
    retentionMailboxValue: "12 months",
    retentionMailboxNote:
      "Per mailbox. Bodies and attachments are never stored.",
    retentionTicketLabel: "Launch tickets",
    retentionTicketValue: "60 seconds",
    retentionTicketNote:
      "Fixed by design: a ticket is a momentary permission.",
    retentionCredentialsLabel: "Provider credentials",
    retentionCredentialsValue: "Until disconnect",
    retentionCredentialsNote:
      "Deleted when the account is disconnected.",

    preferencesTitle: "Your preferences",
    preferencesSubtitle: "Interface language, timezone and export masking",
    noPreferencesTitle: "No preferences saved",
    noPreferencesBody:
      "Each person's language, timezone and export defaults appear here once they save their own preferences.",
    preferencesTable: "Preferences",
    columnLanguage: "Language",
    columnDefaultPeriod: "Default period",
    columnShareSafe: "Share safe",

    on: "On",
    off: "Off",
    statusActive: "Active",
    statusInvited: "Invited",
    statusSuspended: "Suspended",

    integrations: {
      secretNote:
        "The secret is encrypted before it is stored and is never shown again. Leave the field blank to keep the stored one.",
      setUpApp: "Set up the app",
      check: "Check",
      title: "Provider apps",
      subtitle:
        "Add the client id and secret of each provider's app, then connect it.",
      replacesTitle: "What this replaces",
      replacesBody:
        "These values used to live in the deployment environment, so connecting a provider meant editing a file and redeploying. They are stored here instead, encrypted, and the Connect button works as soon as the form is saved.",
      appsTitle: "Apps",
      appsSubtitle:
        "One app per provider. Google covers Analytics, Search Console, Tag Manager, Ads, YouTube and Gmail.",
    },

    /**
     * The database repair panel.
     *
     * It lives on the setup screen, which is where an operator finds it
     * when the authorisation layer is missing.
     */
    database: {
      title: "Database",
      checking: "Checking the authorisation layer",
      checkingRls:
        "Checking whether Row Level Security is installed…",
      authorisationLayer: "Authorisation layer",
      layerReady:
        "Row Level Security is installed and the permission matrix is in place. Every query is scoped by the database.",
      layerMissing:
        "The RLS helper functions are not visible to PostgREST. Either a migration aborted before creating them, or the schema cache has not been reloaded.",
      layerNotFound: "The authorisation layer could not be found.",
      notConfigured:
        "Supabase is not configured, so the database could not be checked.",
      checkFailed: "The database check could not run.",
      checkFailedWithDetail:
        "The authorisation check could not run: {detail}",
      checkReturned: "The authorisation check returned {status}.",
      repairTitle: "Database repair required",
      repairSubtitle:
        "Row Level Security is not installed, so every user sees an empty product",
      applyRepair: "Apply the repair",
      repairBody:
        "The repair file rebuilds the helper functions, every policy and the seed data, and tells PostgREST to reload its schema cache. It is idempotent.",
      stepOne: "Open the project's {editor} in the Supabase dashboard.",
      stepTwo: "Open {file} in this repository and paste its contents.",
      stepThree: "Run it, then reload this page.",
      terminalLead:
        "From a terminal with the project linked, the same repair is:",
      recheck: "Re-check",
    },
  },
  people: {
    title: "People & roles",
    subtitle:
      "Who is in the workspace, and how far into each tab they may go.",
    howAccessWorksTitle: "How access works",
    howAccessWorksBody:
      "A role says how far into a tab it may go: {view} to read it, {use} for its actions, and {edit} to change its configuration. Those levels are derived into the feature permissions the database enforces, so what you see here is what the Row Level Security policies will actually allow.",

    peopleTitle: "People",
    peopleSubtitle: "Everybody in this workspace, and what they may do",
    addPerson: "Add a person",
    workEmail: "Work email",
    role: "Role",
    create: "Create",
    passwordHint:
      "A password is generated and shown once. The person signs in with it and can be given a new one at any time.",
    emptyTitle: "Nobody here yet",
    emptyBody: "Add the first person and give them a role.",
    you: "(you)",
    joined: "Joined",
    restore: "Restore",
    suspend: "Suspend",
    statusActive: "Active",
    statusInvited: "Invited",
    statusSuspended: "Suspended",
    roleOf: "The role of {name}",
    thisPerson: "this person",

    rolesTitle: "Roles",
    rolesSubtitle: "What each role may see, use and change",
    ownerAccessTitle: "The owner's access is fixed",
    ownerAccessBody:
      "The owner holds every permission and cannot be reduced. A workspace with no administrator cannot be administered.",
    matrixCaption: "The access level of the {role} role on each tab",
    tabColumn: "Tab",
    levelNone: "No access",
    levelView: "View",
    levelUse: "Use",
    levelEdit: "Edit",
    ownerOnly: "Owner only",
    saveRole: "Save the {role} role",
    noChangesToSave: "No changes to save yet.",
    discard: "Discard the changes",
    derivedPermissions:
      "{count} permission(s) are derived from these levels: {permissions}.",
    noPermissions: "none",

    // The notices.
    doneTitle: "Done",
    errorTitle: "That did not work",
    passwordTitle: "Save this password now",
    passwordBody:
      "can sign in with the password below, as {role}. It is shown once and is not stored anywhere.",

    // The failures.
    membersReadFailed: "The people could not be read.",
    rolesReadFailed: "The roles could not be read.",
    tabMapMissing:
      "The tab map is not installed yet. Apply supabase/repair.sql — it creates the role_tab_access table and seeds the levels for every role.",
    repairRequired:
      "The database is missing a table this screen needs. Apply supabase/repair.sql.",
    serverUnreachable: "CCM could not reach the server.",
    requestFailed: "The request failed (HTTP {status}).",
    roleSaved: "The {role} role now holds {count} permission(s).",
    updated: "Updated.",

    /**
     * The role labels.
     *
     * The role *keys* stay in English; the labels a person reads are
     * translated. The same eight labels are shown on the audit, settings
     * and people screens, so they live in one place.
     */
    roleLabels: {
      owner: "Owner",
      admin: "Administrator",
      marketing_analyst: "Marketing Analyst",
      seo: "SEO",
      ads_manager: "Ads Manager",
      social_manager: "Social Manager",
      mailbox_user: "Mailbox User",
      read_only: "Read-only",
    },
  },
  search: {
    title: "Search",
    subtitleAll: "Everything your roles give you access to",
    resultsFor: "Results for “{query}”",

    accountsTitle: "Accounts",
    resultsOne: "1 result",
    resultsOther: "{count} results",
    noAccountsTitle: "No accounts match",
    noAccountsBody: "Try a different term, or browse the Account Launcher.",
    accountsTable: "Account search results",

    websitesTitle: "Websites",
    noWebsitesTitle: "No websites match",
    noWebsitesBody: "Try a different term.",
    websitesTable: "Website search results",
    columnSite: "Site",
    columnDomain: "Domain",
    columnServices: "Services",
  },
} as const;
