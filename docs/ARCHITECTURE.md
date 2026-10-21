# Architecture

CCM — Command Center Medicalbay. A modular monolith for marketing, growth
and digital operations, deployed on Vercel + Supabase and architected so the
same domain code can run on a VPS later.

---

## 1. The shape of the system

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser                                                          │
│  ┌────────────────────┐        ┌───────────────────────────────┐  │
│  │ CCM web app        │        │ CCM Browser Bridge (MV3)     │  │
│  │ Next.js App Router │        │ apps/ccm-browser-bridge       │  │
│  └─────────┬──────────┘        └───────────┬───────────────────┘  │
│            │ HTTPS                           │ chrome.runtime    │
└────────────┼─────────────────────────────────┼────────────────────┘
             │                                 │
             ▼                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  Vercel (or a container on a VPS)                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Next.js server                                             │  │
│  │  src/app        routes, server components, route handlers   │  │
│  │  src/components shell + design system                      │  │
│  │  src/repositories RLS-scoped data access                   │  │
│  │  src/lib/jobs    durable sync queue                        │  │
│  │  src/lib/launch launch tickets + URL validation            │  │
│  └──────────────────────────┬─────────────────────────────────┘  │
│                             │                                    │
│  ┌──────────────────────────┴─────────────────────────────────┐  │
│  │  src/domain     pure logic — no IO, no framework imports   │  │
│  │  src/providers  provider adapters + capability registry     │  │
│  └──────────────────────────┬─────────────────────────────────┘  │
└─────────────────────────────┼────────────────────────────────────┘
                              │ service role, server only
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Supabase: Auth · Postgres + RLS · Storage · Cron                │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐  │
│  │ tenant data             │  │ sync queue                  │  │
│  │ workspaces, websites,   │  │ sync_jobs (claim/lease)      │  │
│  │ connections, accounts,  │  │ sync_cursors (checkpoints)   │  │
│  │ metrics, alerts,        │  │ sync_runs, sync_errors      │  │
│  │ mailboxes, audit        │  │                              │  │
│  └──────────────────────────┘  └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼  (worker, service role)
┌──────────────────────────────────────────────────────────────────┐
│  Provider APIs: Google Ads · GA4 · GSC · GTM · Gmail · Meta ·   │
│  LinkedIn · Ahrefs · Clarity · PageSpeed                        │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Module boundaries

| Layer | Directory | Rule |
|---|---|---|
| Domain | `src/domain/` | Pure functions. No React, no Next, no Supabase, no `Date.now()` inside a render path. Everything here is unit-tested. |
| Providers | `src/providers/` | Provider adapters and the capability registry. Knows about provider APIs; knows nothing about the database or the UI. |
| Repositories | `src/repositories/` | Data access. Every query runs through the request's RLS-scoped client, so a repository cannot accidentally bypass authorisation. |
| Jobs | `src/lib/jobs/` | The durable queue. Claims, leases, retries, dead-letters. |
| Launch | `src/lib/launch/` | Tickets, URL construction, host allowlists. |
| UI | `src/app/`, `src/components/` | Server components read; client components interact. |

The dependency direction is one-way: `app → repositories → supabase`,
`app → domain`, `app → providers`. `domain` imports nothing from the rest.

### Why a modular monolith, not microservices

A single deployable unit with strict internal boundaries. There is one team,
one product, and a data model where the interesting queries are joins
across accounts, metrics and alerts. Splitting it would add network
failures and distributed transactions to problems that do not yet exist.

## 3. The data model

28 tables across 12 migrations, plus a generated `supabase/repair.sql` that
can rebuild the authorisation layer on a partially applied database. Every
tenant-owned table carries `workspace_id`, and **Row Level Security is
enabled in the same migration that creates the table** — there is never a
window in which a table exists unprotected.

| Group | Tables |
|---|---|
| Tenancy | `workspaces`, `workspace_members`, `roles`, `role_permissions`, `external_account_grants`, `user_preferences` |
| Websites | `websites`, `website_domains`, `website_pages`, `site_health_checks` |
| Providers | `provider_definitions`, `provider_connections`, `provider_connection_credentials`, `external_accounts`, `external_account_identifiers`, `account_launch_profiles`, `launch_tickets`, `launch_events` |
| Synchronisation | `sync_jobs`, `sync_runs`, `sync_cursors`, `sync_errors` |
| Metrics | `metric_definitions`, `daily_ads_metrics`, `daily_ga4_metrics`, `daily_gsc_metrics`, `rank_snapshots`, `social_account_metrics`, `social_post_metrics`, `tag_manager_snapshots`, `metric_source_references` |
| Operations | `alert_rules`, `alerts`, `action_items`, `action_item_events` |
| Mailbox | `mailbox_connections`, `mailbox_threads`, `mailbox_messages`, `mailbox_cursors` |
| Reporting | `report_definitions`, `report_runs`, `ai_insight_requests`, `ai_insight_sources` |
| Audit | `audit_events` |

### The authorisation model

There is one place where access is decided, and it is the database.

The **owner** edits **tabs**: for each role, how far into each tab that role
may go.

| Level | What it allows |
|---|---|
| **none** | The tab is not shown and cannot be reached. |
| **view** | The tab is shown and can be read. |
| **use** | The tab's actions are available: export, refresh, open an account, send a message, run a digest. |
| **edit** | The tab's configuration may be changed: register a site, connect a provider, change a rule. |

The levels are the **input**. The feature permissions the database enforces
are the **output**, derived from them:

```
src/domain/tabs.ts           the tab registry: what each tab needs to read, use, edit
src/domain/roles.ts          the default levels of each role, and the derivation
src/domain/permissions.ts    the derived permission set the interface uses
supabase/migrations/0016_role_tab_access.sql   the tab map, the input, in the database
```

The derivation is one function, `deriveRolePermissions`. Nothing is written
twice, so the interface cannot offer a permission the Row Level Security
policies refuse.

Two rules protect the workspace from a mistake:

- **The owner's role is never derived.** It always holds every permission,
  so the workspace can always be administered. It is not editable.
- **The owner-only tab grants nothing by derivation.** `roles.manage` comes
  from the role, not from a tab, so handing the people tab to the
  administrator cannot hand over the authority to change roles.

The navigation is **derived from the same registry**, so a tab cannot exist
without a navigation entry.
### Authorisation model

Two independent layers:

1. **Role** — workspace-level feature permissions
   (`overview.read`, `ads.read`, `inbox.send`, `launch.execute`, …).
   The role matrix lives in `public.role_permissions` and is the authority.
2. **Account grant** — a per-account override for account-scoped roles.
   A `mailbox_user` sees only the mailboxes explicitly granted to them.

The RLS helper functions are `SECURITY DEFINER` with a pinned
`search_path`, because a policy that read `workspace_members` through RLS
would recurse. Each helper re-checks `auth.uid()` explicitly.

```
is_workspace_member(workspace)        → membership
has_permission(workspace, permission)  → role holds the permission
can_access_account(account, permission)→ role holds it AND
                                         (role is not account-scoped OR
                                          an explicit grant exists)
can_read_metric(workspace, account, permission)
```

## 4. Background synchronisation

The queue is **in Postgres**, not in memory. A serverless function that
dies mid-sync loses nothing.

```
supabase cron / vercel cron
        │  POST /api/jobs/dispatch  (bearer CRON_SECRET)
        ▼
   claim_sync_jobs(workspace, limit, lease_owner, lease_seconds)
        │  SELECT ... FOR UPDATE SKIP LOCKED
        │  UPDATE status='running', locked_until=now()+lease, attempts=attempts+1
        ▼
   for each job (bounded batch, default 10):
        │  decrypt the provider token (AES-256-GCM, AAD = connection id)
        │  call the connector for a bounded slice
        │  upsert normalised daily facts
        │  write the checkpoint to sync_cursors
        ▼
   complete_sync_job(status, rows_written, duration, error, run_after, dead_letter)
```

**Properties this gives CCM:**

- **Idempotent.** `dedupe_key` is unique per workspace, so two requests for
  the same account and window collapse into one job.
- **Bounded.** A job names its own slice (account, date range, dimension).
  No job ever fetches "everything".
- **Restartable.** A crashed job's lease expires and the job is re-claimed.
  The cursor means it resumes rather than restarting.
- **Rate-aware.** Retry uses exponential backoff with jitter, so a provider
  outage does not produce a synchronised retry storm.
- **Bounded failure.** After `max_attempts` a job is dead-lettered and
  visible in the connection health panel.
- **Honest.** Auth failures are *not* retried — they need a human.

### Quota

A provider with an operations quota — Google Ads, Ahrefs, Meta — is checked
**before** the call, not after the provider rejects it. The connection
carries `quota_limit` and `quota_used`; the worker increments the counter
through `add_provider_quota_usage`, which is an atomic SQL function, so two
workers cannot lose an update between a read and a write.

When the quota is spent, the job is **deferred**, not failed. The work is
still wanted; the provider's window decides when it runs. The outcome
carries a `deferUntil`, the job is rescheduled for that time, and the
connection is marked `rate_limited` so the Integrations screen says so.

A provider that answers 429 also consumes quota, and that call is counted
too — otherwise a throttled sync would look like it had room left.

### One engine, two runners

The job engine lives in `src/lib/jobs/runner.ts`, and both runners call it:

| Runner | Command | Why |
|---|---|---|
| The Vercel / Supabase cron dispatcher | `POST /api/jobs/dispatch` | A serverless function with a bounded batch and a bounded duration. |
| The container worker | `node scripts/worker.mts` | Polls continuously, so it is not subject to the Hobby plan's once-a-day cron limit, and it survives a redeploy mid-batch. |

They share one implementation of "run a sync", so a bug cannot be fixed in
one path and left broken in the other.

The engine's steps are: load the connection and the account → decrypt the
credential → refresh the access token if it is close to expiry → run the
handler bound to the job kind → write the facts, the cursor and the
connection status. A job kind with **no handler** is reported as failed
rather than left to retry forever, because that is a configuration error and
not a transient failure.

### The handlers

`src/lib/jobs/handlers/` holds one handler per job kind.

| Handler | Reads | Writes |
|---|---|---|
| `ga4.sessions`, `ga4.events` | GA4 | `daily_ga4_metrics` |
| `gsc.query` | Search Console | `daily_gsc_metrics` |
| `ads.campaign`, `ads.search_terms` | Google Ads | `daily_ads_metrics` |
| `gtm.inventory` | Tag Manager | `tag_manager_snapshots` |
| `rank.snapshot` | Ahrefs Rank Tracker | `rank_snapshots` |
| `social.snapshot`, `social.posts` | Meta, Instagram, LinkedIn | `social_account_metrics`, `social_post_metrics` |
| `mail.sync` | Gmail | `mailbox_threads`, `mailbox_messages` |
| `pagespeed.run` | PageSpeed Insights | `site_health_checks` |
| `uptime.check` | The site itself | `site_health_checks` |
| `reports.generate` | The synced records | `report_runs` |
| `alerts.evaluate` | The metric tables | `alerts` |
| `retention.prune` | The metric tables | deletes old rows |

Two rules hold across all of them:

- **A missing value stays missing.** The normalisers map an absent provider
  value to `null`, never to `0`. A blank cell in the UI and in an export
  means "not reported", and the freshness note says so.
- **The mailbox never reaches the warehouse.** `mail.sync` writes to the
  mailbox tables, which have their own policies. The analytics tables never
  receive message content, so no export, alert or AI request can leak it.

### The OAuth engine

One engine connects every provider. The differences — endpoints, the scope
parameter, PKCE support, how the code is redeemed, how the accounts are
found — are data in `src/lib/oauth/registry.ts` and
`src/lib/oauth/discovery.ts`, not branches in the code.

```
/api/auth/[provider]/authorize
    │  read the app credential (interface first, environment as fallback)
    │  build the scopes for the chosen products
    │  seal the state: provider, user, workspace, products, PKCE verifier
    ▼
  the provider's own authorisation screen
    │
/api/auth/[provider]/callback
    │  open the sealed state; refuse a mismatch, a wrong provider,
    │  a wrong workspace or an expired attempt
    │  redeem the code server-side
    │  discover the accounts the credential can reach
    │  if there are none → no connection is created
    │  store the token encrypted, queue the first sync
    ▼
  the Integrations screen
```

Three rules hold across every provider:

- **The scopes are the union of the products that were asked for, and
  nothing more.** A Search Console connection never requests the Ads
  scope.
- **The account is discovered, never assumed.** The authorisation says the
  owner allowed the app; it does not say which Page, organisation or
  mailbox the token is for. That is a second call, and it is where a
  connection either becomes real or quietly becomes empty.
- **A connection with no accounts is not created.** Reporting
  "connected" for a credential that can read nothing is the failure this
  avoids.

### Provider apps in the interface

The client id and the client secret of a provider's app used to live in
`.env`, so connecting a provider meant editing a file and redeploying.
They live in `provider_app_credentials` now, encrypted with the row id as
additional authenticated data, and are entered in **Settings → Provider
apps**. The environment is still honoured as a fallback, so a deployment
that sets the variables keeps working.

The secret is never returned by an endpoint. The listing shows whether a
secret is stored, not the secret.



### The metric registry

`metric_definitions` is the canonical registry: key, display name,
definition, formula, connector, source field, unit, grain, currency and
timezone behaviour, aggregation, allowed dimensions, attribution notes,
caveats and a freshness target.

Derived KPIs are computed only in `src/domain/kpi.ts`:

```
CTR  = clicks / impressions
CPC  = spend / clicks
CPA  = spend / conversions
ROAS = conversion value / spend
position = Σ(position × impressions) / Σ(impressions)
```

Two rules follow from this and are enforced by tests:

- **A missing value is `null`, never `0`.** A provider-reported zero (a day
  with no impressions) is different from a day with no data.
- **Averages are computed over the right grain.** Active users are not
  additive across days; a monthly total of daily active users is not a
  monthly active-user count, and CCM does not pretend otherwise.

### Reporting lag

Providers report with different delays. `REPORTING_LAG` records them
(GA4 ≈ 1 day, Google Ads ≈ 2 days, Search Console ≈ 3 days). A day that
has not landed is *pending*, not zero, and the UI says so.

## 4a. When something goes wrong

A product that reports honestly about its data must also fail honestly.
There are four boundaries, and each of them shows a **reference** rather
than the error:

| Boundary | Covers |
|---|---|
| `src/app/(app)/error.tsx` | A screen in the application group that throws. Offers a retry and a way back. |
| `src/app/global-error.tsx` | A failure in the root layout itself, where the app's own providers are unavailable. It stands alone — its own HTML, its own inline styles. |
| `src/app/not-found.tsx` | An address that does not exist. Branded, with a way out. |
| `src/app/(app)/loading.tsx` | The moment every screen spends waiting for the database. |

The rule they share: **an error message is never rendered.** An error can
carry a provider response, a query, or a fragment of somebody's data, so
it goes to the server log and the person gets the digest — which ties the
two together.
## 5. The application shell

- A server layout resolves the session once and hands derived permissions
  to the navigation. Route guards and the database enforce the same
  permissions independently — the navigation only decides what to *show*.
- The **date range lives in the URL** (`?range=28d`, or `?from=&to=`). Each
  page reads it from its own `searchParams` so the server queries exactly
  the window the user is looking at, and the shell's period selector reads
  the same URL on the client. Both use `resolveRangeFromParams`, so they
  cannot disagree.
- Fifteen workspaces, each with real loading, empty, error,
  permission-denied and populated states.
- `src/messages/` holds the EN / FR / AR catalogue. The English file is the
  source of truth and the others are typed as `Messages`, so a missing key
  is a **compile error**. A test asserts key parity across locales.
- Arabic sets `dir="rtl"` on the document. Layout uses CSS logical
  properties, so spacing, borders and icon direction mirror correctly.

## 6. The design system

`Design.md` (owner-supplied) is the source of truth. The tokens are
transcribed into `src/app/globals.css` as Tailwind v4 `@theme` variables:

| Token | Value | Use |
|---|---|---|
| `primary` | `#4bbdbd` | Main actions, active nav, chart focus |
| `primary-60` | `#6ccaca` | Hover |
| `primary-70` | `#8ad6d6` | Soft fills |
| `secondary` | `#4b4f58` | Body text |
| `tertiary` | `#3a3a3a` | Strong text, headings |
| `surface` | `#ffffff` | Page and card background |
| `surface-muted` | `#f7f8f9` | Section breaks |
| `border` | `#e5e7eb` | Cards and outlined controls |
| `error` | `#d9534f` | Validation and destructive states |

Type: Heebo throughout, with Noto Sans Arabic as the fallback for Arabic
glyphs. Buttons are 47px tall with a 7px radius; cards are 8px radius with
16px padding; chips are fully rounded. Shadows are minimal — structure comes
from spacing and borders, not elevation.

**Derived tokens** (documented as derived, not from `Design.md`). These exist
because the brand teal is a *fill* colour, and the same teal as *text* does
not clear WCAG AA. The brand hexes above are unchanged; only the colours
used for text and focus were re-derived:

| Token | Value | Why |
|---|---|---|
| `primary-ink` | `#17787b` | The teal used for *text*: 5.24:1 on white, 4.81:1 on the pale surface. |
| `error-ink` | `#b33834` | Error *text*: 5.95:1 on white, 5.20:1 on the error surface. The brand `#d9534f` stays for borders and badges. |
| `warning-ink` | `#7d5f1f` | Warning *text*: 5.95:1 on white, 5.49:1 on the warning surface. The brand `#9b762d` stays for borders and marks. |
| `success` | `#1f7a4d` | Success text and dots: 5.32:1 on white. |
| `muted-text` | `#6b727c` | Metadata: 4.86:1 on white, 4.57:1 on the app background. |

A white label on `#4bbdbd` is 2.25:1 and fails, so a button on the brand
teal carries the deep ink `#3a3a3a` (the owner's own tertiary colour) as
its label — 5.04:1 at rest, 5.92:1 on hover, 6.86:1 when pressed. The focus
ring uses `primary-ink` for the same reason.

Also derived: `pale` (`#eaf8f8`, teal-tinted panel) and `error-surface`
(`#fdeceb`). The warning pair exists because `Design.md` defines only an
error colour, and a degraded integration must never be mistaken for a
healthy one.

### A Tailwind v4 trap worth knowing about

Tailwind v4 treats `--spacing-<name>` as **the spacing scale** used by every
size utility: `p-`, `m-`, `gap-`, `w-`, `max-w-` and the rest. Declaring
`--spacing-md: 24px` to expose `Design.md`'s spacing scale therefore
redefines `max-w-md` from `28rem` to `24px` — and every container in the
product silently collapses.

`Design.md`'s spacing scale (6 / 14 / 24 / 50 / 100 px) is therefore
declared **outside** Tailwind's namespaces, as `--ccm-space-*` in `:root`,
and used for page-level section rhythm. The application uses Tailwind's
default scale for component rhythm. This was found by the end-to-end suite,
which caught a zero-width form on the sign-in screen.

## 7. Dependency direction and the version pins

| Package | Version | Why |
|---|---|---|
| `next` | 16.4.2 | App Router, server components, route handlers |
| `react` / `react-dom` | 19.3.1 | — |
| `@supabase/supabase-js` | 2.118.0 | Auth, PostgREST, RLS enforcement |
| `@supabase/ssr` | 0.12.7 | Cookie-based sessions in the App Router |
| `tailwindcss` | 4.3.3 | CSS-first `@theme` tokens |
| `recharts` | 3.10.1 | Responsive, accessible charts |
| `zod` | 4.6.7 | Request and provider-response validation |
| `jose` | 6.2.13 | ES256 launch-ticket signing |
| `lucide-react` | 1.60.0 | Icon set |
| `date-fns` | 4.4.0 | Date handling in reports |
| `vitest` | 5.0.5 | Unit and contract tests |
| `@playwright/test` | 1.64.1 | End-to-end tests |
| `typescript` | 5.9.3 | Pinned below 6.1.0 because `eslint-config-next`'s bundled `typescript-eslint` requires `>=4.8.4 <6.1.0` |

**No UI kit.** The primitive layer in `src/components/ui/` is written
directly against the design tokens, using native HTML elements with
correct ARIA. Radix/shadcn were not added: the design system's whole point
is that nothing looks like an unmodified template, and a small in-house
layer gives exact control with fewer dependencies.

## 8. Portability to a VPS

The schema is proved before it ever reaches a database. `npm run db:validate`
applies every migration and then the repair — twice, to prove idempotence —
to **a real PostgreSQL** (PGlite, PostgreSQL compiled to WebAssembly), and
checks the helper functions, the policies, the privileges and the seed
counts. The same check runs in `tests/contract/sql.test.ts`.

It is not decoration. It has caught four SQL faults that no TypeScript test
could see, and every one of them would have stopped the owner on the first
run:

| Fault | Symptom |
|---|---|
| A bare `{...}` array literal | `syntax error at or near "{"` — the brace form is only valid in a *value context*, and inside a `VALUES` row each element is an expression |
| An unclosed `array[` constructor | The row was terminated a column early, so the seed was silently misaligned |
| An alias mismatch (`p.permission` where the row was aliased `r`) | `missing FROM-clause entry for table "p"` |
| An empty array with no explicit cast | `cannot determine type of empty array` |

The rule they share: **in a `VALUES` row, use the `ARRAY[...]` constructor
with an explicit cast, never the brace form and never `array(...)`.**

The domain logic, provider adapters and repositories have no framework or
Supabase-specific imports. The Vercel-specific pieces are confined to
route handlers and the cron dispatcher.

- `Dockerfile` and `docker-compose.yml` run the app and a worker.
- `docs/deployment/vps.md` documents the self-hosted Supabase profile and
  lists the capability differences honestly.
- The provider APIs, callback base URLs, job driver, storage and public
  origin are all environment-configurable.

See `docs/deployment/vps.md` for what genuinely differs.
