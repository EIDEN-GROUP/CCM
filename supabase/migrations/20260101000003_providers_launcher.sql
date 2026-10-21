-- =============================================================================
-- CCM 0003 — Provider connections, external accounts and the account launcher.
--
-- The launcher has two *independent* state machines:
--   * `provider_connections.status` — API authorisation.
--   * `account_launch_profiles.status` — browser session readiness.
-- A valid API token says nothing about whether a browser session exists.
-- =============================================================================

create type public.connection_status as enum (
  'connected',
  'needs_setup',
  'token_refresh_failed',
  'permission_revoked',
  'provider_outage',
  'rate_limited',
  'sync_stale'
);

create type public.launch_status as enum (
  'ready',
  'profile_unmapped',
  'extension_not_paired',
  'helper_unavailable',
  'browser_unsupported'
);

create type public.launch_mode as enum ('direct', 'extension', 'helper');

-- --- Provider catalogue -----------------------------------------------------

create table if not exists public.provider_definitions (
  key           text primary key,
  display_name  text not null,
  category      text not null,
  -- Pinned API version, kept in one place so a deprecation is a single change.
  api_version   text not null,
  -- HTTPS hostnames the launcher may open for this provider.
  hosts         text[] not null default '{}',
  capabilities  jsonb not null default '[]'::jsonb,
  docs_url      text,
  blocking_approvals text[] not null default '{}',
  updated_at    timestamptz not null default now()
);

-- --- Connections ------------------------------------------------------------

create table if not exists public.provider_connections (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  provider_key   text not null references public.provider_definitions(key),
  display_label  text not null,
  status         public.connection_status not null default 'needs_setup',
  -- oauth | service_account | imap | api_key
  auth_mode      text not null default 'oauth',
  scopes         text[] not null default '{}',
  account_timezone text,
  account_currency text,
  -- Provider-side access tier, e.g. the Google Ads API access level that now
  -- lives on the Google Cloud project rather than on a developer token.
  api_access_level text,
  quota_limit    integer,
  quota_used     integer not null default 0,
  quota_window_started_at timestamptz,
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_error_code text,
  last_error_message text,
  next_refresh_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (workspace_id, provider_key, display_label)
);

create index if not exists provider_connections_workspace_idx
  on public.provider_connections (workspace_id, provider_key);

-- Encrypted credentials live in their own table so a broad read on
-- `provider_connections` can never surface a secret. Row Level Security
-- denies every authenticated user; only the service role (the sync worker)
-- can read it.
create table if not exists public.provider_connection_credentials (
  connection_id    uuid primary key references public.provider_connections(id) on delete cascade,
  encrypted_secrets text not null,
  key_fingerprint  text,
  updated_at       timestamptz not null default now()
);

-- --- External accounts ------------------------------------------------------

create table if not exists public.external_accounts (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  connection_id       uuid references public.provider_connections(id) on delete set null,
  provider_key        text not null references public.provider_definitions(key),
  -- Stable provider-side identifier, where the provider exposes one.
  external_account_id text,
  display_label       text not null,
  -- Provider-specific identifiers used to build launch targets.
  identifiers         jsonb not null default '{}'::jsonb,
  launch_account_url  text,
  launch_management_url text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (workspace_id, provider_key, external_account_id)
);

create table if not exists public.external_account_identifiers (
  account_id uuid not null references public.external_accounts(id) on delete cascade,
  kind       text not null,
  value      text not null,
  primary key (account_id, kind)
);

-- --- Launcher profile mapping ----------------------------------------------

create table if not exists public.account_launch_profiles (
  account_id      uuid primary key references public.external_accounts(id) on delete cascade,
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  launch_mode     public.launch_mode not null default 'direct',
  status          public.launch_status not null default 'profile_unmapped',
  -- Human label for the browser profile, e.g. "Chrome — Work".
  browser_profile_label text,
  -- Chrome/Edge profile directory, used only by the optional native helper.
  browser_profile_directory text,
  helper_endpoint text,
  -- The paired extension instance, so a launch can be verified.
  extension_instance_id text,
  last_opened_at  timestamptz,
  last_launch_result text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- --- Launch tickets ---------------------------------------------------------
-- A ticket is a short-lived, signed, single-use permission to open one
-- account. The row exists so a ticket can be consumed exactly once even
-- across browser sessions.

create table if not exists public.launch_tickets (
  jti           uuid primary key,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  account_id    uuid not null references public.external_accounts(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider_key  text not null,
  host          text not null,
  path          text not null,
  mode          public.launch_mode not null default 'direct',
  expires_at    timestamptz not null,
  consumed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists launch_tickets_account_idx
  on public.launch_tickets (account_id, created_at desc);

-- --- Launch audit -----------------------------------------------------------

create table if not exists public.launch_events (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id   uuid references public.external_accounts(id) on delete set null,
  user_id      uuid references auth.users(id) on delete set null,
  ticket_jti   uuid,
  mode         public.launch_mode not null default 'direct',
  -- opened | blocked | rejected_expired | rejected_replayed |
  -- rejected_host_not_allowed | rejected_invalid_ticket | rejected_wrong_account
  outcome      text not null,
  host         text,
  reason       text,
  via_extension boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists launch_events_workspace_idx
  on public.launch_events (workspace_id, created_at desc);
