-- =============================================================================
-- CCM 0006 — Alerts, action queue and resolution history.
-- =============================================================================

create table if not exists public.alert_rules (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  metric            text not null,
  direction         text not null check (direction in ('increase', 'decrease')),
  threshold         numeric not null,
  severity          text not null default 'warning',
  -- Minimum metric volume before the rule may fire.
  min_volume        numeric not null default 0,
  -- Consecutive clear windows required before an alert auto-resolves.
  hysteresis_windows integer not null default 2,
  -- Windows of history required before the rule is armed.
  grace_windows     integer not null default 7,
  quiet_hours       jsonb,
  min_repeat_hours  integer not null default 24,
  scope             jsonb,
  enabled           boolean not null default true,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists alert_rules_workspace_idx
  on public.alert_rules (workspace_id, enabled);

create table if not exists public.alerts (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  rule_id        uuid references public.alert_rules(id) on delete set null,
  account_id     uuid references public.external_accounts(id) on delete cascade,
  website_id     uuid references public.websites(id) on delete cascade,
  metric         text not null,
  severity       text not null default 'warning',
  title          text not null,
  -- Why this fired, in plain language. Shown to the user verbatim.
  reason         text not null,
  observed       numeric,
  baseline       numeric,
  confidence     numeric,
  status         text not null default 'open'
                   check (status in ('open','acknowledged','snoozed','resolved')),
  owner_user_id  uuid references auth.users(id) on delete set null,
  due_at         timestamptz,
  -- Where the evidence lives: provider, record id, period.
  source_ref     jsonb not null default '{}'::jsonb,
  opened_at      timestamptz not null default now(),
  resolved_at    timestamptz,
  resolution_note text
);

create index if not exists alerts_workspace_status_idx
  on public.alerts (workspace_id, status, severity, opened_at desc);

create table if not exists public.action_items (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  alert_id       uuid references public.alerts(id) on delete set null,
  title          text not null,
  detail         text,
  status         text not null default 'open'
                   check (status in ('open','in_progress','done','cancelled')),
  priority       text not null default 'normal'
                   check (priority in ('low','normal','high')),
  owner_user_id  uuid references auth.users(id) on delete set null,
  due_at         timestamptz,
  -- ai | rule | manual
  source         text not null default 'manual',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists action_items_workspace_idx
  on public.action_items (workspace_id, status, created_at desc);

create table if not exists public.action_item_events (
  id             uuid primary key default gen_random_uuid(),
  action_item_id uuid not null references public.action_items(id) on delete cascade,
  actor_user_id  uuid references auth.users(id) on delete set null,
  event_type     text not null,
  note           text,
  created_at     timestamptz not null default now()
);

create index if not exists action_item_events_item_idx
  on public.action_item_events (action_item_id, created_at desc);
