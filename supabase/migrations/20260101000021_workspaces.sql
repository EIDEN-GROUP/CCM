-- Workspace creation and naming are ownership actions, never general
-- settings permissions. A creator owns the newly created workspace.

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces
  for update to authenticated
  using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspaces.id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspaces.id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role = 'owner'
    )
  );

create or replace function public.create_workspace_for_owner(p_name text)
returns table (id uuid, name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  workspace_id uuid;
  workspace_name text := trim(p_name);
  workspace_slug text;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if workspace_name is null or length(workspace_name) < 2 or length(workspace_name) > 80 then
    raise exception 'Workspace name must be between 2 and 80 characters' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.workspace_members m
    where m.user_id = actor and m.status = 'active' and m.role = 'owner'
  ) then
    raise exception 'Only a workspace owner can create workspaces' using errcode = '42501';
  end if;

  workspace_slug := trim(both '-' from regexp_replace(lower(workspace_name), '[^a-z0-9]+', '-', 'g'));
  if workspace_slug = '' then workspace_slug := 'workspace'; end if;
  workspace_slug := left(workspace_slug, 48) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 10);

  insert into public.workspaces (name, slug)
  values (workspace_name, workspace_slug)
  returning workspaces.id into workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (workspace_id, actor, 'owner', 'active');

  return query select workspace_id, workspace_name;
end;
$$;

revoke all on function public.create_workspace_for_owner(text) from public;
revoke all on function public.create_workspace_for_owner(text) from anon;
grant execute on function public.create_workspace_for_owner(text) to authenticated;
