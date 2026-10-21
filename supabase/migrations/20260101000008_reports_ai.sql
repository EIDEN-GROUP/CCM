-- =============================================================================
-- CCM 0008 — Reports, exports and grounded AI insights.
-- =============================================================================

create table if not exists public.report_definitions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key          text not null,
  title        text not null,
  description  text,
  -- daily | weekly | monthly | on_demand
  cadence      text not null default 'on_demand',
  sections     jsonb not null default '[]'::jsonb,
  formats      text[] not null default '{csv}',
  recipients   text[] not null default '{}',
  created_by   uuid references auth.users(id) on delete set null,
  enabled      boolean not null default true,
  last_run_at  timestamptz,
  next_run_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, key)
);

create table if not exists public.report_runs (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  definition_id  uuid references public.report_definitions(id) on delete set null,
  period_start   date,
  period_end     date,
  timezone       text,
  currency       text,
  status         text not null default 'pending',
  payload        jsonb not null default '{}'::jsonb,
  -- Whether customer and mailbox identifiers were masked for this run.
  safe_mode      boolean not null default true,
  generated_at   timestamptz not null default now()
);

create index if not exists report_runs_workspace_idx
  on public.report_runs (workspace_id, generated_at desc);

create table if not exists public.ai_insight_requests (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  question     text not null,
  answer       text,
  status       text not null default 'pending'
                 check (status in ('pending','answered','refused','failed')),
  model        text,
  filters      jsonb not null default '{}'::jsonb,
  -- Freshness and definition caveats shown alongside the answer.
  caveats      jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_insight_requests_workspace_idx
  on public.ai_insight_requests (workspace_id, created_at desc);

-- The inspectable trail of records an answer was grounded in. An answer with
-- no rows here is not shown as an answer.
create table if not exists public.ai_insight_sources (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.ai_insight_requests(id) on delete cascade,
  source_type   text not null,
  source_ref    text not null,
  label         text not null,
  period_start  date,
  period_end    date,
  fetched_at    timestamptz,
  excerpt       text
);

create index if not exists ai_insight_sources_request_idx
  on public.ai_insight_sources (request_id);
