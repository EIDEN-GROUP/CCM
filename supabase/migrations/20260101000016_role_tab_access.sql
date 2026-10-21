-- =============================================================================
-- CCM 0016 — Per-role tab access.
--
-- The owner says, per role, how far into each tab that role may go:
-- view, use or edit. The levels are derived into the feature permissions
-- the database enforces, so this table is the **input** and
-- `role_permissions` is the **output**.
--
-- The Row Level Security policies are unchanged. They still authorise on
-- permissions; the tab levels only decide which permissions a role ends up
-- holding.
--
-- `roles.manage` is the permission that lets somebody change a role. It is
-- granted to the owner by the role itself, never derived from a tab, so
-- handing the owner-only tab to the administrator cannot hand over the
-- authority to change roles.
--
-- The role catalogue is global — one set of roles for the deployment — so
-- the tab map is global too, and is consistent with `role_permissions`.
-- =============================================================================

create table if not exists public.role_tab_access (
  role text not null references public.roles(key) on delete cascade,
  tab text not null,
  -- none | view | use | edit
  level text not null check (level in ('none','view','use','edit')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (role, tab)
);

create index if not exists role_tab_access_role_idx
  on public.role_tab_access (role);

alter table public.role_tab_access enable row level security;

-- The tab map is readable by any signed-in member: it describes how the
-- product is organised, not anything private.
create policy role_tab_access_read on public.role_tab_access
  for select to authenticated
  using (true);

-- It is written only by somebody who may change roles.
create policy role_tab_access_write on public.role_tab_access
  for all to authenticated
  using (
    exists (
      select 1
      from public.workspace_members m
      join public.role_permissions rp on rp.role = m.role
      where m.user_id = auth.uid()
        and m.status = 'active'
        and rp.permission = 'roles.manage'
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members m
      join public.role_permissions rp on rp.role = m.role
      where m.user_id = auth.uid()
        and m.status = 'active'
        and rp.permission = 'roles.manage'
    )
  );
