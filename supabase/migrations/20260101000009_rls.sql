-- =============================================================================
-- CCM 0009 — Row Level Security.
--
-- Default deny. Every table exposes only the rows the signed-in user's role
-- and account grants allow. Policies are evaluated against the database, not
-- against a UI filter, so hiding a navigation link is a convenience while the
-- policy is the control.
--
-- The helper functions are SECURITY DEFINER because a policy that read
-- `workspace_members` through RLS would recurse. Each helper re-checks
-- `auth.uid()` explicitly and pins `search_path`.
-- =============================================================================

-- --- Helpers ----------------------------------------------------------------

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

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
      on rp.role = m.role
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
      on rp.role = m.role
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

-- Metric tables need both the workspace permission and the account grant.
create or replace function public.can_read_metric(
  target_workspace uuid,
  target_account uuid,
  perm text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission(target_workspace, perm)
     and public.can_access_account(target_account, perm);
$$;

-- Maps a metric key to the permission needed to read it.
create or replace function public.metric_permission(metric_key text)
returns text
language sql
immutable
as $$
  select case
    when metric_key like 'ads.%'    then 'ads.read'
    when metric_key like 'ga4.%'    then 'analytics.read'
    when metric_key like 'gsc.%'    then 'seo.read'
    when metric_key like 'social.%' then 'social.read'
    when metric_key like 'gtm.%'    then 'gtm.read'
    when metric_key like 'ux.%'     then 'ux.read'
    else 'overview.read'
  end;
$$;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_permission(uuid, text) to authenticated;
grant execute on function public.can_access_account(uuid, text) to authenticated;
grant execute on function public.can_read_metric(uuid, uuid, text) to authenticated;
grant execute on function public.metric_permission(text) to authenticated;

-- --- Core -------------------------------------------------------------------

alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;

create policy roles_read on public.roles
  for select to authenticated using (true);

create policy role_permissions_read on public.role_permissions
  for select to authenticated using (true);

alter table public.workspaces enable row level security;

create policy workspaces_read on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));

create policy workspaces_update on public.workspaces
  for update to authenticated
  using (public.has_permission(id, 'settings.manage'))
  with check (public.has_permission(id, 'settings.manage'));

alter table public.workspace_members enable row level security;

create policy workspace_members_read on public.workspace_members
  for select to authenticated using (public.is_workspace_member(workspace_id));

create policy workspace_members_insert on public.workspace_members
  for insert to authenticated
  with check (public.has_permission(workspace_id, 'settings.manage'));

create policy workspace_members_update on public.workspace_members
  for update to authenticated
  using (public.has_permission(workspace_id, 'settings.manage'))
  with check (public.has_permission(workspace_id, 'settings.manage'));

create policy workspace_members_delete on public.workspace_members
  for delete to authenticated
  using (public.has_permission(workspace_id, 'settings.manage'));

alter table public.external_account_grants enable row level security;

create policy external_account_grants_read on public.external_account_grants
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_permission(
      (select workspace_id from public.external_accounts a
        where a.id = external_account_grants.external_account_id),
      'integrations.manage'
    )
  );

create policy external_account_grants_write on public.external_account_grants
  for all to authenticated
  using (
    public.has_permission(
      (select workspace_id from public.external_accounts a
        where a.id = external_account_grants.external_account_id),
      'integrations.manage'
    )
  )
  with check (
    public.has_permission(
      (select workspace_id from public.external_accounts a
        where a.id = external_account_grants.external_account_id),
      'integrations.manage'
    )
  );

alter table public.user_preferences enable row level security;

create policy user_preferences_read on public.user_preferences
  for select to authenticated using (user_id = auth.uid());

create policy user_preferences_write on public.user_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.audit_events enable row level security;

create policy audit_events_read on public.audit_events
  for select to authenticated
  using (public.has_permission(workspace_id, 'audit.read'));

create policy audit_events_insert on public.audit_events
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

-- --- Websites ---------------------------------------------------------------

alter table public.websites enable row level security;

create policy websites_read on public.websites
  for select to authenticated
  using (public.has_permission(workspace_id, 'websites.read'));

create policy websites_write on public.websites
  for all to authenticated
  using (public.has_permission(workspace_id, 'settings.manage'))
  with check (public.has_permission(workspace_id, 'settings.manage'));

alter table public.website_domains enable row level security;

create policy website_domains_read on public.website_domains
  for select to authenticated
  using (
    exists (
      select 1 from public.websites w
      where w.id = website_domains.website_id
        and public.has_permission(w.workspace_id, 'websites.read')
    )
  );

create policy website_domains_write on public.website_domains
  for all to authenticated
  using (
    exists (
      select 1 from public.websites w
      where w.id = website_domains.website_id
        and public.has_permission(w.workspace_id, 'settings.manage')
    )
  )
  with check (
    exists (
      select 1 from public.websites w
      where w.id = website_domains.website_id
        and public.has_permission(w.workspace_id, 'settings.manage')
    )
  );

alter table public.website_pages enable row level security;

create policy website_pages_read on public.website_pages
  for select to authenticated
  using (public.has_permission(workspace_id, 'websites.read'));

create policy website_pages_write on public.website_pages
  for all to authenticated
  using (public.has_permission(workspace_id, 'settings.manage'))
  with check (public.has_permission(workspace_id, 'settings.manage'));

alter table public.site_health_checks enable row level security;

create policy site_health_checks_read on public.site_health_checks
  for select to authenticated
  using (public.has_permission(workspace_id, 'websites.read'));

create policy site_health_checks_write on public.site_health_checks
  for all to authenticated
  using (public.has_permission(workspace_id, 'settings.manage'))
  with check (public.has_permission(workspace_id, 'settings.manage'));

-- --- Providers and launcher -------------------------------------------------

alter table public.provider_definitions enable row level security;

create policy provider_definitions_read on public.provider_definitions
  for select to authenticated using (true);

alter table public.provider_connections enable row level security;

create policy provider_connections_read on public.provider_connections
  for select to authenticated
  using (public.has_permission(workspace_id, 'integrations.read'));

create policy provider_connections_write on public.provider_connections
  for all to authenticated
  using (public.has_permission(workspace_id, 'integrations.manage'))
  with check (public.has_permission(workspace_id, 'integrations.manage'));

-- Credentials: RLS is enabled and NO policy is granted to `authenticated`.
-- Only the service role (the sync worker) can read this table.
alter table public.provider_connection_credentials enable row level security;

alter table public.external_accounts enable row level security;

create policy external_accounts_read on public.external_accounts
  for select to authenticated
  using (
    public.has_permission(workspace_id, 'integrations.read')
    and public.can_access_account(id, 'integrations.read')
  );

create policy external_accounts_write on public.external_accounts
  for all to authenticated
  using (public.has_permission(workspace_id, 'integrations.manage'))
  with check (public.has_permission(workspace_id, 'integrations.manage'));

alter table public.external_account_identifiers enable row level security;

create policy external_account_identifiers_read on public.external_account_identifiers
  for select to authenticated
  using (public.can_access_account(account_id, 'integrations.read'));

alter table public.account_launch_profiles enable row level security;

create policy account_launch_profiles_read on public.account_launch_profiles
  for select to authenticated
  using (public.has_permission(workspace_id, 'launch.read'));

create policy account_launch_profiles_write on public.account_launch_profiles
  for all to authenticated
  using (
    public.has_permission(workspace_id, 'integrations.manage')
    or public.has_permission(workspace_id, 'launch.execute')
  )
  with check (
    public.has_permission(workspace_id, 'integrations.manage')
    or public.has_permission(workspace_id, 'launch.execute')
  );

alter table public.launch_tickets enable row level security;

create policy launch_tickets_read on public.launch_tickets
  for select to authenticated
  using (user_id = auth.uid() and public.has_permission(workspace_id, 'launch.execute'));

create policy launch_tickets_insert on public.launch_tickets
  for insert to authenticated
  with check (user_id = auth.uid() and public.has_permission(workspace_id, 'launch.execute'));

alter table public.launch_events enable row level security;

create policy launch_events_read on public.launch_events
  for select to authenticated
  using (public.has_permission(workspace_id, 'launch.read'));

create policy launch_events_insert on public.launch_events
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

-- --- Sync -------------------------------------------------------------------

alter table public.sync_jobs enable row level security;

create policy sync_jobs_read on public.sync_jobs
  for select to authenticated
  using (public.has_permission(workspace_id, 'integrations.read'));

alter table public.sync_runs enable row level security;

create policy sync_runs_read on public.sync_runs
  for select to authenticated
  using (public.has_permission(workspace_id, 'integrations.read'));

alter table public.sync_cursors enable row level security;

create policy sync_cursors_read on public.sync_cursors
  for select to authenticated
  using (public.has_permission(workspace_id, 'integrations.read'));

alter table public.sync_errors enable row level security;

create policy sync_errors_read on public.sync_errors
  for select to authenticated
  using (public.has_permission(workspace_id, 'integrations.read'));

-- --- Metrics ----------------------------------------------------------------

alter table public.metric_definitions enable row level security;

create policy metric_definitions_read on public.metric_definitions
  for select to authenticated using (true);

alter table public.daily_ads_metrics enable row level security;

create policy daily_ads_metrics_read on public.daily_ads_metrics
  for select to authenticated
  using (public.can_read_metric(workspace_id, account_id, 'ads.read'));

alter table public.daily_ga4_metrics enable row level security;

create policy daily_ga4_metrics_read on public.daily_ga4_metrics
  for select to authenticated
  using (public.can_read_metric(workspace_id, account_id, 'analytics.read'));

alter table public.daily_gsc_metrics enable row level security;

create policy daily_gsc_metrics_read on public.daily_gsc_metrics
  for select to authenticated
  using (public.can_read_metric(workspace_id, account_id, 'seo.read'));

alter table public.rank_snapshots enable row level security;

create policy rank_snapshots_read on public.rank_snapshots
  for select to authenticated
  using (public.can_read_metric(workspace_id, account_id, 'seo.read'));

alter table public.social_account_metrics enable row level security;

create policy social_account_metrics_read on public.social_account_metrics
  for select to authenticated
  using (public.can_read_metric(workspace_id, account_id, 'social.read'));

alter table public.social_post_metrics enable row level security;

create policy social_post_metrics_read on public.social_post_metrics
  for select to authenticated
  using (public.can_read_metric(workspace_id, account_id, 'social.read'));

alter table public.tag_manager_snapshots enable row level security;

create policy tag_manager_snapshots_read on public.tag_manager_snapshots
  for select to authenticated
  using (public.can_read_metric(workspace_id, account_id, 'gtm.read'));

alter table public.metric_source_references enable row level security;

create policy metric_source_references_read on public.metric_source_references
  for select to authenticated
  using (
    public.has_permission(workspace_id, public.metric_permission(metric_key))
  );

-- --- Alerts and actions -----------------------------------------------------

alter table public.alert_rules enable row level security;

create policy alert_rules_read on public.alert_rules
  for select to authenticated
  using (public.has_permission(workspace_id, 'alerts.read'));

create policy alert_rules_write on public.alert_rules
  for all to authenticated
  using (public.has_permission(workspace_id, 'alerts.manage'))
  with check (public.has_permission(workspace_id, 'alerts.manage'));

alter table public.alerts enable row level security;

create policy alerts_read on public.alerts
  for select to authenticated
  using (public.has_permission(workspace_id, 'alerts.read'));

create policy alerts_write on public.alerts
  for all to authenticated
  using (public.has_permission(workspace_id, 'alerts.manage'))
  with check (public.has_permission(workspace_id, 'alerts.manage'));

alter table public.action_items enable row level security;

create policy action_items_read on public.action_items
  for select to authenticated
  using (public.has_permission(workspace_id, 'alerts.read'));

create policy action_items_write on public.action_items
  for all to authenticated
  using (public.has_permission(workspace_id, 'alerts.manage'))
  with check (public.has_permission(workspace_id, 'alerts.manage'));

alter table public.action_item_events enable row level security;

create policy action_item_events_read on public.action_item_events
  for select to authenticated
  using (
    exists (
      select 1 from public.action_items ai
      where ai.id = action_item_events.action_item_id
        and public.has_permission(ai.workspace_id, 'alerts.read')
    )
  );

create policy action_item_events_insert on public.action_item_events
  for insert to authenticated
  with check (
    exists (
      select 1 from public.action_items ai
      where ai.id = action_item_events.action_item_id
        and public.has_permission(ai.workspace_id, 'alerts.manage')
    )
  );

-- --- Mailbox ----------------------------------------------------------------
-- Separate permission set. `inbox.read` is not implied by any other role,
-- and account-scoped roles additionally need a grant on the mailbox account.

alter table public.mailbox_connections enable row level security;

create policy mailbox_connections_read on public.mailbox_connections
  for select to authenticated
  using (
    public.has_permission(workspace_id, 'inbox.read')
    and public.can_access_account(account_id, 'inbox.read')
  );

create policy mailbox_connections_write on public.mailbox_connections
  for all to authenticated
  using (public.has_permission(workspace_id, 'integrations.manage'))
  with check (public.has_permission(workspace_id, 'integrations.manage'));

alter table public.mailbox_threads enable row level security;

create policy mailbox_threads_read on public.mailbox_threads
  for select to authenticated
  using (
    exists (
      select 1 from public.mailbox_connections m
      where m.id = mailbox_threads.mailbox_id
        and public.has_permission(m.workspace_id, 'inbox.read')
        and public.can_access_account(m.account_id, 'inbox.read')
    )
  );

alter table public.mailbox_messages enable row level security;

create policy mailbox_messages_read on public.mailbox_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.mailbox_connections m
      where m.id = mailbox_messages.mailbox_id
        and public.has_permission(m.workspace_id, 'inbox.read')
        and public.can_access_account(m.account_id, 'inbox.read')
    )
  );

alter table public.mailbox_cursors enable row level security;

create policy mailbox_cursors_read on public.mailbox_cursors
  for select to authenticated
  using (
    exists (
      select 1 from public.mailbox_connections m
      where m.id = mailbox_cursors.mailbox_id
        and public.has_permission(m.workspace_id, 'inbox.read')
        and public.can_access_account(m.account_id, 'inbox.read')
    )
  );

-- --- Reports and AI ---------------------------------------------------------

alter table public.report_definitions enable row level security;

create policy report_definitions_read on public.report_definitions
  for select to authenticated
  using (public.has_permission(workspace_id, 'reports.read'));

create policy report_definitions_write on public.report_definitions
  for all to authenticated
  using (public.has_permission(workspace_id, 'settings.manage'))
  with check (public.has_permission(workspace_id, 'settings.manage'));

alter table public.report_runs enable row level security;

create policy report_runs_read on public.report_runs
  for select to authenticated
  using (public.has_permission(workspace_id, 'reports.read'));

alter table public.ai_insight_requests enable row level security;

create policy ai_insight_requests_read on public.ai_insight_requests
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_permission(workspace_id, 'reports.read')
  );

create policy ai_insight_requests_insert on public.ai_insight_requests
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.has_permission(workspace_id, 'ai.query')
  );

alter table public.ai_insight_sources enable row level security;

create policy ai_insight_sources_read on public.ai_insight_sources
  for select to authenticated
  using (
    exists (
      select 1 from public.ai_insight_requests r
      where r.id = ai_insight_sources.request_id
        and (
          r.user_id = auth.uid()
          or public.has_permission(r.workspace_id, 'reports.read')
        )
    )
  );
