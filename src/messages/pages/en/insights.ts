/**
 * The `pages.insights` strings, in English.
 *
 * Part of the message catalogue. The three locales must have the same
 * shape, which the `Messages` type enforces at build time.
 */
export const insights = {
  ux: {
    title: "Heatmaps & UX",
    subtitle: "Behaviour signals and friction points.",
    recordings: "Recordings",
    heatmaps: "Heatmaps",
    scrollDepth: "Scroll depth",
    rageClicks: "Rage clicks",
    deadClicks: "Dead clicks",
    errors: "Page errors",
    notice:
      "CCM links to the native Clarity project for replay and heatmaps. It does not store session recordings, form fields or page text.",
    storageNoticeTitle: "What CCM stores",
    storageNoticeBody:
      "CCM holds the Clarity connection and links to the native project for replay and heatmaps. No behaviour metric has been read from Clarity: there is no Clarity sync in this release, and no session recording, heatmap, form field, page text or private identifier is stored. Playback happens in Clarity, under the provider's own privacy and masking controls.",
    connectionsReadError: "The Clarity connections could not be read: {message}",
    projectsReadError: "The Clarity projects could not be read: {message}",
    connectionTile: "Connection",
    lastSyncTile: "Last sync",
    syncStateTile: "Sync state",
    projectsTile: "Projects",
    notConnected: "Not connected",
    connectionStatusDetail:
      "Status of the Clarity connection “{label}”: {status}.",
    noConnectionDetail:
      "CCM holds no Clarity connection for this workspace.",
    connectionsNotVisibleDetail:
      "Reading provider connections needs the Integrations permission, so this role cannot see whether Clarity is connected.",
    unknownAgeDetail:
      "The recorded sync time could not be read, so its age is unknown.",
    neverSyncedDetail:
      "No Clarity sync has ever succeeded, so there is no last sync to show.",
    lastSyncDetail:
      "The last successful Clarity sync. The target is one a day.",
    freshnessFresh: "Up to date",
    freshnessAging: "Refresh overdue",
    freshnessStale: "Data is stale",
    freshnessFailing: "Sync failing",
    neverSynced: "Never synced",
    freshnessDetailNever: "Not connected — no data yet",
    freshnessDetailFailingNoRun: "Sync failing — no successful run yet",
    freshnessDetailLastGood: "Last sync failed — showing last good data",
    projectsDetail:
      "Clarity projects linked in the account catalogue. Recordings and heatmaps stay in Clarity.",
    projectsUnknownDetail:
      "Reading the account catalogue needs the Integrations permission, so the number of Clarity projects is unknown.",
    connectionsCardTitle: "Clarity connections",
    connectionsCardSubtitle:
      "The connection state and the link to the native project",
    notVisibleTitle: "Clarity connections are not visible to this role",
    notVisibleDescription:
      "Reading provider connections needs the Integrations permission. Ask an administrator for it to see whether Clarity is connected.",
    noConnectionTitle: "No Clarity connection",
    noConnectionDescription:
      "Connect a Microsoft Clarity project to link the native replay and heatmaps. CCM keeps the connection and its sync state; it stores no recordings and reads no behaviour metrics yet.",
    lastSyncOn: "Last sync {date}",
    clarityProject: "Clarity project {ids}",
    noClarityProject: "No Clarity project linked",
    openClarity: "Open Clarity",
  },
  social: {
    title: "Social Media",
    subtitle: "Accounts, content performance and publishing.",
    accounts: "Accounts",
    followers: "Followers",
    reach: "Reach",
    impressions: "Impressions",
    engagements: "Engagements",
    engagementRate: "Engagement rate",
    posts: "Posts",
    topContent: "Top content",
    decliningContent: "Declining content",
    organic: "Organic",
    paid: "Paid",
    notice:
      "Organic profile analytics and paid social ads are separate categories with separate sources. They are never combined into one number.",
    organicPaidNoticeTitle: "Organic and paid are separate",
    organicPaidNoticeBody:
      "Organic profile analytics and paid social campaign results come from different surfaces with different permissions. They are shown as separate categories and are never combined into a single number.",
    connectedAccountsTitle: "Connected accounts",
    connectedAccountsSubtitle: "Identities, permissions and data freshness",
    noAccountsTitle: "No social accounts connected",
    noAccountsDescription:
      "Connect Instagram, Meta, LinkedIn or YouTube. Medical Bay's public site links Instagram (medicalbay.maroc), Facebook, LinkedIn (medical-bay-agadir) and TikTok.",
    accountsTableLabel: "Social accounts",
    accountsReadError: "The connected accounts could not be read.",
    metricsReadError: "Could not read social account metrics: {message}",
    postsReadError: "Could not read social post metrics: {message}",
    engagementRateOfReach: "Engagement rate {rate} of reach",
    acrossConnectedAccounts: "Across the connected accounts",
    noSocialDataYet: "No social data synced yet",
    contentPerformanceTitle: "Recent posts",
    contentPerformanceSubtitle:
      "Posts published in the selected period, newest first.",
    noPostMetricsTitle: "No post metrics",
    noPostMetricsDescription:
      "Post-level performance appears once a social account reports.",
    postsTableLabel: "Social posts",
    platformColumn: "Platform",
    formatColumn: "Format",
    postedColumn: "Published",
    linkColumn: "Link",
  },
  inbox: {
    title: "Unified Email",
    subtitle: "Authorised mailboxes, threads and follow-ups.",
    inbox: "Inbox",
    unread: "Unread",
    sent: "Sent",
    drafts: "Drafts",
    archive: "Archive",
    threads: "Threads",
    attachments: "Attachments",
    reply: "Reply",
    replyAll: "Reply all",
    forward: "Forward",
    compose: "Compose",
    send: "Send",
    markRead: "Mark as read",
    markUnread: "Mark as unread",
    star: "Star",
    mailbox: "Mailbox",
    sendingAs: "Sending as",
    confirmSendTitle: "Send this message?",
    confirmSendBody:
      "Confirm the recipient and the sending identity. This action is recorded in the audit log.",
    aiNotice:
      "AI summaries and task extraction are off for this mailbox. Message bodies and attachments are never sent to an external model without explicit approval.",
    starred: "Starred",
    mailboxPrivacyNoticeTitle: "Mailbox privacy",
    mailboxPrivacyNoticeBody:
      "Mailbox content is isolated from the rest of CCM and is protected by its own permission set and row-level policies. Message bodies and attachments are read from the provider when you open a message and are never stored here. AI summarisation is opt-in per mailbox — it is off until someone explicitly enables it. Sending always takes a confirmation that shows the recipient and the sending identity, and every send is recorded in the audit log.",
    mailboxesCardTitle: "Mailboxes",
    mailboxesCardSubtitle: "Every account you are authorised to read",
    noMailboxTitle: "No mailbox connected",
    noMailboxDescription:
      "medicalbay.ma runs on Google Workspace. Connect a mailbox with the Gmail API to bring the inbox into CCM.",
    mailboxesTableLabel: "Mailboxes",
    addressColumn: "Address",
    aiProcessingColumn: "AI processing",
    enabled: "Enabled",
    off: "Off",
    messagesCardTitle: "Messages",
    messagesCardSubtitle:
      "Search, page and read. Bodies are fetched on demand and never stored.",
    noConnectedMailboxTitle: "No connected mailbox to read",
    noConnectedMailboxDescription:
      "The mailbox browser opens once a Gmail mailbox is connected. The list above shows what is connected and what still needs setup.",
    messageSentTitle: "Message sent",
    sentNotice: "Sent to {to} — “{subject}”.",
    requestFailedTitle: "The mailbox request failed",
    requestFailed: "The request failed (HTTP {status}).",
    sendFailed: "The send failed (HTTP {status}).",
    serverUnreachable: "CCM could not reach the server.",
    noMailboxClientDescription:
      "Connect a mailbox with the Gmail API in Integrations to bring the inbox into CCM.",
    searchPlaceholder: "from:, subject:, is:unread, or a term",
    sectionsLabel: "Mailbox sections",
    noSubject: "(no subject)",
    nothingHereTitle: "Nothing here",
    noSearchMatchDescription: "No message matched that search.",
    sectionEmptyDescription: "This mailbox section is empty.",
    pageNumber: "Page {page}",
    totalEstimate: "· about {count} in total",
    newMessage: "New message",
    confirmBeforeSendingTitle: "Confirm before sending",
    confirmSendSummary:
      "This will send from {from} ({label}) to {to}{cc}, with the subject {subject}.",
    confirmSendCc: ", cc {cc}",
    draftExpiry:
      "A draft has been saved in the mailbox. It expires in {seconds} seconds if it is not confirmed.",
    confirmAndSend: "Confirm and send",
    editInstead: "Edit instead",
    to: "To",
    cc: "Cc",
    optional: "Optional",
    subject: "Subject",
    message: "Message",
    prepareToSend: "Prepare to send",
    closeThread: "Close the thread",
    nothingToReadTitle: "Nothing to read",
    nothingToReadDescription:
      "The provider returned no messages for this thread.",
    unknownSender: "Unknown sender",
    removeStar: "Remove the star",
    starMessage: "Star this message",
    starFailed:
      "The star could not be saved (HTTP {status}). The message was left unchanged.",
    bodyUnreadable: "The body could not be read from the provider.",
    hasAttachments: "Has attachments",
    selectConversationTitle: "Select a conversation",
    selectConversationDescription:
      "Choose a message on the left to read it, or search the mailbox.",
  },
  launcher: {
    accountSummary: "Account launch summary",
    totalAccounts: "Accounts available",
    readyAccounts: "Browser profile ready",
    attentionAccounts: "Need attention",
    accountsLoadErrorTitle: "Accounts could not be loaded",
    accountsLoadErrorBody:
      "Your account list is temporarily unavailable. Reload this page to try again.",
    reloadAccounts: "Reload accounts",
    clearFilters: "Clear filters",
    connectAccount: "Connect an account",
    launcherEmptyTitle: "No accounts yet",
    launcherEmptyBody:
      "Add a saved provider sign-in above, or connect a provider to create an API-connected account.",
    howItWorksTitle: "How this works",
    howItWorksBody:
      "A valid API connection does not prove a browser session exists. CCM opens the exact destination for each account; the provider decides whether your session is still signed in, and may ask you to complete sign-in, MFA or a CAPTCHA. Saved sign-ins are optional and encrypted. After you choose Open and sign in, the paired browser bridge submits them only to the provider's visible login form.",
    connectedAccountsTitle: "Connected accounts",
    connectedAccountsSubtitle:
      "Every account CCM can open, with its API and browser state.",
    setupSubtitle:
      "Map each account to the browser profile that holds its provider session.",
    boundariesTitle: "What this does and does not do",
    boundariesBody:
      "A hosted page cannot read another site's cookies or force a different browser profile to open. What it can do — and what this wizard configures — is open the exact account destination in the browser you are using, and, with the bridge extension installed, open it in the profile where the extension lives. A provider session may still have expired; CCM shows that plainly and lets you sign in normally.",
    step1Title: "Step 1 — install the browser bridge",
    step1Subtitle:
      "Optional, but it adds verified launches and profile mapping",
    checkingExtension: "Checking for the extension…",
    extensionInstalled:
      "The browser bridge is installed in this browser profile.",
    extensionNotDetectedTitle: "Extension not detected",
    loadExtensionBody:
      "Load the unpacked extension from {bridgePath} in {extensionsUrl}, open its options page and enter this CCM origin. Account launching still works without it — the tab simply opens in the current profile.",
    instanceIdLabel: "This profile's instance id",
    step2Title: "Step 2 — map a browser profile",
    step2Subtitle:
      "Tie an account to the profile that holds its provider session",
    noAccountsTitle: "No accounts yet",
    noAccountsBody:
      "Add a saved login from Account Launcher, or connect a provider in Integrations, then map the account to a browser profile.",
    accountLabel: "Account",
    noManagementConsole:
      "This provider has no management console to open.",
    multiProfileTitle: "Multiple browser profiles",
    multiProfileSubtitle: "What is and is not possible",
    multiProfileBody:
      "A normal web page cannot force Chrome, Edge or Firefox to open a different profile. The bridge extension can, because it opens the tab in the profile where it is installed — so the reliable workflow for a second identity is to install the extension in that profile and map the account to that instance id.",
    multiProfileHelperBody:
      "The optional local helper exists for the case where the account lives in a profile you cannot install the extension into. It is explicitly installed and paired by you, it only accepts allow-listed hosts and configured profile directories, and it never reads, exports or modifies cookies or saved sign-ins.",
    helperTitle: "The local helper",
    helperSubtitle:
      "For a profile the extension cannot be installed in",
    helperIntro:
      "The helper is a small program that runs on your own machine. It opens the account in a named browser profile — the one case a web page and the extension both cannot cover.",
    helperRunCommand: "Run it from the repository: {command}",
    pairingCode: "pairing code",
    helperPairBody:
      "Pair it with this deployment. The helper prints a {code} on its own console when it starts; that code is required, so no other page can re-point the helper at a site of its choosing: {command}",
    helperChooseBody:
      "Choose {mode} as the launch mode above and name the browser profile directory — the one shown in {version}, for example {example} or {fallback}.",
    helperWarning:
      "The helper accepts only a signed launch ticket, checks the destination against the provider allowlist, and opens the browser with the browser's own cookie store. It never reads cookies, passwords or MFA codes.",
    instanceIdLabelField: "Extension instance id",
    instanceIdHint:
      "Paste the id from the extension's options page, or use the button above.",
    useDetectedInstance: "Use this browser profile's instance id",
    profileLabelLabel: "Profile label",
    profileLabelHint:
      "How this profile appears to your team, e.g. “Chrome — Work”.",
    profileDirectoryLabel: "Profile directory",
    profileDirectoryHint:
      "The Chrome/Edge profile directory (for example “Profile 1”). Only used by the optional local helper; leave blank for a direct launch.",
    launchModeLabel: "Launch mode",
    launchModeHint: "How the account should be opened.",
    modeDirect: "Direct — open a tab in this browser",
    modeExtension:
      "Extension — open in the profile where the bridge is installed",
    modeHelper: "Local helper — open in a specific browser profile",
    modeHelperShort: "Local helper",
    saveMapping: "Save mapping",
    mappingSaved: "Mapping saved. The account tile now shows this profile.",
    mappingSaveFailed: "The mapping could not be saved (HTTP {status}).",
    serverUnreachable:
      "CCM could not reach the server to save the mapping.",
    credentialsAddLabel: "Add secure sign-in",
    credentialsSavedLabel: "Secure sign-in saved",
    credentialsPrivacy:
      "Encrypted before storage. The paired browser bridge sends them only to an allowlisted provider login form after you choose Open and sign in. MFA and CAPTCHA remain with the provider.",
    credentialsChecking: "Checking saved sign-in…",
    credentialsCheckFailed: "Could not check saved sign-in details.",
    credentialsSaveFailed: "Could not save the sign-in details.",
    loginUsername: "Username or email",
    loginPassword: "Password",
    passwordReplaceHint: "Enter a new password to replace the saved one.",
    saveLogin: "Save sign-in securely",
    removeLogin: "Remove saved sign-in",
    credentialsSaved: "Sign-in details saved securely.",
    credentialsRemoved: "Saved sign-in removed.",
    credentialsManagedByAdmin: "Ask an integrations manager to update these details.",
    credentialsAskAdmin: "Ask an integrations manager to add sign-in details.",
    openAndFill: "Open account and sign in",
    credentialsExtensionRequired:
      "Install and pair the CCM browser bridge in this browser to fill saved details. You can still open the account and sign in normally.",
    credentialsHelperProfile:
      "Saved sign-in fill works in the paired browser profile. Map this account to the browser bridge profile to use it.",
    addLoginAccount: "Add saved login",
    addLoginAccountTitle: "Add a provider login",
    addLoginAccountSubtitle:
      "Create a browser-only account. Your API integrations and reporting data stay separate.",
    loginProvider: "Provider",
    loginAccountLabel: "Account name",
    loginAccountPrivacy:
      "Your password is encrypted before storage. Autofill runs only after you choose it in the browser bridge. The provider may still ask for MFA or a CAPTCHA.",
    saveLoginAccount: "Save and add account",
    savingLoginAccount: "Saving securely…",
    loginAccountCreated: "Saved login added. You can open it from the account list below.",
    loginAccountCreateFailed: "Could not add this saved login.",
    browserOnly: "Browser login only",
    launchPermissionRequired: "You can view this account, but your role cannot launch it.",
  },
} as const;
