-- =============================================================================
-- CCM 0015 — The complete job-kind enum.
--
-- The application enqueues job kinds that the enum did not have:
-- `social.posts`, `alerts.evaluate`, `retention.prune` and
-- `reports.generate`. Enqueuing one of those failed at the database with
-- "invalid input value for enum sync_job_kind", which says nothing about
-- what to do.
--
-- The enum is recreated rather than extended, because `ALTER TYPE ... ADD
-- VALUE` cannot be run inside a function and cannot be undone. The column
-- is moved to text first, the type is replaced, and the column is moved
-- back — the values are all in the new set, so the cast is total.
--
-- The list is generated from `src/lib/jobs/kinds.ts`, which is the same
-- list the handler registry uses, so the enum and the code cannot drift.
-- =============================================================================

alter table public.sync_jobs
  alter column kind type text;

drop type if exists public.sync_job_kind;

create type public.sync_job_kind as enum (
  'ga4.sessions',
  'ga4.events',
  'gsc.query',
  'ads.campaign',
  'ads.search_terms',
  'gtm.inventory',
  'pagespeed.run',
  'uptime.check',
  'social.snapshot',
  'social.posts',
  'rank.snapshot',
  'mail.sync',
  'site.crawl',
  'alerts.evaluate',
  'retention.prune',
  'reports.generate'
);

alter table public.sync_jobs
  alter column kind type public.sync_job_kind
  using kind::public.sync_job_kind;
