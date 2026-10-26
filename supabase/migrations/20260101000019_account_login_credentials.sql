-- Account login credentials are isolated from provider API tokens and from
-- the account catalogue. The application encrypts the password before insert.
create table if not exists public.account_login_credentials (
  account_id uuid primary key references public.external_accounts(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  username text not null,
  encrypted_password text not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists account_login_credentials_workspace_idx
  on public.account_login_credentials (workspace_id);

alter table public.account_login_credentials enable row level security;
revoke all on public.account_login_credentials from anon, authenticated;
grant all on public.account_login_credentials to service_role;

-- A launch ticket can release one credential envelope to the paired extension
-- exactly once. It is never readable by the browser's authenticated role.
create table if not exists public.account_login_access_tickets (
  jti uuid primary key,
  account_id uuid not null references public.external_accounts(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.account_login_access_tickets enable row level security;
revoke all on public.account_login_access_tickets from anon, authenticated;
grant all on public.account_login_access_tickets to service_role;
