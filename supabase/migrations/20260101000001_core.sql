-- =============================================================================
-- CCM 0001 — Core tenancy, roles and audit.
--
-- Design rules applied to every table in this schema:
--   * Every tenant-owned row carries `workspace_id`.
--   * RLS is enabled in the same migration that creates the table, so there is
--     never a window in which a table exists without policies.
--   * Role/permission data lives in the database, not only in application
--     code, so the database is the authority on who may read what.
-- =============================================================================

-- --- Role catalogue ---------------------------------------------------------

create table if not exists public.roles (
  key             text primary key,
  label           text not null,
  -- Account-scoped roles only see the accounts explicitly granted to them.
  account_scoped  boolean not null default false,
  description     text,
  created_at      timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role        text not null references public.roles(key) on delete cascade,
  permission  text not null,
  primary key (role, permission)
);

-- --- Workspaces -------------------------------------------------------------

create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  -- Reporting timezone. Provider reports are day-bounded in the account's own
  -- timezone, so the workspace timezone is the default for the portfolio view.
  timezone    text not null default 'Africa/Casablanca',
  currency    text not null default 'MAD',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- --- Membership -------------------------------------------------------------

create type public.member_status as enum ('invited', 'active', 'suspended');

create table if not exists public.workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'read_only' references public.roles(key),
  status       public.member_status not null default 'invited',
  invited_by   uuid references auth.users(id) on delete set null,
  invited_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx
  on public.workspace_members (user_id, status);

-- --- Per-account grants -----------------------------------------------------
-- Used by account-scoped roles (for example `mailbox_user`) so a person can
-- reach one mailbox without seeing the rest of the workspace.

create table if not exists public.external_account_grants (
  external_account_id uuid not null,
  user_id              uuid not null references auth.users(id) on delete cascade,
  permission           text not null,
  granted_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  primary key (external_account_id, user_id, permission)
);

-- --- Preferences ------------------------------------------------------------

create table if not exists public.user_preferences (
  user_id       uuid not null references auth.users(id) on delete cascade,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  locale        text not null default 'en',
  timezone      text,
  currency      text,
  default_range text not null default '28d',
  -- "Share safe" mode masks customer and mailbox identifiers in exports.
  safe_mode     boolean not null default false,
  notifications jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

-- --- Audit trail ------------------------------------------------------------
-- Append-only. RLS grants insert to members and select only to `audit.read`.

create table if not exists public.audit_events (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action        text not null,
  entity_type   text not null,
  entity_id     uuid,
  target_label  text,
  severity      text not null default 'info',
  -- Free-form detail. Never contains tokens, cookies, message bodies or
  -- patient identifiers; the application redacts before writing.
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists audit_events_workspace_created_idx
  on public.audit_events (workspace_id, created_at desc);

create index if not exists audit_events_entity_idx
  on public.audit_events (entity_type, entity_id);
