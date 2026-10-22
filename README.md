# CCM — Command Center Medicalbay

A production-grade marketing and business-operations command centre for
**Medical Bay**, a medical-tourism coordination business in Agadir, Morocco.

CCM consolidates authorised data from websites, advertising accounts,
analytics properties, search sources, social accounts and mailboxes into one
interface — with a secure, verified **account launcher** that opens each
connected account in the right browser profile.

> **Working title.** `CCM — Command Center Medicalbay` is a working name.
> Product naming is deliberately left open for a later branding decision.

---

## What it is not

CCM is a **marketing command centre**. It is not an electronic health
record, not a patient-management system and not a clinical decision tool.
Patient names, phone numbers, health details and free-text enquiries never
reach the analytics layer, an ad platform, a URL parameter or an AI prompt.

See `docs/PRIVACY-DATA-FLOWS.md`.

## Status

| Area | State |
|---|---|
| Design system, app shell, 19 screens | Implemented, with real loading / empty / error / permission states |
| Auth, invite-only access, role + account-grant model | Implemented |
| Database schema, 18 migrations, RLS, seed data | Written. **The live project needs `supabase/repair.sql` — see below.** |
| Connector framework, durable job queue, backoff, dead-letter | Implemented, and the worker **runs the adapters** |
| Adapters: GA4, Search Console, Google Ads, GTM, Ahrefs, Meta, Instagram, LinkedIn, Gmail, PageSpeed, uptime/SSL | Implemented; GA4, Search Console and Google Ads are contract-tested against recorded provider responses |
| Google OAuth (PKCE, sealed state, server-side exchange, encrypted token) | Implemented |
| **Meta and LinkedIn OAuth** (Facebook Pages, Instagram, organisation) | Implemented, with the same engine, the same sealed state and the same server-side exchange |
| **Provider apps set up in the interface** — client id and secret entered in Settings, encrypted at rest, no redeploy | Implemented |
| **Live connection check** — the provider is asked whether it still accepts the credential | Implemented |
| Unified inbox: provider-side search, paging, thread reading, drafts, reply, confirm-before-send, audit trail | Implemented; message bodies are fetched on demand and never stored |
| Account launcher: registry, tickets, URL validation | Implemented and unit-tested |
| Browser bridge extension (Manifest V3) | Implemented, **not yet loaded in a browser** |
| Local helper (cross-profile launches) | Implemented; **now boots and its pairing and origin checks are proved** — it had never been started, because of a stray TypeScript annotation in a `.mjs` file |
| **Owner-managed people, roles and per-tab access** — add a person, give them a role, and set each role to none / view / use / edit per tab | Implemented. The levels are derived into the permissions the database enforces, so they are the real control, not a label |
| RLS authorisation suite | Written; **fails loudly** until the authorisation layer is applied |
| Reports, CSV export, print/PDF | Implemented |
| Scheduled digests — daily, weekly, monthly — built by the worker and stored | Implemented |
| Grounded AI analyst with an inspectable source trail | Implemented; gated on a model key |
| Alerts, rules, evaluation, action queue | Implemented |
| Provider quota: checked before the call, deferred rather than failed | Implemented |
| Demo mode with labelled fixtures | Implemented, off by default |
| **English, French and Arabic, all actually used** — the screens were wired to the catalogue | Implemented; 19 screens, right-to-left verified in a browser |
| **A phone layout** — the rail was a fixed 248px column, leaving 95px of content on a 375px phone | Implemented: an off-canvas drawer, a working mobile search, a topbar that wraps |
| **WCAG AA colour** — sixteen pairings failed, including every primary button | Fixed; the brand teals are unchanged, the *text* and *focus* colours were re-derived |
| **Honest metrics** — a missing number read as zero, and a failed query read as "no data" | Fixed: unknown reads as unavailable, a partial period says so, and a failed query shows an error |
| Arabic RTL, verified in the browser; visual regression baselines | Implemented |
| Docker / VPS profile | Documented and scaffolded |

**No provider is connected to a live account yet.** Every connector shows
`Needs setup` with its own checklist, because that is the truth. Nothing in
this product reports synthetic data as if it were real.

### Three things must be applied before CCM is usable

Both are one command each, and `npm run doctor` reports on both.

**1. The database authorisation layer.** The live Supabase project has the
tables and the authorisation layer, but several faults have been found and
fixed since — three wrong policies, a missing policy that stopped the
launch ticket's replay guard from firing, role grants that were scoped to
the deployment rather than to the workspace, and a missing tab map. Re-apply
the repair — it is idempotent, so running it against a healthy project
changes nothing:

```bash
# paste supabase/repair.sql into the Supabase SQL editor and run it, or:
psql "$DATABASE_URL" -f supabase/repair.sql
# or, with a management token:
SUPABASE_ACCESS_TOKEN=sbp_... npm run db:repair:apply
# or, with a direct connection string:
npm run db:repair:apply:direct
```

`supabase/repair.sql` is generated from `src/domain/seed.ts`, so the SQL and
the application cannot drift. It creates the alert tables, the provider-app
credentials table, the per-role tab map, the helper functions, all the
policies, the table privileges those policies need and the seed data, and
ends with `notify pgrst, 'reload schema'` so PostgREST picks the change up
immediately.

**Before you run it, the file is proved.** `npm run db:validate` applies
every migration and then the repair — twice — to a real PostgreSQL
(PGlite, PostgreSQL compiled to WebAssembly) and checks the result. The
same check runs as part of the test suite. It has already caught four SQL
faults that no TypeScript test could see: a bare `{...}` array literal, two
unclosed `array[` constructors, an alias mismatch, and an empty array with
no inferable type.

**2. The launch signing key.** The key pair in `.env` is **truncated** — the
base64 body is 60 characters where a P-256 public key needs 124 — so the
account launcher cannot sign or verify a ticket. Regenerate and paste it:

```bash
npm run keys:launch
```

Then check everything at once:

```bash
npm run doctor
```

**3. A provider's own app.** The connectors call the providers' APIs
directly, so each one needs credentials that only the provider can issue.
The quickest is a Google OAuth client: one app unlocks Search Console,
GA4, Tag Manager, Google Ads and Gmail, and it needs no review. Enter it in
**Settings → Provider apps** — the client id and the secret are encrypted
before they are stored, so no redeploy is needed. See "Connecting a
provider" below.

## Quick start

```bash
npm install
cp .env.example .env.local     # fill in the values
npm run dev                     # http://localhost:3000
```

Without a configured Supabase project, `/setup` opens and names exactly
which variables are missing.

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm test            # unit + contract tests (vitest)
npm run test:e2e    # playwright
npm run build       # production build
```

Apply the schema and run the authorisation suite:

```bash
supabase db push --db-url "$DATABASE_URL"      # or: npm run db:migrate
npm run db:types                                  # regenerate the typed client
DATABASE_URL="$DATABASE_URL" npm run test -- tests/rls
```

## Architecture at a glance

```
Browser ── CCM web app (Next.js)          ──► Vercel or a container
        └─ CCM Browser Bridge (MV3)        ──► opens the exact provider account
                        │
                        ▼
              Supabase: Auth · Postgres + RLS · Cron
                        │
                        ▼
              Worker: bounded, leased, retried sync jobs
                        │
                        ▼
              Google · Meta · LinkedIn · Ahrefs · Clarity
```

- **Modular monolith.** `src/domain` (pure) → `src/providers` (adapters) →
  `src/repositories` (RLS-scoped data) → `src/app` (routes). One-way
  dependencies, no microservices.
- **Durable queue in Postgres.** Jobs are claimed with `FOR UPDATE SKIP
  LOCKED`, leased, retried with jittered backoff, and dead-lettered.
  Nothing lives in an in-memory array.
- **Default-deny RLS.** Every table is protected in the same migration that
  creates it. Two authorisation layers: a workspace role and an optional
  per-account grant.
- **A metric registry.** Every number states its formula, source field,
  grain, currency, timezone, attribution caveats and freshness. Missing
  data is `null`, never `0`.
- **Three languages, actually used.** English, French and Arabic, with
  right-to-left verified in a browser. The catalogue is split per group so
  it can be edited by more than one person; the three locales must have
  the same shape, and the type system says so.
- **A daily Vercel cron by default.** The Hobby plan allows only one cron
  invocation a day, so `vercel.json` runs the dispatcher at 03:00 UTC. The
  dispatcher reports its backlog, and `docs/deployment/vercel-supabase.md`
  has the Supabase scheduler recipe for a fifteen-minute cadence on the
  same plan.

Full detail: `docs/ARCHITECTURE.md`.

## The account launcher

The release-blocking feature. Clicking a connected Instagram, LinkedIn,
Facebook, Google Ads, GA4, Search Console, YouTube or Gmail account opens
**that exact account's destination** in a browser profile where the provider
session may still be valid.

**The server builds every URL.** The browser sends an account id; the
server loads the stored identifiers, builds the URL from the provider
registry, and validates the scheme and the hostname against an allowlist.
A client can never ask CCM to open an address it should not.

Two independent state machines, shown separately on every tile: the **API
connection** state and the **browser session** state. A valid API token does
not prove a browser session exists, and CCM never claims it does.

Three launch paths:

1. **Direct** — a new tab in the current browser profile. Works everywhere,
   installs nothing.
2. **Browser bridge extension** (`apps/ccm-browser-bridge/`) — a Manifest V3
   extension with one permission (`storage`), no cookie access, that
   verifies the signed launch ticket with the public key, re-checks the
   host against its own allowlist, and opens the tab in the profile where
   it is installed. It also verifies the launch and maps accounts to
   browser profiles.
3. **Local helper** (`apps/ccm-helper/`) — a small companion the owner runs
   themselves, for the case where an account lives in a browser profile that
   cannot host the extension. It binds to `127.0.0.1`, accepts only a signed
   launch ticket (never a URL), verifies the ticket against CCM's pinned
   public key, re-checks the host against its own allowlist, and opens the
   profile with the browser's own cookie store. It never reads cookies,
   passwords or MFA codes.

See `docs/account-launcher.md`, `apps/ccm-browser-bridge/README.md` and
`apps/ccm-helper/README.md`.

## People and roles

**Settings → People & roles** is where the owner controls access.

- **Add a person** by email. The account is created with a generated
  password that is shown **once** — it is never stored, logged or sent
  anywhere.
- **Give them a role**, and change it later.
- **Edit any role**, including the administrator's: for each tab, choose
  **none**, **view**, **use** or **edit**.

Those levels are not a cosmetic label. They are **derived into the feature
permissions the database enforces**, so what you see is what the Row Level
Security policies will actually allow. The navigation is derived from the
same registry, so a tab cannot exist without a navigation entry.

Four things are protected from a mistake: the owner's own role is not
editable, the people tab's permission comes from the role rather than the
tab, the last owner cannot be demoted or suspended, and nobody can hand
themselves or somebody else the owner role through the interface.

## Connecting a provider

### The first account

The product is invite-only, so the first person is made by a script rather
than by signing up:

```bash
npm run admin:create -- --email admin@medicalbay.ma
```

It creates the workspace if there is none, creates the account, confirms
it, attaches it to the workspace as `owner`, writes a **critical** audit
event, and prints a generated password **once**. `--reset-password` sets a
new one for an existing account; `--password` supplies your own.

`owner` and `admin` both hold all 21 permissions. `owner` additionally owns
the workspace — transfer, deletion — so with a single administrator, use
`owner`.

### The client id and the client secret live in the interface now

1. Open **Settings → Provider apps** (also linked from the Integrations
   screen when a provider has no app yet).
2. Paste the client id and the client secret of the provider's app. The
   secret is encrypted with AES-256-GCM before it is stored and is never
   shown again — the field says "leave blank to keep the stored one".
3. Register the redirect URI the screen shows with the provider.
4. Press **Connect** on the Integrations screen — the **Connect a provider**
   button lists every provider, says which ones are ready, and links to the
   ones that are not.

The Connect button starts the provider's own OAuth flow. One engine does
it for every provider: Google (Analytics, Search Console, Tag Manager, Ads,
YouTube, Gmail), Meta (Facebook Pages, Instagram) and LinkedIn
(organisation page).

What the flow guarantees:

- The scopes asked for are the **union of the products you chose**, and
  nothing more. A Search Console connection never asks for the Ads scope.
- The authorisation state is **sealed**, single use, and bound to the
  provider, the user and the workspace. A callback whose state does not
  match, or that comes from another workspace, is refused.
- The code is redeemed **server-side**. The browser never sees a token.
- The account is **discovered**, not assumed: CCM asks the provider which
  Pages, accounts or mailboxes the credential can reach. If the answer is
  none, **no connection is created** — a connection that says "connected"
  but can read nothing is the failure this avoids.
- Every send and every authorisation is written to the audit log.

**Check** on a connection row asks the provider whether it still accepts
the credential. A connection can say "connected" and still be useless —
the token was revoked, the app lost its permissions, the account was
unlinked — and only the provider can settle that.

### What still needs your own apps

The *code* is finished and tested. The *credentials* are yours to obtain:

| Provider | What it needs |
|---|---|
| Google | A Cloud project with the APIs enabled, and an OAuth client of type "Web application". |
| Meta | A Meta app with Facebook Login, the redirect URI registered, and the permissions you want. Reading Page or Instagram insights needs a live app and a review unless the account is yours. |
| LinkedIn | A LinkedIn app with "Sign in with LinkedIn" and the company pages product. **Organisation page analytics is a restricted partnership API** — without it the connection works but returns no figures, and CCM says so rather than substituting another number. |

`npm run doctor` lists every missing value and what it is for.

## Design

The interface follows the owner-supplied `Design.md` — the "Medicalbay Calm
Care" system. Teal `#4bbdbd` on white, Heebo throughout, generous
whitespace, 7–8px radii, restrained shadows, and a calm medical-hospitality
tone. Dark hacker dashboards and overdone glassmorphism are explicitly out
of scope.

The design tokens are transcribed into `src/app/globals.css`. English,
French and Arabic ship, with Arabic rendered right-to-left through CSS
logical properties. A test asserts every locale carries the same message
keys.

## Documentation

| Document | What it covers |
|---|---|
| `docs/ARCHITECTURE.md` | Modules, data model, sync engine, metric registry, design system, dependency pins |
| `docs/SECURITY.md` | Threat model, RLS, secrets, credential encryption, OAuth, the launcher's controls, what is **not yet verified** |
| `docs/PRIVACY-DATA-FLOWS.md` | The privacy boundary, every data flow, retention, the access matrix, the pre-launch checklist |
| `docs/account-launcher.md` | The launch path, tickets, the extension, multi-profile handling, the audit trail |
| `docs/integrations/connector-capability-matrix.md` | Per-provider capabilities, scopes, quotas, approvals and limitations |
| `docs/research/open-source-reference-notes.md` | The five reference projects, what was taken, the licence inventory |
| `docs/deployment/vercel-supabase.md` | The intended first deployment, end to end |
| `docs/deployment/vps.md` | The container profile, self-hosted Supabase, and what genuinely differs |

## Repository layout

```
src/
  app/            routes, server components, route handlers
  components/     shell, design system, launcher, charts, reports, AI
  domain/         pure logic — dates, currency, metrics, KPI math, tabs, roles, permissions, seed
  lib/            supabase clients, crypto, launch, jobs, oauth, ai, reports, demo
  messages/       en / fr / ar, with the `pages` namespace split per group
  providers/      connector contract, registry, adapters (google, meta, linkedin, ahrefs)
supabase/
  migrations/     18 SQL migrations
  repair.sql      generated: rebuilds the authorisation layer + the seed
apps/
  ccm-browser-bridge/   Manifest V3 extension
  ccm-helper/           local companion for cross-profile launches
tests/
  unit/           domain math, launch security, permissions, i18n, CSV, OAuth
  contract/       connector request shapes and normalisation
  rls/            Row Level Security authorisation suite
  e2e/            Playwright
docs/             the documents listed above
```

## Licence

CCM's own dependencies are pinned exactly and are MIT, ISC or Apache-2.0.
The reference projects reviewed during development are documented, with
their licences, in `docs/research/open-source-reference-notes.md`. No code
was copied from them.

## Before going live

1. Apply the migrations to a disposable database and read the SQL.
2. Run the RLS suite against the live database.
3. Authorise the Google Cloud project and apply for Google Ads access on
   the **Cloud Console** — the Ads API Center no longer processes
   applications.
4. Have counsel assess Morocco's Law 09-08 / CNDP obligations and any
   destination-country transfer rules.
5. Load the browser bridge extension and complete the launch acceptance
   tests in `docs/account-launcher.md`.
6. If you are on the Vercel Hobby plan, set up the Supabase scheduler for
   the fifteen-minute cadence — the Vercel cron can only run once a day
   there. `docs/deployment/vercel-supabase.md` has the exact SQL.
