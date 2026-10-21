-- =============================================================================
-- CCM 0005 — Metric registry and normalised daily facts.
--
-- Two rules the whole product depends on:
--   1. Daily aggregates are stored normalised, with the provider's source
--      timestamp kept alongside. Trends are computed from these tables.
--   2. Provider identifiers and lineage are preserved. A metric fact can
--      always be traced back to the record it came from.
-- =============================================================================

-- --- Metric registry --------------------------------------------------------
-- The canonical definition of every metric CCM shows: formula, source,
-- grain, currency/timezone behaviour, attribution caveats and freshness.

create table if not exists public.metric_definitions (
  key                  text primary key,
  display_name         text not null,
  definition           text not null,
  formula              text,
  connector            text not null,
  source_field         text,
  unit                 text not null,
  -- day | account | page | campaign | keyword
  grain                text not null default 'day',
  currency_aware       boolean not null default false,
  timezone_aware       boolean not null default true,
  aggregation          text not null default 'sum',
  dimensions           text[] not null default '{}',
  attribution_notes    text,
  caveats              text[] not null default '{}',
  freshness_target_seconds integer,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- --- Ads --------------------------------------------------------------------
-- Money is stored in micros of the account currency. Never mix currencies in
-- one row; a portfolio total requires an explicit dated exchange rate.

create table if not exists public.daily_ads_metrics (
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  account_id      uuid not null references public.external_accounts(id) on delete cascade,
  metric_date     date not null,
  -- campaign | ad_group | ad | keyword | search_term | device | geo | network
  dimension       text not null default 'campaign',
  dimension_id    text not null default '',
  dimension_label text,
  impressions     bigint,
  clicks          bigint,
  cost_micros     bigint,
  conversions     numeric,
  conversion_value_micros bigint,
  currency        text,
  source_fetched_at timestamptz not null default now(),
  primary key (workspace_id, account_id, metric_date, dimension, dimension_id)
);

create index if not exists daily_ads_metrics_account_date_idx
  on public.daily_ads_metrics (account_id, metric_date desc);

-- --- GA4 --------------------------------------------------------------------

create table if not exists public.daily_ga4_metrics (
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  account_id      uuid not null references public.external_accounts(id) on delete cascade,
  metric_date     date not null,
  -- total | source | landing_page | page | device | geo | event
  dimension       text not null default 'total',
  dimension_id    text not null default '',
  dimension_label text,
  sessions        bigint,
  active_users    bigint,
  new_users       bigint,
  engaged_sessions bigint,
  screen_page_views bigint,
  key_events      bigint,
  event_name      text,
  event_count     bigint,
  revenue         numeric,
  currency        text,
  source_fetched_at timestamptz not null default now(),
  primary key (workspace_id, account_id, metric_date, dimension, dimension_id)
);

create index if not exists daily_ga4_metrics_account_date_idx
  on public.daily_ga4_metrics (account_id, metric_date desc);

-- --- Search Console ---------------------------------------------------------
-- Google-reported data. Kept separate from any third-party rank estimate.

create table if not exists public.daily_gsc_metrics (
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  account_id      uuid not null references public.external_accounts(id) on delete cascade,
  metric_date     date not null,
  -- query | page | country | device | search_type | date
  dimension       text not null default 'query',
  dimension_id    text not null default '',
  dimension_label text,
  clicks          bigint,
  impressions     bigint,
  ctr             numeric,
  position        numeric,
  country         text,
  device          text,
  search_type     text,
  source_fetched_at timestamptz not null default now(),
  primary key (workspace_id, account_id, metric_date, dimension, dimension_id)
);

create index if not exists daily_gsc_metrics_account_date_idx
  on public.daily_gsc_metrics (account_id, metric_date desc);

-- --- Rank tracking (third-party observations) --------------------------------
-- Explicitly separate from Search Console: a provider-estimated rank is not
-- a Google-reported position.

create table if not exists public.rank_snapshots (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  account_id     uuid not null references public.external_accounts(id) on delete cascade,
  keyword        text not null,
  search_engine  text not null default 'google',
  country        text,
  city           text,
  device         text not null default 'desktop',
  landing_url    text,
  position       integer,
  observed_on    date not null,
  source_provider text not null,
  source_fetched_at timestamptz not null default now(),
  unique (workspace_id, account_id, keyword, country, city, device, search_engine, observed_on)
);

create index if not exists rank_snapshots_keyword_idx
  on public.rank_snapshots (workspace_id, keyword, observed_on desc);

-- --- Social -----------------------------------------------------------------

create table if not exists public.social_account_metrics (
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  account_id     uuid not null references public.external_accounts(id) on delete cascade,
  metric_date    date not null,
  -- Organic profile analytics and paid social results are different surfaces
  -- and are never merged into one series.
  organic        boolean not null default true,
  followers      bigint,
  reach          bigint,
  impressions    bigint,
  engagements    bigint,
  clicks         bigint,
  video_views    bigint,
  content_count  bigint,
  source_fetched_at timestamptz not null default now(),
  primary key (workspace_id, account_id, metric_date, organic)
);

create table if not exists public.social_post_metrics (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  account_id     uuid not null references public.external_accounts(id) on delete cascade,
  platform       text not null,
  post_id        text not null,
  posted_at      timestamptz,
  format         text,
  link           text,
  -- A short excerpt only. CCM does not store full post copy.
  caption_excerpt text,
  reach          bigint,
  impressions    bigint,
  engagements    bigint,
  clicks         bigint,
  video_views    bigint,
  source_fetched_at timestamptz not null default now(),
  unique (workspace_id, account_id, platform, post_id)
);

create index if not exists social_post_metrics_account_idx
  on public.social_post_metrics (account_id, posted_at desc);

-- --- Tag Manager inventory --------------------------------------------------

create table if not exists public.tag_manager_snapshots (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  account_id     uuid not null references public.external_accounts(id) on delete cascade,
  container_id   text not null,
  version_id     text,
  version_number integer,
  published_at   timestamptz,
  tags           jsonb not null default '[]'::jsonb,
  triggers       jsonb not null default '[]'::jsonb,
  variables      jsonb not null default '[]'::jsonb,
  workspaces     jsonb not null default '[]'::jsonb,
  environments   jsonb not null default '[]'::jsonb,
  -- GA4 measurement IDs the container is expected to reference. Used to
  -- detect a missing or duplicated GA4 tag.
  expected_measurement_ids text[] not null default '{}',
  captured_at    timestamptz not null default now()
);

create index if not exists tag_manager_snapshots_account_idx
  on public.tag_manager_snapshots (account_id, captured_at desc);

-- --- Lineage ----------------------------------------------------------------
-- Every derived or displayed number can be traced to the record it came from.

create table if not exists public.metric_source_references (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  metric_key     text not null,
  source_connector text not null,
  source_record_id text,
  source_url     text,
  fetched_at     timestamptz,
  coverage       numeric,
  note           text,
  created_at     timestamptz not null default now()
);

create index if not exists metric_source_references_metric_idx
  on public.metric_source_references (workspace_id, metric_key, created_at desc);
