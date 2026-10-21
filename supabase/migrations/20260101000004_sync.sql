-- =============================================================================
-- CCM 0004 — Durable background synchronisation.
--
-- The queue is database-backed so it survives serverless cold starts, function
-- time limits and process restarts. Jobs are claimed with a lease, retried
-- with backoff, deduplicated by key and dead-lettered after a bounded number
-- of attempts.
-- =============================================================================

create type public.sync_job_status as enum (
  'queued', 'running', 'succeeded', 'failed', 'dead_letter', 'cancelled'
);

create type public.sync_job_kind as enum (
  'ga4.sessions', 'ga4.events', 'gsc.query', 'ads.campaign', 'ads.search_terms',
  'gtm.inventory', 'pagespeed.run', 'uptime.check', 'social.snapshot',
  'rank.snapshot', 'mail.sync', 'site.crawl'
);

create table if not exists public.sync_jobs (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  connection_id  uuid references public.provider_connections(id) on delete cascade,
  account_id     uuid references public.external_accounts(id) on delete cascade,
  kind           public.sync_job_kind not null,
  status         public.sync_job_status not null default 'queued',
  -- Idempotency key. Two requests for the same account/date range collapse
  -- into one job rather than double-writing.
  dedupe_key     text not null,
  -- Batch bounds: the payload says exactly which slice this job covers, so
  -- no job ever has to fetch "everything".
  payload        jsonb not null default '{}'::jsonb,
  run_after      timestamptz not null default now(),
  attempts       integer not null default 0,
  max_attempts   integer not null default 5,
  locked_until   timestamptz,
  lease_owner    text,
  last_error     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (workspace_id, dedupe_key)
);

create index if not exists sync_jobs_claim_idx
  on public.sync_jobs (status, run_after)
  where status = 'queued';

create index if not exists sync_jobs_account_idx
  on public.sync_jobs (account_id, kind, created_at desc);

create table if not exists public.sync_runs (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  job_id         uuid references public.sync_jobs(id) on delete set null,
  connection_id  uuid references public.provider_connections(id) on delete set null,
  account_id     uuid references public.external_accounts(id) on delete set null,
  status         public.sync_job_status not null,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  rows_written   integer,
  duration_ms    integer,
  error_code     text,
  error_message  text
);

create index if not exists sync_runs_workspace_started_idx
  on public.sync_runs (workspace_id, started_at desc);

-- Checkpoints. A sync resumes from its cursor rather than starting over.
create table if not exists public.sync_cursors (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  connection_id  uuid not null references public.provider_connections(id) on delete cascade,
  account_id     uuid references public.external_accounts(id) on delete cascade,
  stream         text not null,
  cursor_value   text,
  checkpoint     jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now(),
  unique (connection_id, stream)
);

create table if not exists public.sync_errors (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  connection_id uuid references public.provider_connections(id) on delete cascade,
  job_id        uuid references public.sync_jobs(id) on delete set null,
  error_code    text not null,
  error_message text not null,
  retryable     boolean not null default true,
  occurred_at   timestamptz not null default now()
);

create index if not exists sync_errors_workspace_idx
  on public.sync_errors (workspace_id, occurred_at desc);
