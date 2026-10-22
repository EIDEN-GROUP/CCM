# Security

CCM handles advertising credentials, mailbox access and a health-adjacent
business. This document states the controls that are implemented, the ones
that are pending, and how to verify them.

---

## 1. The threat model

| Adversary | What they want | Primary control |
|---|---|---|
| A user of the workspace | Another user's data, especially mailboxes and restricted sites | Row Level Security, enforced in the database, not the UI |
| Anyone on the internet | A credential, a token, a launch redirect | Server-only secrets, short-lived signed launch tickets, host allowlists |
| A malicious or compromised provider | Data exfiltration | No provider payload is trusted without validation; provider text is never rendered as HTML |
| A curious third party with a CCM URL | To see Medical Bay's data | Invite-only auth, default-deny RLS, `noindex` |
| An operator with database access | To read provider tokens | Tokens are encrypted with a key held outside the database |
| A phishing page | To use CCM as a link launcher | The server builds every URL; the client cannot supply one |

## 2. Row Level Security

**Default deny.** RLS is enabled in the same migration that creates each
table, so no table ever exists unprotected. Policies exist only where a
specific role grants a specific permission.

Two authorisation layers, both enforced by the database:

1. **Workspace role** → feature permissions (`ads.read`, `inbox.send`, …).
2. **Account grant** → per-account scoping for account-scoped roles such as
   `mailbox_user`.

A repository cannot bypass this: repositories use the request's
RLS-scoped client. The service-role client exists only for the sync worker
and for administrative scripts, and is never used to serve a user-facing
response.

### Verifying it

```bash
# Point the suite at the project and opt in to its fixture writes
CCM_RLS_ALLOW_WRITE=1 npm run test -- tests/rls
```

`tests/rls/rls.test.ts` creates real users through the admin API, real
workspaces, members with each role, real websites, connections, accounts,
mailboxes and audit rows, then **signs in as each user with a genuine access
token** and asserts both what the user *can* and *cannot* see. Going through
the real PostgREST path is stronger than a raw SQL session, because it is
exactly the request shape an attacker would use.

It covers: cross-workspace isolation, an outsider with no membership,
credentials being invisible to an authenticated user, the audit log being
permission-gated, an account-scoped role seeing only its granted account,
a mailbox user seeing only its granted mailbox, write attempts on
permission-gated tables, and metric tables being invisible without the
matching permission.

The suite writes fixture rows and deletes them, so it refuses to run without
`CCM_RLS_ALLOW_WRITE=1`. It also checks up front that the authorisation
layer is installed, and fails with one actionable message rather than a wall
of confusing assertion failures.

## 3. Secrets

- Server-only secrets live in environment variables supplied by the hosting
  provider's secret store. They are never in git, never in a public env var,
  never in a client bundle, and never logged.
- `.env.local` and `.env.*.local` are gitignored. `.env.example` contains
  **names only**.
- `NEXT_PUBLIC_` is the only prefix that may reach the browser, and only
  four variables use it: the app URL, the Supabase URL, the Supabase anon
  key and the browser bridge extension id.
- The service-role key is used only by the sync worker and admin scripts.
- Structured logs are redacted before writing; no log line contains a
  token, a cookie, a message body or a patient identifier.

## 4. Credential encryption

Two kinds of secret are stored:

| Secret | Where | How it is protected |
|---|---|---|
| The **provider's** client secret | `provider_app_credentials.encrypted_secret` | AES-256-GCM, with the row id as additional authenticated data, so it cannot be moved to another provider. |
| The **access and refresh tokens** a provider issues | `provider_connection_credentials.encrypted_secrets` | AES-256-GCM, with the connection id as additional authenticated data. |

The provider app credentials are the ones the owner enters in the
interface — **Settings → Provider apps** — so that connecting a provider
does not need a redeploy. They are deployment configuration, and they used
to live in `.env`.

Their properties:

- The secret is **never returned by any endpoint**. The listing shows
  whether a secret is stored, not the secret. The field says "leave blank
  to keep the stored one", and an empty field clears it.
- Only somebody with `settings.manage` may read or change them. The OAuth
  routes read the secret with the service role after their own permission
  check, so a person who may *manage a connection* does not need
  *settings access*.
- The change is written to the audit log as a **warning**, because it is
  the one action that gives a new party access to a provider.
- The environment is still honoured as a fallback, so a deployment that
  sets `GOOGLE_OAUTH_CLIENT_ID` and friends keeps working.

## 4a. Connecting a provider

One engine serves Google, Meta and LinkedIn. The differences between them
— endpoints, the scope parameter, PKCE support, how the code is redeemed,
how the accounts are found — are in `src/lib/oauth/registry.ts` and
`src/lib/oauth/discovery.ts`.

What the flow guarantees:

- **The scopes are the union of the products the owner chose, and nothing
  more.** A Search Console connection never asks for the Ads scope. The
  scope list is asserted in a test.
- **The state is sealed** with AES-256-GCM, single use, and bound to the
  provider, the user and the workspace. A callback whose state does not
  match, that comes from another provider, or that comes from another
  workspace is refused.
- **The code is redeemed server-side.** The browser never sees a token, and
  the client secret is only ever used on the server.
- **The accounts are discovered, not assumed.** CCM asks the provider
  which Pages, accounts or mailboxes the credential can reach. If the
  answer is none, **no connection is created**. A connection that says
  "connected" but can read nothing is the failure this prevents.
- **The authorisation is audited.**

The **Check** action on a connection row asks the provider whether it
still accepts the credential, and records the answer on the connection. A
connection can say "connected" and still be useless — the token was
revoked, the app lost its permissions, the account was unlinked — and only
the provider can settle that.

Provider refresh tokens are encrypted with **AES-256-GCM** before they reach
Postgres.

```
envelope = version(1) | iv(12) | authTag(16) | ciphertext     → base64
```

The **additional authenticated data** binds the ciphertext to the record
(`provider_connection_credentials:<connection-id>`), so a token cannot be
moved between rows by anyone with write access to the table.

The key (`APP_ENCRYPTION_KEY`, 32 bytes, base64) lives in the host's secret
store, **outside the database**, and only the provider worker can
decrypt. `tests/` and the RLS suite assert that no authenticated client can
read `provider_connection_credentials` at all — the table has RLS enabled
and no policy for the `authenticated` role.

Rotation is a planned operation, not an automatic one; the procedure is
described in `src/lib/crypto.ts` and the key ID is recorded per row.

## 5. OAuth

- Exact redirect URIs. No wildcards.
- CSRF-resistant `state` on every authorisation request.
- PKCE wherever the provider supports it.
- The issuer, audience, scope and expiry are validated on the callback.
  A replayed callback is refused.
- A client-posted token or account id is never trusted. The callback
  exchanges the code server-side and the account is read from the database
  under RLS.
- The minimum scopes are requested, read-only first.
- **The authorisation attempt is sealed, not merely signed.** The `state`
  nonce, the PKCE verifier, the requested products and the workspace id
  travel to Google and back in an AES-256-GCM sealed cookie
  (`src/lib/oauth/state.ts`), with the application encryption key as the
  key material and the cookie's purpose as additional authenticated data.
  The PKCE verifier therefore never appears in a query string, a browser
  history or a referrer header. The seal is single use — the callback
  deletes the cookie whatever happens — and an attempt older than ten
  minutes is refused.
- The callback re-checks that the workspace the attempt started in is still
  the workspace the user is signed in to, so a callback cannot be replayed
  into a different workspace.
- Restricted scopes (some Gmail scopes) may require Google verification or
  a security assessment. This is tracked as a **launch blocker** in
  `docs/integrations/connector-capability-matrix.md`, not as a footnote.

## 6. The account launcher

The launcher is the highest-risk surface in the product, because it opens
third-party pages. Its controls are described in full in
`docs/account-launcher.md`; the security properties are:

- **The client never supplies a URL.** It sends an account id. The server
  loads the account's stored identifiers, builds the URL from the provider
  registry, and validates the scheme and hostname.
- **Only `https:`** is allowed. `http:`, `javascript:`, `data:` and `file:`
  are rejected.
- **Exact hostname match** against the provider allowlist. A suffix or
  substring test is deliberately not used, so `evil-analytics.google.com`
  and `analytics.google.com.evil.test` are both refused.
- **Short-lived signed tickets.** ES256, 60-second TTL, bound to the user,
  the account, the destination host and the path, with a unique `jti`.
- **Single use.** The extension keeps a session-scoped replay set; the
  server marks the ticket consumed in Postgres. A replay is refused on both
  sides.
- **Asymmetric verification.** The extension holds only the public key. It
  can verify a ticket but cannot mint one.
- **The extension reconstructs the URL from the ticket**, so it cannot be
  talked into opening an arbitrary address.
- **Origin pinning.** `externally_connectable` lists the local development
  origin and the exact production origin. The extension re-checks the sender
  origin independently of the manifest.
- **The local helper is bound to loopback.** It listens on `127.0.0.1` only,
  so it is not reachable from the network. It answers CORS preflights only
  for the paired origin, so another site cannot use it to launch anything.
  It pins CCM's public verification key at pairing time and verifies every
  ticket itself — issuer, audience, expiry, signature and host allowlist —
  before it will open anything. It never receives a URL.

### What the launcher does not do

It does not read cookies, export cookies, store cookies, read passwords,
collect MFA codes, or bypass a CAPTCHA or an MFA challenge. When a provider
session has expired, the provider shows its own sign-in screen and CCM says
so plainly.

## 6a. Sending mail

Sending is the one action in CCM that leaves the system, so it is the one
action that is deliberately two-step:

1. **Prepare.** A draft is created **in the provider**, and CCM returns a
   sealed confirmation that binds that draft to this user, this workspace
   and this mailbox for five minutes. The draft lives in Gmail, so nothing
   is lost if the confirmation expires.
2. **Confirm.** The interface shows the resolved recipient, the sending
   identity and the subject. Only then is the draft sent.

The confirmation is sealed with AES-256-GCM under the application encryption
key, with the purpose as additional authenticated data. A confirmation that
is missing, tampered with, expired, minted for another user, or minted for
another workspace is refused. The mailbox is re-resolved through Row Level
Security at the send step, so a mailbox the user has since lost access to
cannot be sent from.

Every send is written to the audit log with the recipient, the subject and
the provider's message id.

Message **bodies** are never stored. Reading a thread is a provider round
trip: the bodies are shown and forgotten, and only the metadata is cached so
the mailbox list can be drawn without a request per thread.

## 6b. Provider quota

A provider with an operations quota is checked **before** the call, not
after the provider rejects it. The counter is incremented through an atomic
SQL function, so two workers cannot lose an update. When the quota is
spent, the job is deferred rather than failed — the work is still wanted,
the provider's window decides when it runs — and the connection is marked
`rate_limited` so the Integrations screen says so.

## 6c. Redirects

The sign-in form carries a `next` parameter so a person lands back where
they were. It is **validated, not trusted**: `src/lib/safe-redirect.ts`
accepts only a path within the application.

```
/login?next=https://evil.test   → refused
/login?next//evil.test           → refused
/login?next/\evil.test           → refused
/login?next=/overview            → allowed
```

Without that check, a crafted link would send a person who has just typed
their password to somebody else's site — a phishing primitive that costs
them their session. The proxy overwrites `next` with the path it actually
redirected from, so the value is internal by construction as well as
validated.
## 6d. Who may change what

The **owner** is the only role that may change a role. It holds
`roles.manage`, and that permission is deliberately withheld from the
administrator: an administrator runs the operation, not the authority.

The owner edits **tabs** — view, use or edit — and the feature permissions
the database enforces are derived from those levels. The derivation is one
function, so the interface and the Row Level Security policies cannot
disagree about what a role may do.

Four things are protected from a mistake:

| | |
|---|---|
| **The owner's role** | Not editable. It always holds every permission, so the workspace can always be administered. |
| **The people tab** | Its permission comes from the role, not from the tab, so granting the tab to the administrator cannot hand over the authority to change roles. |
| **The last owner** | The owner cannot be demoted, suspended, or have their role changed. The workspace would have no administrator. |
| **Your own access** | The owner cannot suspend themselves, and a person cannot be given the owner role through the interface — the owner is whoever made the workspace. |

Adding a person creates a confirmed account with a generated password that
is shown **once** and is never stored, logged or sent anywhere. The
membership, the role and the password are all recorded in the audit log,
because adding somebody to a workspace is a security event.

**The grants belong to the workspace.** `role_permissions` and
`role_tab_access` are keyed by `(workspace_id, role, …)`, and the
authorisation helpers join on the workspace as well as the role. The role
catalogue — the names and the labels — is global, because the same eight
roles mean the same thing everywhere; who may do what is decided per
workspace. Without that scoping, the owner of one workspace could change
what a role meant in another.

**The interface is not the authority.** The session reads the permissions
from `role_permissions` in the database, not from a map in the code, so an
edit made in the role editor takes effect at once and the interface and
the policies cannot drift apart.
## 7. Session and access control
- Invite-only. There is no sign-up path, and the sign-in failure message is
  deliberately generic so the form cannot be used to enumerate accounts.
- MFA and passkeys are supported by Supabase Auth; CCM's RLS can be
  tightened to require an `aal2` assertion, exactly as the
  `site-analytics-tool` reference does.
- Session cookies are `httpOnly`, `secure` and `sameSite=lax`.
- Responses that carry auth cookies are marked
  `Cache-Control: private, no-cache, no-store, must-revalidate` so a CDN or
  reverse proxy cannot serve one user's session to another.
- Route permissions are re-checked server-side at execution time. A
  high-trust action never relies on a permission checked only when the page
  rendered.

## 8. Transport and headers

`next.config.ts` sets, on every route:

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
Content-Security-Policy: default-src 'self'; ...; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
```

The CSP `connect-src` is limited to the Supabase origin, so a compromised
dependency cannot exfiltrate data to an arbitrary host.

## 9. Application-level security

| Risk | Control |
|---|---|
| SQL injection | No string-built SQL. Supabase's query builder parameterises; the only raw SQL is in fixed, parameterised migration functions. |
| SSRF | Provider base URLs are constants in the adapter. The launch URL builder rejects any host outside the allowlist. |
| Open redirect | The launcher server-side; the locale endpoint accepts only a known locale. |
| XSS | React escapes by default. No `dangerouslySetInnerHTML` anywhere. Provider text is rendered as text, never as HTML. |
| CSV formula injection | The export writer prefixes a leading `=`, `+`, `-` or `@` with a quote. |
| IDOR | Every read is RLS-scoped. The launcher returns the same 404 for "not found" and "not permitted", so it cannot be used to probe for account ids. |
| Webhook spoofing | No inbound provider webhooks are consumed in this release. When they are added, the signature, timestamp and idempotency key must all be verified. |
| ZIP / file upload | No file upload feature exists in this release. |

## 10. What is not yet verified

Being explicit, because a security claim that has not been tested is a
hypothesis. The state below was measured against the live Supabase project on
**20 October 2026** with `npm run doctor`.

### Verified

- **The tables exist** and the application reads through the RLS-scoped client.
- **The seed is applied**: 8 roles, 97 role permissions, 13 provider
  definitions, 22 metric definitions. `tests/unit/seed-consistency.test.ts`
  asserts the TypeScript matrix and the seed agree.
- **The service-role key cannot see through RLS from the client side** — an
  authenticated request to `provider_connection_credentials` returns nothing,
  and that table has a policy that denies every authenticated role.
- **The launch ticket security properties hold** (unit-tested): a valid ticket
  verifies; a tampered payload, a foreign key, a malformed token and an
  `alg: none` token are all rejected; the destination is rebuilt from the
  ticket rather than trusted from the caller.
- **The URL allowlist holds** (unit-tested): `http:`, `javascript:`,
  `evil-analytics.google.com` and `analytics.google.com.evil.test` are all
  rejected.
- **The 20 end-to-end tests pass** against a production build, on desktop and
  mobile Chromium.
- **The CSV writer resists formula injection** (unit-tested): a leading
  `=`, `+`, `-` or `@` is neutralised, so a hostile keyword or campaign name
  cannot execute a formula in the operator's spreadsheet. Share safe mode
  masks customer, mailbox and sensitive account identifiers by default.
- **The OAuth state is sealed** (unit-tested): the payload round-trips, a
  tampered value is refused, an absent value is refused, and an attempt older
  than ten minutes is refused.
- **The AI analyst refuses to answer without data** — with no synced records
  it says so rather than filling the gap, and the request and its source
  list are stored so the trail can be inspected.
- **The send confirmation cannot be forged or replayed** (unit-tested): the
  payload round-trips, a token minted for another purpose is refused, a
  tampered token is refused, an expired token is refused, and the payload is
  not readable in the token itself.
- **The Arabic interface renders right to left** (verified in a browser, on
  desktop and mobile): the document direction is `rtl`, the Arabic typeface
  is applied, and the locale survives a reload. The sign-in screen has
  visual-regression baselines in both directions.
- **The Row Level Security policies hold** (tested against a real
  PostgreSQL): a read-only member sees the connection catalogue and not the
  credential table or the audit log; an account-scoped role sees exactly the
  account and the mailbox it was granted, and not the connection catalogue;
  a member of another workspace sees nothing. The tables the policies
  govern are granted to the `authenticated` role, so the *policies* decide
  what is visible rather than a privilege error — and
  `provider_connection_credentials` is granted to nobody but the service
  role.

### Not verified — and what is blocking each

| Item | Status | Blocker |
|---|---|---|
| **The RLS authorisation layer on the live project** | **Installed**, and the tables all exist. Five faults have been found and fixed since: an account-scoped role could not read the account it had been granted; a read-only member could not see the connection catalogue; the launch ticket had no UPDATE policy, so the update that marks a ticket consumed matched no rows and the replay guard never fired; the role grants were deployment-global, so one workspace's owner could change what a role meant in another; and the application read its permissions from a hard-coded map while the database enforced a different set, so an edit made in the role editor had no effect. | Re-apply `supabase/repair.sql`. It is idempotent, so re-applying to a healthy project changes nothing. The fix adds `can_read_account`, grants `integrations.read` to the roles that may see the catalogue, adds the missing `launch_tickets` UPDATE policy, and scopes the role grants to the workspace. |
| **The RLS isolation suite** | 11 of 14 pass against the live project. The three failures are the first three faults above, and they are proved fixed in `tests/contract/sql.test.ts`, which exercises the real policies against a real PostgreSQL. | Re-apply the repair, then the suite should be 14 of 14. |
| **The repair file itself** | **Proved.** Every migration and the repair are applied to a real PostgreSQL — PGlite, PostgreSQL compiled to WebAssembly — twice, and the seed counts, the helper functions, the policies and the privileges are checked. The same check runs in the test suite. | Nothing. It has caught four SQL faults that no TypeScript test could see. |
| **The launch signing key** | **Truncated.** The public key in `.env` carries 60 base64 characters where P-256 needs 124, so it cannot be imported. | Regenerate with `npm run keys:launch` and paste the result. The loader now rebuilds the PEM from its BEGIN/END markers, so quotes, escaped newlines and stray backslashes are all tolerated — but a *truncated* body cannot be recovered. |
| **The OAuth round trip** | Not exercised. The state sealing, PKCE pair generation, constant-time `state` comparison and scope selection are unit-tested; the live exchange with Google is not. | Needs the Google Cloud project and an OAuth client. |
| **The browser bridge extension in a browser** | Not loaded. Its verification logic is unit-testable and the ticket path is covered, but `chrome.runtime` needs a manual pass. | Load `apps/ccm-browser-bridge` unpacked and run the launch acceptance tests. |
| **The local helper** | **Started and proved** in isolation: it boots, prints a pairing code, refuses a wrong code, pins the origin and the public key on a correct one, and refuses a launch from another origin or with no origin at all. It had never been started at all before — a TypeScript annotation in a `.mjs` file made it impossible to run. | It has still never opened an account in a real browser profile. Run `apps/ccm-helper`, pair it, and confirm a cross-profile launch opens the intended profile. |
| **The migrations against a live database** | The repair file is generated and reviewed, but DDL cannot be applied from this environment. | `supabase db push` with project access, or the SQL editor. |
| **Supabase's own security and performance advisors** | Not run. | Run them after the repair, and record the findings. |
| **The provider connectors against live accounts** | Contract-tested only. | The Google, Meta, LinkedIn and Ahrefs credentials are not yet populated in `.env`. |
| **The AI analyst's grounding** | The context builder, the source list and the "no data, no answer" path are implemented and reviewed; the model has never been called with real synced data, because there is no synced data yet. | Connect a provider, let the first sync complete, then ask a question and check the cited sources against the tables. |

## 11. Dependency and licence review

Every runtime dependency is pinned exactly and is MIT, ISC or Apache-2.0.
There is no copyleft dependency in the shipped application. See
`docs/research/open-source-reference-notes.md` for the licence inventory of
the reference projects.

Run `npm audit` and the Supabase advisors before each release, and record
any finding that is not fixed with a written justification.

## 12. Secret rotation

| Secret | Rotation procedure |
|---|---|
| `APP_ENCRYPTION_KEY` | Re-encrypt every row in `provider_connection_credentials` under the new key, then swap the environment variable. The per-row key fingerprint detects a partial rotation. |
| `LAUNCH_SIGNING_PRIVATE_KEY` / `LAUNCH_SIGNING_PUBLIC_KEY` | Generate a new pair, publish the new public key, update the extension's pinned key, then swap the environment variable. Tickets signed by the old key stay valid only for their 60-second lifetime, so the cutover is effectively instant. |
| `CRON_SECRET` | Replace in the environment and in the scheduler configuration. |
| Provider OAuth clients | Revoke the old client in the provider console, then update the environment. Existing refresh tokens are invalidated by the provider. |
| Supabase service-role key | Rotate in the Supabase dashboard, then update the environment. |
