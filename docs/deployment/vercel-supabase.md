# Deploying to Vercel + Supabase

The intended first deployment: **Next.js on Vercel**, **Supabase (Auth,
Postgres, RLS, Cron) for the backend**.

---

## 1. Create the Supabase project

1. Create a project at <https://supabase.com/dashboard>.
2. Choose the region closest to your users. Morocco and Western Europe are
   usually a good fit; the data location matters for a health-adjacent
   business.
3. Copy the project URL and the `anon` and `service_role` keys from
   **Project Settings → API**.
4. Keep the `service_role` key out of the browser. It is only used by the
   sync worker.

## 2. Apply the migrations

CCM ships twelve migrations under `supabase/migrations/`.

**Apply to a disposable database first.** Do not push to the production
project until you have read the SQL and confirmed it against a scratch
schema.

```bash
# Option A — the Supabase CLI against your cloud project
supabase link --project-ref <your-project-ref>
supabase db push --dry-run      # read the plan first
supabase db push                # apply

# Option B — psql directly
psql "$DATABASE_URL" -f supabase/migrations/20260101000001_core.sql
# ... and each file in order
```

The migrations create tables, enable RLS, create the policies and seed the
role matrix, the provider catalogue and the metric registry.

Then generate the typed client:

```bash
npm run db:types     # writes src/lib/supabase/database.types.ts
```

> The checked-in `database.types.ts` is hand-maintained so the project
> type-checks before a database exists. Regenerate it after the first
> `db push` and commit the result.

### 2a. If a migration aborted — apply the repair

A migration that fails part-way leaves the deployment in a state where
**some tables exist but the authorisation layer does not**, and every
signed-in user sees an empty product.

`supabase/repair.sql` fixes that. It is generated from `src/domain/seed.ts`,
so it cannot drift from the application. It creates the alert tables, the
five RLS helper functions, all 67 policies and the seed data, and ends with
`notify pgrst, 'reload schema'` so PostgREST picks the change up
immediately rather than at its next cache expiry.

```bash
# Option A — the Supabase SQL editor
#   open the project → SQL Editor → paste supabase/repair.sql → Run

# Option B — psql
psql "$DATABASE_URL" -f supabase/repair.sql

# Option C — the Management API, with a personal access token
SUPABASE_ACCESS_TOKEN=sbp_... npm run db:repair:apply
```

Regenerate it after changing the seed:

```bash
npm run db:repair:generate
```

### 2b. Check the result

```bash
npm run doctor
```

The doctor reports the environment, the launch signing key, the schema, the
authorisation layer and the seed in one pass. It also says exactly which
provider credentials are still missing.

## 3. Create the first user and workspace

CCM is invite-only, so the first user is created directly.

```sql
-- In the Supabase SQL editor
insert into public.workspaces (name, slug, timezone, currency)
values ('Medical Bay', 'medical-bay', 'Africa/Casablanca', 'MAD')
returning id;

-- Then, as the user you created in Auth → Users:
insert into public.workspace_members (workspace_id, user_id, role, status, invited_at)
values ('<workspace-id>', '<user-id>', 'owner', 'active', now());
```

The `owner` role holds every permission. From **Audit & Security** in the
app you can then invite the rest of the team and set their roles.

## 4. Configure the Google Cloud project

One Cloud project serves GA4, Search Console, GTM, Google Ads, YouTube and
Gmail.

1. Create a project at <https://console.cloud.google.com>.
2. **Enable the APIs** you need: Analytics Data API, Analytics Admin API,
   Search Console API, Tag Manager API, Google Ads API, YouTube Data API,
   YouTube Analytics API, Gmail API.
3. Configure the **OAuth consent screen**. Choose *Internal* while the
   app has a single workspace, so the test users list is not needed.
4. Create an **OAuth client** (Web application) with:
   - the exact redirect URI:
     `https://<your-vercel-domain>/api/auth/google/callback`
   - the local development URI: `http://localhost:3000/api/auth/google/callback`

> **The callback route is not implemented yet.** CCM has the OAuth
> *handling* — PKCE, `state`, the server-side code exchange, the encrypted
> refresh token and the connection record — but the `/api/auth/google/*`
> routes are part of Stage C and are not in the tree yet. Until they are,
> connections are recorded by the owner in **Integrations**, and the Google
> OAuth client is not needed. Treat the redirect URI above as the
> *destination the implementation will use*, not as a working route.
5. Note the client id and secret.

### Google Ads access — the September 2026 change

Developer tokens were **sunset on 9 September 2026**. Access is now granted
on the Google Cloud project:

| Level | What it allows | How |
|---|---|---|
| Test | 15,000 operations/day, **test accounts only** | Automatic on API enable |
| Explorer | Up to 2,880 operations/day, **production accounts** | Apply on the **Google Ads API Overview** page in the Cloud Console — automated review in most cases |
| Basic | Production, higher quota | Brand verification + manual review |
| Standard | Production, full quota | Manual review |

**Do not apply through the Ads API Center.** Applications submitted there
are no longer processed.

A project on Test access that calls a production account receives
`AuthorizationError.CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION` in API v25
and later.

## 5. Set the environment variables

Copy `.env.example` to `.env.local` for local work, and add the same
variables to the Vercel project settings.

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Vercel | `https://<your-vercel-domain>` — used for OAuth callbacks and the extension allowlist |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | **Server only.** Never expose. |
| `DATABASE_URL` | Vercel + local | Direct Postgres connection, for migrations and the RLS suite |
| `APP_ENCRYPTION_KEY` | Vercel | 32 bytes, base64: `openssl rand -base64 32` |
| `LAUNCH_SIGNING_PRIVATE_KEY` | Vercel | PKCS#8 PEM for an ES256 key |
| `LAUNCH_SIGNING_PUBLIC_KEY` | Vercel | SPKI PEM — also pasted into the extension |
| `LAUNCH_SIGNING_KEY_ID` | Vercel | Defaults to `ccm-launch-1` |
| `CRON_SECRET` | Vercel | `openssl rand -hex 32` |
| `GOOGLE_CLOUD_PROJECT_ID` | Vercel | |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` | Vercel | |
| `GA4_PROPERTY_ID`, `GSC_PROPERTY_URL`, `GTM_CONTAINER_ID` | Vercel | |
| `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_MANAGER_CUSTOMER_ID` | Vercel | |
| `GOOGLE_ADS_API_ACCESS_LEVEL` | Vercel | Display only: `test` / `explorer` / `basic` / `standard` |
| `NEXT_PUBLIC_BRIDGE_EXTENSION_ID` | Vercel | The published extension id |
| `BRIDGE_PAIRING_SECRET` | Vercel | |
| `GEMINI_API_KEY`, `AI_MODEL` | Vercel | Optional — without them the AI surface says "not configured" |

Generate the launch signing key pair:

```bash
openssl ecparam -name prime256v1 -genkey -noout -out launch-private.pem
openssl pkcs8 -topk8 -nocrypt -in launch-private.pem -out launch-private-p8.pem
openssl pkey -in launch-private.pem -pubout -out launch-public.pem
```

## 6. Deploy to Vercel

```bash
npm i -g vercel
vercel link
vercel env pull .env.local
# set the production values
vercel --prod
```

Or connect the Git repository in the Vercel dashboard and set the
environment variables there.

### The scheduled dispatcher

`vercel.json` defines a cron that dispatches a **bounded batch** of sync
jobs. It must be authorised with the `CRON_SECRET`:

```json
{
  "crons": [
    { "path": "/api/jobs/dispatch", "schedule": "*/15 * * * *" }
  ]
}
```

Vercel sends `Authorization: Bearer <CRON_SECRET>`; the route rejects
anything else. Vercel's cron sends the header automatically when
`CRON_SECRET` is set in the project environment.

> **Plan limitation.** The Vercel Hobby plan allows one cron invocation per
> day. On Hobby, change the schedule to `0 3 * * *` — the dispatcher still
> claims a bounded batch per run, so a daily dispatch simply means a larger
> batch per day. On a paid plan, keep the fifteen-minute schedule. The
> container worker (`scripts/worker.mjs`) polls continuously and is not
> affected by the Vercel cron limit at all.

> **Alternative.** Run the dispatcher from Supabase Cron instead. The route
> accepts the same bearer token, so only the caller changes.

### Set the Supabase auth URLs

In **Supabase → Authentication → URL Configuration**:

- Site URL: `https://<your-vercel-domain>`
- Redirect URLs: `https://<your-vercel-domain>/**` and
  `http://localhost:3000/**`

## 7. The browser bridge extension

1. Load `apps/ccm-browser-bridge/` unpacked, or publish it to the Chrome
   Web Store.
2. In `manifest.json`, replace `https://ccm.medicalbay.ma/*` with your
   real production origin.
3. Add the published extension id to `NEXT_PUBLIC_BRIDGE_EXTENSION_ID`.
4. In the extension's options page, enter the CCM origin and press
   **Save and verify key**.
5. Copy the instance id into **Account Launcher → Set up account launching**.

See `docs/account-launcher.md` for the full model.

## 8. Verify the deployment

```bash
# Lint, typecheck, tests and a production build
npm run lint
npm run typecheck
npm test
npm run build

# The Row Level Security suite, against the deployed database
DATABASE_URL="$DATABASE_URL" npm run test -- tests/rls

# The application is up
curl -sS https://<your-vercel-domain>/api/health
```

Then, in the browser:

- sign in as the owner;
- confirm the navigation shows the workspaces your role allows;
- open **Account Launcher** and press **Open account** on a real account;
- confirm the correct destination opened;
- with the extension installed, press **Test launch** and confirm the
  bridge reports the host it opened.

## 9. Going to production — the checklist

- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all pass.
- [ ] The RLS suite passes against the deployed database.
- [ ] The Supabase security advisor and performance advisor have been run
      and the findings reviewed.
- [ ] `npm audit` is clean, or every finding is documented.
- [ ] No secret appears in the client bundle: `grep -r "service_role" .next`
      returns nothing meaningful.
- [ ] `APP_ENCRYPTION_KEY` and the launch keys are in the Vercel secret
      store, not in a `.env` file committed to git.
- [ ] The Google OAuth consent screen and redirect URIs are correct.
- [ ] Google Ads access level is applied for on the Cloud project, if Ads
      reporting is wanted.
- [ ] The extension's production origin is pinned.
- [ ] A backup is scheduled and a restore has been rehearsed.
