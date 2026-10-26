-- The launcher has its own read permission. Users allowed to launch an
-- account should not also need the broader integrations catalogue grant.
drop policy if exists external_accounts_launcher_read on public.external_accounts;

create policy external_accounts_launcher_read on public.external_accounts
  for select to authenticated
  using (
    public.has_permission(workspace_id, 'launch.read')
    and (
      public.can_access_account(id, 'launch.read')
      or public.can_access_account(id, 'launch.execute')
    )
  );
