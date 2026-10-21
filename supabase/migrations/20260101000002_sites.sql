-- =============================================================================
-- CCM 0002 — Website portfolio.
--
-- The registry is deliberately generic: adding a future Medical Bay microsite
-- or another authorised business website must not require a schema change.
-- =============================================================================

create table if not exists public.websites (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  name           text not null,
  -- Registrable domain, e.g. "medicalbay.ma".
  domain         text not null,
  primary_locale text not null default 'fr',
  -- Locales the site actually serves, e.g. {fr,en,ar}.
  locales        text[] not null default '{fr,en,ar}',
  -- Service clusters used for reporting, e.g. {dentistry,hair_transplant,
  -- medical_tourism,general_surgery,aesthetics}.
  service_lines  text[] not null default '{}',
  owner_label    text,
  health_state   text not null default 'unknown',
  is_active      boolean not null default true,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (workspace_id, domain)
);

create table if not exists public.website_domains (
  id           uuid primary key default gen_random_uuid(),
  website_id   uuid not null references public.websites(id) on delete cascade,
  hostname     text not null unique,
  is_primary   boolean not null default false,
  verified_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.website_pages (
  id            uuid primary key default gen_random_uuid(),
  -- Denormalised workspace so Row Level Security can filter directly, matching
  -- every other tenant-owned table.
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  website_id    uuid not null references public.websites(id) on delete cascade,
  url           text not null,
  path          text not null,
  locale        text,
  -- Page class drives reporting: service | landing | content | legal | other
  page_class    text not null default 'other',
  service_line  text,
  title         text,
  canonical_url text,
  noindex       boolean not null default false,
  status_code   integer,
  meta_description text,
  h1_count      integer,
  last_crawled_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (website_id, url)
);

create index if not exists website_pages_website_class_idx
  on public.website_pages (website_id, page_class, locale);

create table if not exists public.site_health_checks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  website_id   uuid not null references public.websites(id) on delete cascade,
  -- Check type: uptime | ssl | dns | pagespeed | technical_seo
  check_type text not null,
  status     text not null default 'unknown',
  checked_at timestamptz not null default now(),
  value      numeric,
  unit       text,
  detail     jsonb not null default '{}'::jsonb
);

create index if not exists site_health_checks_website_idx
  on public.site_health_checks (website_id, check_type, checked_at desc);
