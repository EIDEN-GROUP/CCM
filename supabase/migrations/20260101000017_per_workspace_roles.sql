-- =============================================================================
-- CCM 0017 — Per-workspace role grants.
--
-- Two faults are fixed here.
--
-- 1. The role grants were **deployment-global**. `role_permissions` had no
--    workspace, and the authorisation helpers joined it on the role alone,
--    so the owner of one workspace could change what a role meant in every
--    other workspace. The grants are now scoped to the workspace.
--
--    The role *catalogue* stays global — the names and the labels of the
--    roles are the same everywhere — but who may do what is per workspace.
--
-- 2. The application read its permissions from a hard-coded map while the
--    database enforced a different set. The session now reads the grants from
--    the database, so an edit made in the interface takes effect at once and
--    in one place.
--
-- The existing rows are copied to every workspace that already exists, so a
-- deployment that was working keeps working.
-- =============================================================================

-- --- The role grants, per workspace -------------------------------------------

alter table public.role_permissions
  add column if not exists workspace_id uuid
  references public.workspaces(id) on delete cascade;

-- The grants that predate this migration belong to every workspace.
update public.role_permissions
   set workspace_id = w.id
  from public.workspaces w
 where role_permissions.workspace_id is null;

-- A grant with no workspace is meaningless now.
delete from public.role_permissions where workspace_id is null;

alter table public.role_permissions
  drop constraint if exists role_permissions_pkey;
alter table public.role_permissions
  add primary key (workspace_id, role, permission);

create index if not exists role_permissions_role_idx
  on public.role_permissions (role);

-- --- The tab map, per workspace -----------------------------------------------

alter table public.role_tab_access
  add column if not exists workspace_id uuid
  references public.workspaces(id) on delete cascade;

update public.role_tab_access
   set workspace_id = w.id
  from public.workspaces w
 where role_tab_access.workspace_id is null;

delete from public.role_tab_access where workspace_id is null;

alter table public.role_tab_access
  drop constraint if exists role_tab_access_pkey;
alter table public.role_tab_access
  add primary key (workspace_id, role, tab);

-- --- The authorisation helpers ------------------------------------------------
--
-- They now join the grants on the workspace as well as the role, so a
-- workspace's roles mean only what that workspace decided.

create or replace function public.has_permission(target_workspace uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    join public.role_permissions rp
      on rp.workspace_id = m.workspace_id
     and rp.role = m.role
    where m.workspace_id = target_workspace
      and m.user_id = auth.uid()
      and m.status = 'active'
      and rp.permission = perm
  );
$$;

create or replace function public.can_access_account(target_account uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.external_accounts a
    join public.workspace_members m
      on m.workspace_id = a.workspace_id
     and m.user_id = auth.uid()
     and m.status = 'active'
    join public.roles r
      on r.key = m.role
    join public.role_permissions rp
      on rp.workspace_id = m.workspace_id
     and rp.role = m.role
     and rp.permission = perm
    where a.id = target_account
      and (
        r.account_scoped = false
        or exists (
          select 1
          from public.external_account_grants g
          where g.external_account_id = a.id
            and g.user_id = auth.uid()
            and g.permission = perm
        )
      )
  );
$$;

-- `can_read_metric` is unchanged: it delegates to the two helpers above,
-- and the policies depend on its signature, so it is left alone.

-- --- The tab map policies ------------------------------------------------------
--
-- The map is per workspace, so its policies are too.

drop policy if exists role_tab_access_read on public.role_tab_access;
drop policy if exists role_tab_access_write on public.role_tab_access;

create policy role_tab_access_read on public.role_tab_access
  for select to authenticated
  using (
    exists (
      select 1
      from public.workspace_members m
      where m.workspace_id = role_tab_access.workspace_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy role_tab_access_write on public.role_tab_access
  for all to authenticated
  using (
    exists (
      select 1
      from public.workspace_members m
      join public.role_permissions rp
        on rp.workspace_id = m.workspace_id
       and rp.role = m.role
      where m.workspace_id = role_tab_access.workspace_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and rp.permission = 'roles.manage'
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members m
      join public.role_permissions rp
        on rp.workspace_id = m.workspace_id
       and rp.role = m.role
      where m.workspace_id = role_tab_access.workspace_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and rp.permission = 'roles.manage'
    )
  );
