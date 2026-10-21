# Running CCM on a VPS

The product is not tied to Vercel. This document describes the container
profile, the self-hosted Supabase profile, and — importantly — **what
genuinely differs** between the two.

---

## 1. Why this path exists

Medical Bay's data is health-adjacent, and keeping the database on
infrastructure that is operated in Morocco (or the EU) is a reasonable
requirement. The architecture supports it because:

- all business logic lives in `src/domain`, `src/providers` and
  `src/repositories`, none of which import Next.js or a hosted-Supabase
  client;
- the only Vercel-specific code is the route-handler layer and the cron
  dispatcher;
- provider APIs, callback base URLs, the job driver, storage and the public
  origin are environment-configurable.

## 2. Container image

`Dockerfile` builds the Next.js application as a standalone server.

```bash
docker build -t ccm:local .
docker run --rm -p 3000:3000 --env-file .env.local ccm:local
```

The image runs as a non-root user, has a health check, and handles
`SIGTERM` for graceful shutdown.

`docker-compose.yml` brings up the application, a worker and (optionally) a
self-hosted Supabase stack:

```bash
docker compose up -d
docker compose logs -f app
```

## 3. The worker

The sync worker is a separate process from the web application. It runs the
same image with a different command.

```bash
docker compose up -d worker
```

The worker:

- claims a **bounded batch** of jobs (default 10 per tick) with
  `FOR UPDATE SKIP LOCKED`;
- processes each job within a lease;
- writes normalised facts and a checkpoint;
- backs off with jitter on failure and dead-letters after the attempt
  budget;
- exits cleanly on `SIGTERM`, finishing the job in flight before stopping.

Unlike the Vercel cron, the worker polls on a short interval, so it can
keep the queue moving continuously.

## 4. Self-hosted Supabase

The officially supported self-hosting path is the Supabase Docker Compose
stack. Point `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` at it, and CCM is otherwise unchanged.

```bash
git clone https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# set POSTGRES_PASSWORD, JWT_SECRET, SECRET_KEY_BASE, ANON_KEY, SERVICE_ROLE_KEY
docker compose up -d
supabase db push --db-url postgresql://postgres:<password>@localhost:5432/postgres
```

### What genuinely differs from the hosted product

This is the honest list. Self-hosting is **not** the same product with a
different URL.

| Capability | Hosted Supabase | Self-hosted | Impact on CCM |
|---|---|---|---|
| **Auth** | Managed, with email templates, rate limiting and abuse protection | You run GoTrue. Email delivery, rate limiting and CAPTCHA are **your** problem. | Configure SMTP; a self-hosted stack with no mailer will fail password-reset and invite flows. |
| **Point-in-time recovery** | Managed, time-travel to any point | Requires your own `pgbackrest` or WAL-G configuration | Set up WAL archiving **before** you need it. |
| **Connection pooling** | Managed pooler (Supavisor) | You run it | Point `DATABASE_URL` at the pooler for the app, and at the direct connection for migrations. |
| **Log drain** | Available | Configure the plugin | Needed if you ship logs to a SIEM. |
| **Custom domains / TLS** | Managed | Traefik or your own proxy | Required for a real production origin. |
| **Read replicas** | Available | You run them | Not needed at CCM's current scale. |
| **Backups** | Managed, 14-day default | Your own schedule | Non-negotiable for mailbox data. |
| **Edge Functions** | Managed, deployed by the CLI | You run them | CCM does not depend on Edge Functions; the worker runs as a container. |
| **Storage** | Managed | MinIO or the bundled backend | Only used if you add file features. |
| **Advisor checks** | Run against the hosted project | Run `supabase db lint` and the advisor CLI locally | You lose the managed "fix it" prompts; you gain the ability to run them yourself. |
| **Upgrade cadence** | Managed | You upgrade the stack | Pin a version and read the release notes. |
| **Password hashing / key rotation** | Managed | You manage `JWT_SECRET` | A leaked `JWT_SECRET` invalidates every session. Treat it as a critical secret. |

**Cost:** self-hosting is not free. A 4 vCPU / 8 GB host runs the app, the
worker and a small Supabase stack comfortably for a single workspace. Add
backup storage and a monitoring host.

## 5. Reverse proxy and TLS

Caddy is the shortest path to a correct production origin:

```caddy
medicalbay.ma {
    encode gzip zstd
    reverse_proxy ccm:3000
}
```

Or with nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name ccm.medicalbay.ma;

    ssl_certificate     /etc/letsencrypt/live/ccm/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ccm/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
    }
}
```

CCM sets `Cache-Control: private, no-store` on responses that carry auth
cookies, so the proxy must not cache them. Do not put a shared cache in
front of authenticated routes.

## 6. Environment configuration

The same variables as the Vercel profile, plus:

| Variable | Purpose |
|---|---|
| `PORT` | The port the application listens on. Default 3000. |
| `WORKER_POLL_INTERVAL_MS` | How often the worker looks for jobs. Default 15000. |
| `WORKER_BATCH_SIZE` | Jobs claimed per tick. Default 10. |
| `WORKER_LEASE_SECONDS` | Job lease. Default 300. |

## 7. Backups and restore

**Back up two things, and rehearse the restore.**

1. **Postgres.** `pg_dump` for a logical backup; WAL archiving for
   point-in-time recovery. A logical backup is enough to start:

   ```bash
   pg_dump --format=custom --file ccm-$(date +%F).dump "$DATABASE_URL"
   ```

2. **The secrets.** The encryption key, the launch signing keys and the
   provider OAuth clients. **A database backup without `APP_ENCRYPTION_KEY`
   is useless for provider credentials** — the tokens cannot be decrypted.
   Store the keys in a password manager or a KMS, and record where they are
   in the runbook.

A restore rehearsal:

```bash
createdb ccm_restore
pg_restore --dbname ccm_restore ccm-2026-10-20.dump
psql ccm_restore -c "select count(*) from public.daily_ga4_metrics;"
```

Do this on a schedule and record the date it last succeeded.

## 8. Health checks

| Endpoint | Use |
|---|---|
| `GET /api/health` | Liveness and readiness. Reports configuration status without leaking a value. |
| `GET /api/jobs/status` | Queue depth, oldest running job, dead-letter count. Requires `CRON_SECRET`. |

The container health check uses `/api/health`.

## 9. Migration from Vercel to the VPS

1. Stand up the stack and apply the migrations to a fresh database.
2. Copy the environment variables across, changing only the origin and the
   database URLs.
3. Re-point the DNS record.
4. Re-authorise the OAuth redirect URI with Google (the redirect URI
   changes to the new origin).
5. Update the extension's pinned origin in `manifest.json` and re-publish
   it if the production origin changed.
6. Re-pair the browser bridge instance.

Nothing in the database or the application code needs to change: the data
model, the RLS policies and the provider adapters are all portable.
