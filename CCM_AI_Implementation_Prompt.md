# CCM — Command Center Management
## Production implementation brief for the coding agent

**Current working name:** `CCM` (Command Center Management). Keep the final product name open for a later branding decision.

**Deployment starting point:** Vercel + Supabase. Architect for a future Docker/VPS deployment without rebuilding the product.

**Design source:** use the `design.md` supplied by the project owner as the source of truth. Its “Medicalbay Calm Care” design language is mandatory: primary teal `#4bbdbd`, lighter teal `#6ccaca` and `#8ad6d6`, white surfaces, `#f7f8f9` muted surfaces, `#e5e7eb` borders, `#4b4f58` body text, `#3a3a3a` strong text, `#d9534f` error state, Heebo typography, generous whitespace, 7–8 px card/control corners, restrained shadow, clear accessibility, and a calm medical-hospitality feel. Do not turn this into a generic dark-mode hacker dashboard or an overdone glassmorphism template.

---

# 1. Your mission

Build a real, secure, production-grade digital marketing and business operations command center for **Medical Bay / Medicalbay**, an Agadir, Morocco medical-tourism coordination business. The product's internal working title is **CCM — Command Center Management**.

CCM must consolidate authorized data from every supported website, advertising account, analytics property, search/SEO source, social account, and mailbox into one coherent interface. This must be a full-stack application with a real database, authentication, authorization, background synchronization, error handling, audit trail, account launcher, responsive frontend, tests, and deployment documentation—not a static UI mockup.

The most important user requirement is the **connected-account launcher**: when a user clicks a connected Instagram, LinkedIn, Facebook, Google Ads, GA4, Search Console, YouTube, Gmail, or other supported account, CCM should open that precise account or management destination in the browser profile where the user has authenticated, so the platform reuses its existing login session whenever that session is still valid. This must be engineered, implemented and tested; a grid of decorative external links does not satisfy the requirement.

Be honest about the boundary: an ordinary hosted webpage cannot read or refresh another website's cookies, cannot guarantee that third-party sessions never expire, and must not collect external passwords, cookies, MFA codes, or bypass provider controls. Build the correct browser-launch/session-bridge design described in Section 5. Use official OAuth/API authorizations for background data separately from browser website sessions.

# 2. Work protocol — inspect first, then build

Do this in the repository in which the prompt is being run.

1. Inspect the repository, branch, working tree, package scripts, existing application architecture, deployment settings, database migrations, auth flows, installed skills, MCP servers, and available test tooling before choosing an implementation plan. Read all relevant `AGENTS.md`, README, architecture, and environment examples.
2. Run safe baseline checks (for example `git status`, package-manager/version checks, lint/typecheck/test/build where available). Record the current state and any existing failures. Do not overwrite work that was already in progress.
3. Search the repository for reusable functionality before adding new code. Reuse sound code patterns, but do not preserve broken architecture just because it exists.
4. Produce a concise implementation plan, risk register, connector capability matrix, and list of blocking account/API approvals. Then begin implementing the highest-value end-to-end vertical slice. Do not stop after writing a plan or a dashboard mockup.
5. Preserve existing working code and features. **Do not permanently delete old features, files, tables, or workflows.** If something must be superseded, move it into an appropriately documented `/archive/` structure with provenance and a migration note. Never run destructive Git commands such as `git reset --hard`, `git clean -fd`, or broad recursive deletion. Preserve untracked work and local changes.
6. Do not commit, push, merge, publish, alter production databases, or deploy without explicit permission from the owner. Build locally and prepare deploy-ready configuration; do not silently publish. Do not mutate real ad campaigns or publish GTM containers in the initial phases.
7. Keep working toward a functioning result. When a live integration is blocked by credentials, account permissions, approval, quota or OAuth verification, finish its adapter, schema, contract tests and setup checklist, mark it honestly as `Needs setup` and continue with unblocked work. Never fabricate live metrics to hide a missing connection.
8. Keep implementation and documentation aligned. If you change architecture, schema, environment variables, roles, or launch behavior, update the respective docs and tests in the same change set.

# 3. Research requirements and Medical Bay business context

Before implementing provider-specific behavior, verify the latest official provider documentation and API versions at the time of work. Do not rely on stale examples, search snippets, outdated NPM packages, or assumptions based on another product.

Start with the public Medical Bay website and review its actual structure, current pages, language versions, forms, existing tags, link destinations, robots/sitemap, canonical metadata, and accessible public social links:

- Main website: https://www.medicalbay.ma/
- English home: https://www.medicalbay.ma/en/home/
- English about: https://www.medicalbay.ma/en/about-us/
- Cosmetic dentistry: https://www.medicalbay.ma/dentisterie-esthetique-agadir/
- Hair transplantation: https://www.medicalbay.ma/greffe-de-cheveux-agadir/

Public pages currently position Medical Bay as a medical-tourism coordinator in Agadir, Morocco; the site offers cosmetic dentistry, hair-transplantation services, and medical-tourism assistance. Public navigation includes French, English, and Arabic. Use this as a starting point, not as a substitute for checking the live site. The business journey includes initial inquiry, quotation/contact, treatment/service inquiry, trip logistics and follow-up; CCM is a marketing/website command center, **not an electronic health record, patient-management system, or clinical decision tool**.

Medical Bay site review should inform:

- Website/site inventory and page-level reporting by locale and service/landing-page cluster.
- Marketing event taxonomy such as `quote_request_submitted`, `contact_form_submitted`, `whatsapp_click`, `phone_click`, `newsletter_signup`, and other events confirmed by the actual site implementation.
- Campaign/landing-page reporting by page language (`fr`, `en`, `ar`), service line (for example dentistry, hair transplantation, medical tourism), source/medium/campaign, country, device and conversion type.
- Site health, conversion-path, page-speed, mobile UX, technical SEO, search intent and local search monitoring for Agadir and Morocco.
- Secure monitoring of form/lead conversion totals without sending names, email addresses, phone numbers, free-text patient questions, health details or other personal data to GA4, Google Ads, third-party analytics, URLs, UTM parameters or AI prompts.

Medical Bay works in a sensitive health-related context. **Do not ingest clinical records or build patient treatment records.** Avoid patient-level medical data in marketing analytics. The unified mailbox may contain sensitive messages; use least-privilege access, minimize stored copies, isolate mailbox data, and do not send email bodies/attachments to external AI services by default. Before any personal-data transfer or AI processing, document the data flow and require the owner's explicit approval and a privacy/compliance review. Assess Morocco's Law 09-08/CNDP obligations and applicable destination-country privacy rules with qualified counsel; do not make unsupported claims of compliance.

# 4. Product scope and navigation

Design a consistent application shell, with global search, date range and comparison selector, workspace/site/account context, notification center, user/role menu, sync status, accessible navigation, and a responsive layout. Each menu item must navigate to a useful, functioning workspace and must have real loading, error, permission-denied, empty, and populated states.

## 4.1 Executive Command Center

- Portfolio overview across all connected sites/accounts.
- KPI cards: ad spend, tracked conversions, qualified-lead totals if a CRM source is explicitly connected, cost per conversion, conversion value/ROAS where valid, GA4 sessions, Search Console organic clicks/impressions, keyword movements, social reach/engagement, site-health and mailbox follow-ups.
- Period-over-period comparisons; allow 7/28/90 days and custom ranges where each provider supports them. Keep timezone and currency visible and consistent.
- Cross-channel trend charts; top movers; top pages/campaigns/keywords/posts; integration freshness; failed syncs; urgent alerts; recommended actions.
- Explain metric definitions, source, timestamp, sample size and coverage. Mark unavailable metrics as unavailable rather than zero.

## 4.2 Websites portfolio and per-site workspace

- Portfolio list with domain, brand/website label, language set, assigned owner, services/categories, health state, source connectors, last-sync status and actions.
- Per-site overview, pages/landing pages, traffic, attribution, conversion funnel, paid campaign performance, organic search, rankings, technical SEO, Core Web Vitals, heatmaps/replay links, tracking verification, uptime/SSL/DNS, alerts, historical changes and downloadable reports.
- Site/page list should support filters, sorting, search, grouping by language/service/landing-page class, and direct open in a new tab.
- Include a site registry so adding a future Medical Bay microsite or another authorized business website does not require schema rewrites.

## 4.3 Google Ads

Use the current Google Ads API and official authorization model. As of the October 2026 documentation, Google changed normal Ads API onboarding in September 2026; verify the current Google Cloud project access workflow and do not follow old tutorials that assume a newly created developer token is still the normal path.

Report account/campaign/ad group/ad/keyword/search-term metrics supported by the API: impressions, clicks, CTR, cost, average CPC, conversions, conversion value, CPA, ROAS and budgets/pacing. Include campaigns eligible for the connected account, date comparisons, device/geography/network segments where supported, asset/ad policy statuses where available, and change history if supported. Distinguish Search, Display, Video, Performance Max, and other types where the source exposes them.

- Use correct currency micros conversions and account timezone; do not combine accounts with different currencies without conversion-rate/source metadata.
- Explain attribution window, conversion-action definitions, and any modeling/reporting limitations.
- Alert on spend spikes, budget pacing, conversion drops and tagging gaps using configurable baselines, minimum volume and hysteresis to reduce noisy alerts.
- Initial release is read-only. All campaign edits, budget changes, pauses, bulk changes, and other write operations must remain disabled or require explicit permission, preview, confirmation and audit logging.

## 4.4 GA4 analytics and attribution

Use Google Analytics Data API for supported reports and the Admin API only where appropriate/available. Include sessions, active users, new users, traffic source/medium, campaign, landing page, geography, device, engagement, event counts, conversions/key events, revenue where actually configured, funnel steps, and content-page performance. Keep event/metric definitions source-backed.

- Show which property, stream, report, event definition, period, sampling/data threshold caveat and freshness apply.
- Avoid client-side secrets and direct Google API requests from the browser.
- Compare Ads conversions with GA4 key events only when definitions, dates, attribution and timezones are comparable; flag discrepancies, do not silently reconcile them.
- Do not pass personal data or treatment details as event names or parameters.

## 4.5 Search Console and SEO

Use the official Search Console API for actual GSC clicks, impressions, CTR and average position by date/query/page/country/device/search type, sitemaps and available inspection information. Document the GSC API's row/aggregation limits; do not claim the query endpoint returns every row. Preserve Google data separately from external rank estimates.

SEO suite:

- Rank tracking by keyword, country/region/city where supported, device, language, search engine, landing URL and observation date.
- Morocco-wide and Agadir-focused keyword lists, French and Arabic variants, service-line grouping, branded/non-branded separation, competitor sets and ranking history.
- Backlinks/referring domains, domain/page metrics, keyword opportunities, SERP features, content decay and potential cannibalization where the licensed provider offers the data.
- Technical crawler: titles, descriptions, headings, canonical/hreflang, indexability/robots, redirects, broken links, sitemap coverage, structured data, image alt, duplicates and internal links.
- Content opportunity/refresh queue sorted by potential business impact, current evidence and effort; preserve the source/URL/evidence for each recommendation.
- AI/GEO/AEO/AIO visibility is a separate provider-backed module: track supported mentions, cited URLs, prompts/share-of-voice and change history only when actual sources provide those observations. Never invent AI rankings.

Provider selection: inspect the owner's connected accounts/available entitlements and budget, then choose **one primary rank-tracking provider** initially (Ahrefs or SE Ranking are candidates); keep a narrow adapter interface to add another provider later. Distinguish provider-estimated traffic, third-party rank observations and exact GSC data.

## 4.6 Google Tag Manager and tracking health

Use the official GTM API to inventory authorized accounts, containers, workspaces, tags, triggers, variables, folders, environments, container versions and permissions as supported. Add a tracking plan/checklist for important events, duplicate or missing tag checks, expected GA4 Measurement ID / Ads conversion action references where authorized, and verification timestamps.

Do not publish GTM changes automatically. Any workspace modification or container publication must be previewed, approved by an authorized user, recorded in an audit log, and reversible where the provider's API allows it. Store a before/after version reference and show who approved the action.

## 4.7 Heatmaps, recordings and UX

- Integrate Microsoft Clarity's documented export/API capabilities for supported aggregate metrics and snapshots; check current quota, date window, available fields and plan constraints during implementation.
- Show links to the relevant native Clarity project, recording, heatmap or page where a deep link is available. Do not promise that CCM contains a complete recording viewer unless the official provider surface actually makes this available.
- Optionally support PostHog as an additional owned product-analytics/heatmap/replay source only after checking data-region, budget and legal requirements.
- Combine UX observations with conversion/page data: dead/rage clicks, scroll depth, device/page errors, poor mobile performance, and exit/drop-off points only where reliably available.
- Do not store session recordings, form fields, patient text, sensitive page content or private identifiers in CCM by default. Follow each provider's privacy/consent/masking controls.

## 4.8 Social Media workspace

Create a unified account registry and performance view for supported platforms, potentially Instagram, Facebook/Meta, LinkedIn Pages, YouTube, TikTok, Pinterest, X and additional official connectors. Do not claim every platform is connected or every metric is available until the account permissions, account type, API approval, current version and endpoint are verified.

For each platform, show:

- Connected identity/account/Page/channel, business or creator type where relevant, authorization scopes, data permissions and freshness.
- Followers/subscribers, reach/impressions, views, interactions, engagement rate with an explicit formula, outbound clicks and post/video metrics to the extent actually provided.
- Top and declining content; dates; format; platform; link; post/content ID; audience/context available; and trends.
- Organic analytics and paid social ads as separate categories. Paid Meta ads, for example, belong to an authorized Meta Marketing API connection, not an organic Instagram profile metrics endpoint.
- Native platform deep links to the exact account, Page, channel or professional dashboard.
- A content calendar/publisher only where the official API and app permissions support it. Initial release should not publish automatically. A publishing action must preview the exact target account, media, copy, schedule/timezone and destination, and require user confirmation. Respect platform rate limits, policies, app review and unsupported features.

“Social ranking” must be defined carefully: track engagement/growth and, where external rank providers report them, search visibility of profiles/posts. Do not fabricate a universal native search rank that the social network API does not expose.

## 4.9 Unified email center

A true secure inbox experience, not merely a Gmail link:

- Gmail and Google Workspace through Gmail API after OAuth and access approval.
- Microsoft 365/Exchange Online through Microsoft Graph if enabled.
- Custom-domain mailboxes: identify the actual host. Use its official API if available; otherwise use secure IMAP/SMTP (TLS) only after confirming the provider supports this method and the owner explicitly authorizes it. Do not assume every custom domain is Gmail.
- Account switcher and all authorized mailboxes; inbox, unread, sent, drafts, folders/labels, archive, search, threading, attachments, compose, reply, reply-all, forward, mark read/unread, stars/flags and account identity.
- Use provider pagination/sync history/webhooks or push notifications when available, with a polling fallback and durable cursors; handle thread changes and deleted/moved messages safely.
- Cache the minimum data needed. Do not ingest all attachments/full bodies into a general analytics warehouse. Protect mailbox content with separate policies and RLS. Provide individual permission control for mailbox access.
- Sending, forwarding externally, deleting, bulk actions and any action with a material side effect require a confirmation flow and an audit record. Display which mailbox/address will be used before sending.
- AI summaries, classification and task extraction are opt-in per mailbox/folder and must not transmit message bodies/attachments to an external model by default; sensitive mail gets no AI processing until explicitly approved.
- Google OAuth restricted Gmail scopes may entail verification/security-assessment requirements depending on the scopes and data handling. Document these as launch prerequisites. Never bypass these controls.

## 4.10 Account Launcher — release-blocking requirement

This is not optional. It must work across all provider tiles implemented in the UI.

### Separate the two connection types

1. **API connection** — authorization to fetch data via the provider's official API. State: Connected, Needs setup, Token refresh failed, Permission revoked, Provider outage, Rate limited, or Sync stale.
2. **Browser session/launcher** — opens the provider's native site using the user's existing local browser profile and any valid first-party login session. This status is not identical to API connection status.

### Standard browser launch

- Maintain a `connected_accounts`/account-catalog record with platform, stable external account ID (where permitted), safe display label, preferred landing URL, native management URL, account-specific identifiers, launch mode, browser profile mapping, last-open timestamp and integration reference.
- Implement provider-specific, verified deep links. Examples include the exact Google Ads customer/account destination, selected GA4 property/admin/report, Search Console property, GTM container, Instagram professional/business destination, Meta Business Suite/Page, LinkedIn company Page/admin view, YouTube Studio channel, TikTok business destination, Pinterest business tools, X account and exact Gmail/mailbox. Validate routes against current provider behavior and use only known IDs. Do not guess IDs or open the provider homepage when a precise authorized destination is available.
- Open a new tab with `noopener`/`noreferrer` where appropriate; use a strict allowlist of HTTPS provider hostnames and validated URL construction to prevent open-redirect/phishing bugs.
- A direct link in an ordinary browser tab should open in the same browser profile as CCM. If the user already has an active session for that provider in that profile, the provider should reuse it. Do not attempt to extract cookies/passwords or sign the user in silently.

### Browser extension / session bridge

Build a companion Chromium Manifest V3 extension if a hosted web app alone cannot reliably achieve target-profile launch. Place it in its own folder (for example `apps/ccm-browser-bridge/`) and document how to load locally, test, package and later publish it. Use minimum permissions; use a precisely scoped `externally_connectable` origin allowlist (local dev origin plus the exact production origin once set); validate the sender origin and user/action; use a short-lived, one-time server-signed launch ticket bound to the account ID, hostname, user and expiration; reject expired/replayed tickets; validate destination hostname against an explicit provider allowlist; create the new tab in the profile in which the extension is installed. Do not request broad `cookies`, history, all-sites content, password, or form-data permissions.

The extension must not accept arbitrary URLs from client messages. It should accept an authorized account/launch ticket and obtain a validated launch target, or verify a signed, minimal launch payload. It must not store provider login cookies or passwords.

### Multiple browser profiles/accounts

If the same network/provider has multiple identities, document and support a predictable mapping from CCM account to browser profile. A standard hosted site cannot force a different Chrome/Edge/Firefox profile to open. For deterministic cross-profile launches, evaluate an optional locally installed native companion (or supported browser profile strategy) that the user explicitly installs and pairs. It must accept only authenticated, time-limited account launch requests, allowlisted domains, and explicitly configured browser-profile identifiers. It must never read, export or modify cookies/passwords.

Support Chrome/Chromium first (and Edge/Brave when compatible); describe Firefox/Safari differences honestly. The UI should display the assigned profile and explain when the user should sign into the provider there once. If the provider's session has expired, the provider can require sign-in, MFA or CAPTCHA; show a helpful message and allow normal reauthentication. Never claim “never expires”.

### Account launcher UX

- Search/filter by provider, business/workspace, account name, profile and status.
- Cards include provider logo/icon, label, account identifier masked where appropriate, API status, last sync, assigned browser profile, `Open account`, `Open management`, and `Test launch`.
- Successful launch feedback means “tab opened”; do not claim the provider session was authenticated unless a supported, reliable signal exists.
- “Test launch” verifies that the extension/helper received and opened the mapped, allowed target, not the target website's authentication state. Clearly separate these results.
- Add a setup wizard to register/review profile mapping and test one account at a time.
- Add audit events for mappings changed, helper paired/unpaired, and account launch attempts without recording sensitive URL query tokens.

Acceptance tests for this feature are in Section 13. Do not mark the account launcher complete if it is merely `window.open(url)` with no provider-specific mapping, permissions validation, multi-account handling, tests or limitation messaging.

## 4.11 Alerts, action queue and AI analyst

- A single issue/action queue covering spend anomalies, conversion tracking, organic ranking changes, technical SEO, site uptime/SSL, page-speed regression, social performance changes, broken connections, sync failures, quota limits and email follow-up reminders.
- Each item has severity, observed values/baseline, provider, source URL/data reference, affected site/account, confidence, freshness, owner, status, due date, resolution note and audit history.
- Configurable thresholds and quiet periods; avoid spamming users when a metric has low volume or the source is delayed.
- AI query experience with answers grounded in current synced data, cited provider/record/time range, clear “unknown/not connected/stale” caveats, no invented results, and an inspectable trail of sources used.
- AI may propose tasks and drafts. Do not allow unapproved spending changes, tag publishing, email sending, posting, deletion or permission changes.
- Keep a provider changelog/compatibility monitor for API versions, OAuth scopes, permissions, quota policy and planned sunsets.

## 4.12 Reports and exports

- Daily/weekly/monthly briefing; site report; ads report; SEO/rankings report; social performance report; connection-health report; email operations digest.
- Customizable date ranges, comparisons, website/account scope, locale/service, and currency/timezone.
- CSV and PDF/export-to-print where useful. Ensure exported reports contain the same reviewed values as the screen and include data freshness/source caveats.
- Build “share safe / privacy mode” for screenshots or reports that mask customer/mailbox and sensitive account identifiers.

## 4.13 Settings, users, API connections and audit

- Invite-only user onboarding, MFA/passkeys where the stack supports them, session/device controls and recovery procedures.
- Roles and permission matrix (examples: Owner/Admin, Marketing Analyst, SEO, Ads Manager, Social Manager, Mailbox User, Read-only). Permissions should be feature and account scope aware.
- API connection catalogue, scopes, connected identity, API version, last success/failure, next refresh if applicable, quota use, reconnect/revoke and docs/setup checklist.
- Data retention settings, sync schedules, alert settings, branding/locale settings, timezone/currency, export controls, audit events, backup/recovery documentation.

# 5. Architecture and engineering standards

Choose the best production architecture after inspecting the existing repository, but optimize for these outcomes:

- TypeScript end-to-end unless the existing project has a compelling reason not to.
- A modular monolith with clear domain modules and provider adapters; do not introduce microservices without demonstrated need.
- Vercel-hosted web app initially, Supabase Auth/Postgres/RLS/storage for the initial backend. Use the current supported Supabase SSR/auth setup, current Vercel deployment practices, pinned versions and migrations.
- Separate UI, domain logic, provider clients, jobs, database repositories and schemas. Shared provider/core functions should avoid platform-specific APIs where practical.
- Background synchronization must be durable, bounded, retryable, idempotent and rate-aware. Use a database-backed job queue with claim/lease/lock and retry policy (or an already suitable durable queue in the existing stack). Use Supabase Cron/Edge Functions or Vercel Cron to **dispatch bounded jobs**, not a single ever-growing task that fetches every account in one function invocation. Batch data by property/date/account and store checkpoints/cursors. Use exponential backoff with jitter, provider quota budgets, dead-letter/error states, manual retry and duplicate-work protection.
- Do not use in-memory arrays/timers as the real production synchronization system. Ensure serverless cold starts and function-duration limits are handled.
- Use provider capability interfaces (read reports, list accounts, refresh auth, launch URL metadata, optional approved writes) and a connector registry that records exactly what each connector can do.
- Store daily aggregates/metric snapshots for trends and a source lineage record. Keep provider raw identifiers and source timestamps where needed, but normalize into documented metric facts without destroying original provenance.
- Use database migrations and typed schema generation where appropriate. No production schema edits outside migration files.
- All high-trust actions run server-side with authorization rechecked at execution time.

## Vercel + Supabase first; VPS later

Initial cloud setup:

- Vercel for the Next.js application and short, authenticated API routes.
- Supabase Auth, Postgres, RLS, required storage, migration/seed strategy and scheduled job kickoff.
- Provider secrets in managed environment variables/secret store, never in git or client bundles.
- Scheduled connectors run in bounded batches with lock/checkpoint state. Heavy/long-running sync should be moved into the worker/runtime path, not squeezed into an HTTP route.

Portability requirements:

- Keep business logic and provider adapters separate from Vercel route handlers and Supabase Edge Function wrappers.
- Provide `Dockerfile`/`docker-compose.yml` for the application and a persistent worker when practical; document a supported later VPS profile using self-hosted Supabase (official Docker-based self-hosting) or a clearly documented compatible PostgreSQL/auth/storage configuration.
- Provide `.env.example`, health/readiness routes, graceful shutdown, structured logs, migration commands, backup/restore instructions and reverse-proxy/HTTPS guidance.
- Document which capabilities differ between hosted Supabase and self-hosted Supabase; do not claim self-hosting is identical or zero-maintenance.
- Keep provider API endpoints, callback base URLs, scheduled job drivers, storage and public origin environment-configurable.
- Prefer open standards and Postgres to avoid avoidable lock-in, while using Supabase-specific RLS/auth/storage intentionally and documenting them.

## Data model

Design normalized schemas along these lines and adapt to the existing schema when sound:

- users/profiles, roles/permissions, memberships/workspace scopes
- websites, website_domains, website_pages, locales/service clusters
- provider_definitions, provider_connections, connection_scopes, private encrypted credentials, OAuth state/nonces, token refresh events
- external_accounts, external_account_identifiers, account_launch_profiles, launch tickets/audit events
- sync_jobs, sync_runs, sync_cursors, sync_errors, connector_capabilities, API version metadata
- metric_definitions, daily_ads_metrics, daily_ga4_metrics, daily_gsc_metrics, rank_snapshots, social_account_metrics, social_post_metrics, site_health_checks, tag_manager inventories/version snapshots
- alert_rules, alerts, action_items, owners/assignments, resolution history
- mailbox_connections, mailbox sync cursors, message/thread metadata, per-mailbox access policy; store message bodies/attachments only with a justified design and explicit permission
- report definitions/runs, source references, AI insight requests/source references, user preferences and audit_events

Add tenant/workspace ownership to records so future expansion does not require a destructive rewrite. Every query must scope by the authenticated user's permitted workspace/account; UI filters do not replace database access policies.

# 6. Security requirements — no exceptions

- Enable and test Row Level Security on all tables exposed through Supabase/PostgREST. Default deny. Use policies tested with admin, analyst, mailbox-only, read-only and unauthenticated clients.
- Never expose Supabase service-role keys, OAuth client secrets, Google refresh tokens, SMTP/IMAP passwords, API keys, or encryption keys to client code, public env vars, logs, screenshots, or Git. Use server-only secrets and rotate them if exposed.
- Store refresh tokens encrypted at application level (for example, authenticated encryption with a managed/keyed server-side secret or KMS). Keep encryption keys separate from the database, plan rotation and restrict decryption to the provider-worker service. Use secure token revocation and disconnect flows.
- OAuth: exact redirect URIs; CSRF-resistant `state`; PKCE wherever supported; validate issuer, audience, scope, expiry and provider response; prevent callback replay; never trust a client-posted token or account ID.
- Request minimum scopes. Use read-only scopes first. Provide incremental consent where possible. Document app review / verification and restricted-scope assessment tasks before release.
- MFA/passkeys and invite-only access for administrators. Enforce least privilege, recheck permissions server-side, use secure session cookies, rate limiting, CSRF protection where applicable, strict CORS, CSP, security headers, safe errors and security event logging.
- Validate all provider URLs and parameters. Protect against SSRF, open redirects, IDOR, webhook spoofing, SQL injection, XSS, CSV formula injection, stored HTML, untrusted provider text and ZIP/file upload attacks if any file feature is added.
- Provider webhooks must verify signatures (where supported), timestamps and idempotency; secrets must not appear in webhook URLs or logs.
- Protect mailbox content separately from general marketing data. No email body or attachment sent to third-party AI by default. No patient names/medical details in ad analytics, URL params or logs.
- Minimize retention, allow disconnect/data deletion under policy, and document exports/audit retention. Use redacted structured logs.
- Run dependency scanning, lint/typecheck, tests, and available Supabase security/performance advisors. Do not suppress a security warning without documenting the reason.

# 7. UI/UX requirements from design.md

Use the supplied “Medicalbay Calm Care” token system, preserving these exact core values:

- Primary `#4bbdbd`; hover/highlight `#6ccaca`; lighter teal `#8ad6d6`.
- Secondary/body text `#4b4f58`; strong text `#3a3a3a`.
- Background/surface white `#ffffff`; muted surface `#f7f8f9`; border `#e5e7eb`; error `#d9534f`.
- Heebo throughout; display heading 41/49, large 30/39, medium 25/35, small 18/22; body 16/28 or 15/28 and 14/24; labels/buttons semibold as specified in design.md. Use sane responsive scaling without compromising reading size.
- Main button height 47px and ~7px radius; 8px card radius; compact full-radius chips only; cards around 16px padding; restrained shadows; clear hover/focus states and disabled behavior.
- Whitespace-driven editorial rhythm. Predominantly white, pale gray separators, teal for selected nav, chart focus and main actions. No neon gradients, bulky shadows, unneeded animations, black-heavy main canvas or generic dashboard kit unmodified.
- Build a cohesive dashboard shell: calm left sidebar; top-level site/account/time selectors; page title/subtitle; clear primary actions; compact KPI row; chart/table/action regions. Optimize for dense data without crowding.
- Provide desktop, tablet and mobile layouts. On small screens, replace wide tables with responsive tables or row cards; keep navigation and global search usable.
- Accessible contrast, keyboard navigation, visible focus, semantic form labels, ARIA only where needed, chart text alternatives, reduced motion and screen reader labels.
- Support the public brand languages as an architecture foundation: English, French and Arabic; Arabic must use proper RTL layout, alignment, icon direction and keyboard order. Do not machine-translate fixed strings at render time. Keep UI language independent from website's page-language metrics.
- No fake live charts in production. During development, use clearly marked synthetic fixtures and a demo-mode indicator; production should show “connect a source”/“no data yet”/“data stale” states until real data has been loaded.

## Design workflow and useful skills

If supported in the agent environment, read/install and actually use relevant skills—not just mention them:

- **12ui Design (`12ui-design`)**: use for non-trivial UI exploration; draft distinct candidates from the CCM brief/design.md, review the actual images, select an intentional visual direction, and branch it into full page/app states. Check CLI help instead of inventing flags. The documented initial install command is `npx -y @12ui/design cli install`; verify runtime and costs before invoking hosted generation. Do not approximate a selected reference without reviewing it.
- **Supabase skill**: read `skills://plugins/supabase/supabase/skill.md` or the equivalent installed skill before working on any Supabase auth, DB, migrations, RLS or functions.
- **Vercel deployments/CI skill**: read `skills://plugins/vercel/deployments-cicd/skill.md` before editing deployment pipelines or production configuration.
- **Data Analytics skills**: use `data-analytics/build-dashboard`, `visualize-data`, and `validate-data` (or equivalent available skills) for meaningful KPI definitions, metric freshness, chart validation and report exports. These do not replace implementing this full application.
- **Product Design**: use the available `get-context`/`audit` skills if present to check navigation, role/access flows, responsive states and usability before declaring the UI complete.
- Read the installed security/OWASP testing skill if one exists. If not, follow a documented OWASP ASVS-aligned checklist and provider OAuth requirements.

Use installed MCP/tools if actually available and authorized. Suggested tools are GitHub MCP for repo/reference inspection; Supabase MCP for schema/migrations/advisors; Vercel MCP for deployment configuration/preview checks; Google Ads official MCP for agentic inspection and documentation-supported read-only analysis; PostHog MCP if PostHog is enabled; and Ahrefs' **current remote MCP** where the owner's account permits it. Verify each server is genuine, maintained, authorized and current before use. Do not use the archived/local Ahrefs MCP repo or its outdated package; Ahrefs states that the repo was archived in February 2026 and replaced it with a remote MCP server. MCPs are primarily agent/developer access tools; the CCM runtime's production connectors should generally call documented official APIs directly, using CCM's own OAuth and permission enforcement. Do not route production data through an MCP just because it is available.

Do not blindly install every skill, library or MCP. Check the installed catalog, official docs, package health, licenses, maintenance activity, runtime compatibility and cost. Install only what materially improves this task. Never paste real API secrets into an MCP config committed to the repo.

# 8. Open-source research / reference repos

Study these repositories for architecture and product patterns. They are inspirations, not code to copy blindly. Inspect current commit/maintenance state, security advisories, dependency chain and license before reuse.

1. `https://github.com/jafforgehq/site-analytics-tool` — focused multi-site GA4/Search Console/Bing dashboard using Supabase, scheduled syncs, stale-data detection, RLS/MFA, exports, opportunities and site-health alerts. It is a small, single-admin-focused project; use it to understand a narrow vertical slice, not as proof that a complete multi-user CCM is production-ready. Its declared license is MIT.
2. `https://github.com/PostHog/posthog` — product analytics, web analytics, session replay, heatmaps, errors and data tooling. Good reference for analytics event models and behavior-analysis UX. Review its license carefully: the main repository includes areas with separate licensing; do not assume every folder is MIT. See https://posthog.com/docs and https://posthog.com/mcp.
3. `https://github.com/gitroomhq/postiz-app` — social media scheduling, analytics, team collaboration and connector patterns. The repository declares AGPL-3.0. Treat it as a functional/UX reference unless legal review approves code reuse or a compatible integration.
4. `https://github.com/umami-software/umami` — privacy-oriented analytics UI, site metrics, a Node/Next.js/PostgreSQL stack and self-hosting references. The repository declares MIT.
5. `https://github.com/plausible/analytics` — clean, privacy-first analytics, source-based reporting and self-hosting. The repository declares AGPL-3.0; use design/architecture inspiration, not copied code unless licensing is explicitly reviewed.

Look at screenshots/demo instances and inspect data freshness, filter/date selector behavior, responsive charts, settings screens, account connection flows, empty/loading/error states and permission handling. Record 5–10 concrete reusable design/engineering lessons in `docs/research/open-source-reference-notes.md`. **Do not import a whole application or copy large blocks of code.** Keep a license inventory/SBOM and review new packages before adding them.

# 9. MCPs, APIs and current documentation starting points

Verify these URLs are still current at implementation time, then record versions, scopes, limitations and approval needs in `docs/integrations/connector-capability-matrix.md`.

- Google Ads API onboarding/MCP: https://developers.google.com/google-ads/api/docs/api-policy/developer-token and https://developers.google.com/google-ads/api/docs/developer-toolkit/mcp-server
- Google Analytics Data API: https://developers.google.com/analytics/devguides/reporting/data/v1
- Google Search Console API: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- Google Tag Manager API v2: https://developers.google.com/tag-platform/tag-manager/api/v2
- Google OAuth: https://developers.google.com/identity/protocols/oauth2/
- Gmail API: https://developers.google.com/workspace/gmail/api/guides
- LinkedIn Marketing API version migrations: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/migrations
- Meta/Instagram Graph API: start from the current official Meta developer documentation and verify current account type, publishing/insights permissions, app review and endpoint versions.
- YouTube Data and Analytics APIs: https://developers.google.com/youtube/v3 and https://developers.google.com/youtube/analytics
- Microsoft Clarity: start from current official Clarity API/export docs and verify limits and retention window.
- Ahrefs current MCP guide: https://help.ahrefs.com/en/articles/13913559-getting-started-with-ahrefs-mcp and current remote MCP documentation linked there. Do not use https://github.com/ahrefs/ahrefs-mcp-server as a maintained local server; it is archived.
- Supabase self-hosting: https://supabase.com/docs/guides/self-hosting
- Vercel function limits/durations: https://vercel.com/docs/functions/limitations and https://vercel.com/docs/functions/configuring-functions/duration
- Chrome extension tabs/message passing: https://developer.chrome.com/docs/extensions/reference/api/tabs and https://developer.chrome.com/docs/extensions/develop/concepts/messaging

Current-version watchouts to verify at the beginning of work: Google Ads API onboarding changed in September 2026; LinkedIn's documentation states Marketing API versions are time-based and require regular migrations. Do not hardcode a version number into many files. Keep API versions central/configurable per provider and add an API-deprecation watchlist.

# 10. Dashboard metric and data-quality standards

- Define a canonical metric registry: key, display name, definition/formula, source connector, source field, unit, currency/timezone, grain, aggregation, allowed dimensions, attribution limitations, freshness target, and known caveats.
- Store raw/source identifiers and fetched-at timestamps, plus normalized daily facts. Do not mix daily and lifetime counts. Do not sum unique users or average positions across incompatible grains without a documented calculation.
- Handle API date boundaries, delayed reporting, null/unsupported data, pagination, timezone and daylight-saving changes, currency micros, duplicate records, deleted posts and account disconnects.
- Normalize currency only through an explicit exchange-rate source/date; otherwise keep per-account native currency and avoid misleading portfolio totals.
- Use `null` for missing data. Never fill missing metrics with zero unless the provider's semantics explicitly guarantee zero.
- Provide source and freshness details on hover/drill-down; distinguish source-reported, CCM-derived and model-generated metrics.
- Recompute derived KPIs in a tested domain layer, not separately in random UI components. Use SQL aggregates/materialized views only when justified and keep them refreshable.

# 11. Suggested technical stack and quality gates

Adapt to a healthy existing stack instead of forcing a needless rewrite. If there is no good existing stack, default to:

- Next.js App Router + React + TypeScript, current stable supported versions.
- Supabase Auth/Postgres/RLS, Supabase SSR libraries and SQL migrations.
- Tailwind CSS and an accessible primitive layer (for example Radix/shadcn primitives customized to `design.md`), not unmodified template defaults.
- A well-maintained React chart library such as Recharts or an equivalent; all charts must be responsive, accessible and semantically correct.
- Schema validation (for example Zod), typed provider contracts, a stable date/time utility and structured logs.
- Unit tests for domain math, connector/API contract tests with fixtures, RLS authorization tests, and Playwright end-to-end tests for major flows. Use test accounts/synthetic data until live authorization is provided.
- Dependency/license review, lint, typecheck, tests and production build checks.

Avoid library sprawl. Pin compatible versions; commit a lockfile; document why each non-trivial dependency is needed. Do not create a custom chart engine or auth system without a strong reason.

# 12. Delivery stages — implement in vertical slices

**Stage A — Repository/design/architecture baseline**
- Audit repository and baseline checks.
- Read design.md and create tokens/components.
- Review Medical Bay public-site IA and the open-source references.
- Write a technical plan, scope/role matrix, data/connector map, API capability matrix, architecture notes and acceptance-test plan.
- Build the application shell, invite-only auth, route permissions, settings shell, shared state/error/empty/loading components and a realistic synthetic-data dev mode clearly labeled as demo.

**Stage B — A complete usable first vertical slice**
- Implement website/account registry + dashboard with true empty states.
- Implement Supabase schema/migrations/RLS.
- Implement connector framework, connection catalog, sync job queue, run history, health/freshness, retry and audit records.
- Implement at least Google Analytics and Search Console as first live read-only connectors when credentials/approval are available; if not, build real setup flows and mocked contract tests without pretending they are connected.
- Build the account launcher provider registry and browser launch tests immediately—not as a decorative feature left until the end.

**Stage C — Ads, SEO and tracking health**
- Google Ads read-only reporting, GTM inventory, PageSpeed, uptime and technical checks.
- Rank-tracking provider adapter and source-backed SEO module.
- Validate metric formulas/timezones/labels; add sync and anomaly alerts.

**Stage D — Social integrations and account launch bridge**
- Add connector adapters in order of actual authorization feasibility.
- Build and verify Chromium extension / profile bridge, pairing/setup and account registry. If deterministic cross-profile opening is needed, implement an explicitly installed local helper after documenting the OS/browser constraints.
- Create account-specific native deep links and test all supported account types using authorized test accounts.

**Stage E — Email**
- Implement Gmail/Workspace first if authorized, then Microsoft Graph and/or secure IMAP/SMTP for identified domain hosts.
- Build actual inbox thread/search/paging/drafts/reply/confirm-before-send, mailbox policies and audit trail.
- Document OAuth restricted-scope assessment and provider limitations.

**Stage F — Reports, alerts, AI and localization**
- Unified action center; scheduled digests; KPI/source registry; grounded AI with source citations; French/English/Arabic UI and real RTL; accessibility and visual regression checks.

**Stage G — Production hardening and VPS package**
- Exercise reconnect/revocation, job recovery, quota throttling, account access isolation, privacy controls, multi-profile launch, data retention and backups.
- Add Docker/VPS docs, environment examples, health checks and worker start/stop documentation.
- Final security review, source freshness review and end-to-end test report.

Do not implement every provider at once as empty placeholder cards. Deliver one complete real vertical slice and then extend using the connector contract. Show real integration statuses rather than `Connected` badges in a demo.

# 13. Acceptance criteria / definition of done

CCM is not finished until these are verified, not merely described.

## Application and UI
- Every navigation item has a real route and a useful screen.
- Functional controls are implemented (date filters, search, sorting, account/site selectors, filters, connect/disconnect, refresh, report export, alert actions). No dead buttons or fake dialogs.
- Design matches supplied `design.md` at desktop/tablet/mobile, with accessible contrast/focus and robust loading/error/empty states.
- English/French/Arabic layout support is implemented where in scope; Arabic RTL is tested.
- Real data is visually distinguished from fixtures; production never reports synthetic fixtures as real analytics.

## Data and integrations
- For each connector, documented scopes, available methods, quotas, refresh cadence, data window, metric definitions, last sync and failure reasons.
- Syncs are idempotent, recover after restart, survive rate limits, checkpoint progress and show stale data rather than silently lying.
- Google Ads, GA4, GSC, GTM, Clarity, rank provider, social APIs and mailbox providers have explicit capability/permission status. Unsupported data/action is visibly marked and never fabricated.
- KPI formulas, timezones, currency and attribution caveats are reviewed and tested.

## Account launcher — mandatory tests
1. For every supported provider tile, click `Open account` and verify it opens the correct HTTPS host and the exact configured account/property/page/channel/management destination.
2. In a browser profile already logged in to that provider, confirm the new tab reuses that first-party session and lands at the correct destination when the provider permits it.
3. Confirm an account with a still-valid API OAuth token but a logged-out browser session is shown as API-connected but browser session requires normal sign-in (not falsely marked as logged in).
4. Revoke an API token and confirm the API connection status degrades/reconnect flow works while the browser-launch status remains independent.
5. Test two accounts on the same provider and ensure account/profile mappings do not silently send the user to the wrong identity. If the selected profile cannot be opened from the current web tab, provide the extension/helper path and setup instructions.
6. Test expired launch tickets, replayed tickets, wrong account IDs, arbitrary URLs, non-HTTPS targets, unapproved hosts and incorrect origins. All must be rejected.
7. Confirm the extension/helper never reads, exports, stores or uploads provider cookies/passwords or MFA codes.
8. Simulate an expired provider session, MFA challenge or CAPTCHA and confirm CCM presents a clear handoff instead of claiming permanent sign-in.
9. Test browser back/forward, popup restrictions, missing extension, unpaired helper, disabled extension and unsupported browser states.

## Security / privacy
- RLS tests prove a user cannot see another user's restricted website, API connection, mailbox, token metadata, reports or audit data.
- No credential is included in front-end bundles, logs, git history, source screenshots or public test fixtures.
- OAuth state/PKCE, callback replay, refresh/revoke, least scopes and authorization checks are tested.
- Mailbox access is separately scoped and AI processing disabled by default for message bodies/attachments.
- Logs and analytics do not contain patient identifiers, health details, message body text or tokens.
- Supabase security/performance advisors and dependency/security scans reviewed; findings documented and repaired or explicitly justified.

## Engineering / delivery
- Lint, typecheck, tests and production build pass, or every blocker/failure is precisely documented.
- Automated tests cover metric math, data normalization, connector contract, permissions, launch-ticket security, and key UI paths.
- Provide setup and deployment docs: `README.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/PRIVACY-DATA-FLOWS.md`, `docs/integrations/connector-capability-matrix.md`, `docs/research/open-source-reference-notes.md`, `docs/deployment/vercel-supabase.md`, `docs/deployment/vps.md`, and `docs/account-launcher.md` (adapt directory names if needed).
- Provide `.env.example` without secrets; document OAuth callback URLs, Google Cloud API setup, each provider's app review/scope requirements, and worker scheduling.
- No commit/push/deploy/database production changes unless separately authorized.

# 14. Final response from the coding agent

At the end, report:

1. What is genuinely implemented and working, with links to local routes/screens or test evidence.
2. Main architecture and migrations added.
3. Which connectors are live, which are implemented but waiting for credentials/approval, and which are not feasible through current official APIs.
4. Account launcher level verified: direct browser profile, extension bridge, and/or native multi-profile helper; explicit test results and remaining browser-provider limitations.
5. Security/privacy measures and the results of RLS/OAuth/launch tests.
6. Commands and results for lint, typecheck, test, E2E and build.
7. Environment variables and provider setup still needed—names only, never secrets.
8. VPS portability status and documented differences.
9. Archive/migration actions taken, any remaining blockers, and next best implementation step.

Do not call CCM production-ready because a page renders. Use evidence: passing tests, safe provider authorization, correct RLS, truthful integration states, real account-launch behavior, and a successful build. Be factual and transparent about unverified providers and pending OAuth/app-review approvals.

---

## Reference links reviewed for this brief (verify again before implementation)

- Medical Bay: https://www.medicalbay.ma/ ; https://www.medicalbay.ma/en/about-us/ ; https://www.medicalbay.ma/dentisterie-esthetique-agadir/ ; https://www.medicalbay.ma/greffe-de-cheveux-agadir/
- GA4/GSC/Supabase architecture reference: https://github.com/jafforgehq/site-analytics-tool
- Analytics/replay/heatmaps reference: https://github.com/PostHog/posthog ; https://posthog.com/docs ; https://posthog.com/mcp
- Social publishing reference (AGPL-3.0): https://github.com/gitroomhq/postiz-app
- Privacy analytics references: https://github.com/umami-software/umami ; https://github.com/plausible/analytics
- Google Ads current API onboarding and MCP: https://developers.google.com/google-ads/api/docs/api-policy/developer-token ; https://developers.google.com/google-ads/api/docs/developer-toolkit/mcp-server
- Google OAuth: https://developers.google.com/identity/protocols/oauth2/
- Search Console: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- GTM: https://developers.google.com/tag-platform/tag-manager/api/v2
- LinkedIn version migrations: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/migrations
- Ahrefs current MCP (not the archived local server): https://help.ahrefs.com/en/articles/13913559-getting-started-with-ahrefs-mcp
- Supabase self-hosting: https://supabase.com/docs/guides/self-hosting
- Vercel functions: https://vercel.com/docs/functions/limitations
- Chrome extension tabs and messaging: https://developer.chrome.com/docs/extensions/reference/api/tabs ; https://developer.chrome.com/docs/extensions/develop/concepts/messaging
