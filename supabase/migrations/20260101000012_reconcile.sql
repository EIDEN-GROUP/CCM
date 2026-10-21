-- =============================================================================
-- CCM 0012 — Reconciliation.
--
-- Two jobs:
--
--   1. Create the alert/action tables if they are missing. Migration 0006
--      failed on an earlier deployment because of a bad foreign key
--      (`public.auth.users` instead of `auth.users`), and a failed migration
--      leaves the alert queue unavailable. The statements below are
--      idempotent, so running them repairs a partial deployment without
--      touching anything that already exists.
--
--   2. Re-apply the seed data. The roles, the permission matrix, the
--      provider catalogue and the metric registry are the authority for
--      what the application may read and write, and they must exist even
--      if the original seed migration was skipped or partially applied.
--
-- Every statement is idempotent: running this migration twice is safe.
-- =============================================================================

-- --- The alert queue -------------------------------------------------------

create table if not exists public.alert_rules (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  metric            text not null,
  direction         text not null check (direction in ('increase', 'decrease')),
  threshold         numeric not null,
  severity          text not null default 'warning',
  min_volume        numeric not null default 0,
  hysteresis_windows integer not null default 2,
  grace_windows     integer not null default 7,
  quiet_hours       jsonb,
  min_repeat_hours  integer not null default 24,
  scope             jsonb,
  enabled           boolean not null default true,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.alerts (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  rule_id        uuid references public.alert_rules(id) on delete set null,
  account_id     uuid references public.external_accounts(id) on delete cascade,
  website_id     uuid references public.websites(id) on delete cascade,
  metric         text not null,
  severity       text not null default 'warning',
  title          text not null,
  reason         text not null,
  observed       numeric,
  baseline       numeric,
  confidence     numeric,
  status         text not null default 'open'
                   check (status in ('open','acknowledged','snoozed','resolved')),
  owner_user_id  uuid references auth.users(id) on delete set null,
  due_at         timestamptz,
  source_ref     jsonb not null default '{}'::jsonb,
  opened_at      timestamptz not null default now(),
  resolved_at    timestamptz,
  resolution_note text
);

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

create table if not exists public.action_item_events (
  id             uuid primary key default gen_random_uuid(),
  action_item_id uuid not null references public.action_items(id) on delete cascade,
  actor_user_id  uuid references auth.users(id) on delete set null,
  event_type     text not null,
  note           text,
  created_at     timestamptz not null default now()
);

create index if not exists alert_rules_workspace_idx
  on public.alert_rules (workspace_id, enabled);

create index if not exists alerts_workspace_status_idx
  on public.alerts (workspace_id, status, severity, opened_at desc);

create index if not exists action_items_workspace_idx
  on public.action_items (workspace_id, status, created_at desc);

create index if not exists action_item_events_item_idx
  on public.action_item_events (action_item_id, created_at desc);

-- Row Level Security, in case 0006 was applied before its policies existed.
alter table public.alert_rules enable row level security;
alter table public.alerts enable row level security;
alter table public.action_items enable row level security;
alter table public.action_item_events enable row level security;

drop policy if exists alert_rules_read on public.alert_rules;
create policy alert_rules_read on public.alert_rules
  for select to authenticated
  using (public.has_permission(workspace_id, 'alerts.read'));

drop policy if exists alert_rules_write on public.alert_rules;
create policy alert_rules_write on public.alert_rules
  for all to authenticated
  using (public.has_permission(workspace_id, 'alerts.manage'))
  with check (public.has_permission(workspace_id, 'alerts.manage'));

drop policy if exists alerts_read on public.alerts;
create policy alerts_read on public.alerts
  for select to authenticated
  using (public.has_permission(workspace_id, 'alerts.read'));

drop policy if exists alerts_write on public.alerts;
create policy alerts_write on public.alerts
  for all to authenticated
  using (public.has_permission(workspace_id, 'alerts.manage'))
  with check (public.has_permission(workspace_id, 'alerts.manage'));

drop policy if exists action_items_read on public.action_items;
create policy action_items_read on public.action_items
  for select to authenticated
  using (public.has_permission(workspace_id, 'alerts.read'));

drop policy if exists action_items_write on public.action_items;
create policy action_items_write on public.action_items
  for all to authenticated
  using (public.has_permission(workspace_id, 'alerts.manage'))
  with check (public.has_permission(workspace_id, 'alerts.manage'));

drop policy if exists action_item_events_read on public.action_item_events;
create policy action_item_events_read on public.action_item_events
  for select to authenticated
  using (
    exists (
      select 1 from public.action_items ai
      where ai.id = action_item_events.action_item_id
        and public.has_permission(ai.workspace_id, 'alerts.read')
    )
  );

drop policy if exists action_item_events_insert on public.action_item_events;
create policy action_item_events_insert on public.action_item_events
  for insert to authenticated
  with check (
    exists (
      select 1 from public.action_items ai
      where ai.id = action_item_events.action_item_id
        and public.has_permission(ai.workspace_id, 'alerts.manage')
    )
  );

-- --- Seed data: the role matrix -------------------------------------------

insert into public.roles (key, label, account_scoped, description) values
  ('owner',             'Owner',              false, 'Full control including workspace ownership and deletion.'),
  ('admin',             'Administrator',      false, 'Full control of features, users and connections.'),
  ('marketing_analyst', 'Marketing Analyst',  false, 'Reads every channel; manages alerts and exports.'),
  ('seo',               'SEO',                false, 'Search Console, rankings and technical SEO.'),
  ('ads_manager',       'Ads Manager',        false, 'Paid media reporting.'),
  ('social_manager',    'Social Manager',     false, 'Social accounts, content and inbox.'),
  ('mailbox_user',      'Mailbox User',       true,  'Only the mailboxes explicitly granted to them.'),
  ('read_only',         'Read-only',          false, 'Can view reporting but change nothing.')
on conflict (key) do update
  set label = excluded.label,
      account_scoped = excluded.account_scoped,
      description = excluded.description;

insert into public.role_permissions (role, permission)
select r.role, r.permission
from (values
  ('owner',             'overview.read'), ('owner',             'websites.read'),
  ('owner',             'ads.read'),      ('owner',             'analytics.read'),
  ('owner',             'gtm.read'),      ('owner',             'seo.read'),
  ('owner',             'ux.read'),       ('owner',             'social.read'),
  ('owner',             'inbox.read'),    ('owner',             'inbox.send'),
  ('owner',             'alerts.read'),   ('owner',             'alerts.manage'),
  ('owner',             'reports.read'),  ('owner',             'reports.export'),
  ('owner',             'integrations.read'), ('owner',          'integrations.manage'),
  ('owner',             'settings.manage'), ('owner',           'audit.read'),
  ('owner',             'launch.read'),   ('owner',             'launch.execute'),
  ('owner',             'ai.query'),

  ('admin',             'overview.read'), ('admin',             'websites.read'),
  ('admin',             'ads.read'),      ('admin',             'analytics.read'),
  ('admin',             'gtm.read'),      ('admin',             'seo.read'),
  ('admin',             'ux.read'),       ('admin',             'social.read'),
  ('admin',             'inbox.read'),    ('admin',             'inbox.send'),
  ('admin',             'alerts.read'),   ('admin',             'alerts.manage'),
  ('admin',             'reports.read'),  ('admin',             'reports.export'),
  ('admin',             'integrations.read'), ('admin',          'integrations.manage'),
  ('admin',             'settings.manage'), ('admin',           'audit.read'),
  ('admin',             'launch.read'),   ('admin',             'launch.execute'),
  ('admin',             'ai.query'),

  ('marketing_analyst', 'overview.read'), ('marketing_analyst', 'websites.read'),
  ('marketing_analyst', 'ads.read'),      ('marketing_analyst', 'analytics.read'),
  ('marketing_analyst', 'gtm.read'),      ('marketing_analyst', 'seo.read'),
  ('marketing_analyst', 'ux.read'),       ('marketing_analyst', 'social.read'),
  ('marketing_analyst', 'alerts.read'),   ('marketing_analyst', 'alerts.manage'),
  ('marketing_analyst', 'reports.read'),  ('marketing_analyst', 'reports.export'),
  ('marketing_analyst', 'launch.read'),   ('marketing_analyst', 'launch.execute'),
  ('marketing_analyst', 'ai.query'),

  ('seo',               'overview.read'), ('seo',               'websites.read'),
  ('seo',               'seo.read'),      ('seo',               'analytics.read'),
  ('seo',               'reports.read'),  ('seo',               'reports.export'),
  ('seo',               'launch.read'),   ('seo',               'launch.execute'),
  ('seo',               'ai.query'),

  ('ads_manager',       'overview.read'), ('ads_manager',       'websites.read'),
  ('ads_manager',       'ads.read'),      ('ads_manager',       'analytics.read'),
  ('ads_manager',       'reports.read'),  ('ads_manager',       'reports.export'),
  ('ads_manager',       'launch.read'),   ('ads_manager',       'launch.execute'),
  ('ads_manager',       'ai.query'),

  ('social_manager',    'overview.read'), ('social_manager',    'social.read'),
  ('social_manager',    'inbox.read'),    ('social_manager',    'reports.read'),
  ('social_manager',    'reports.export'), ('social_manager',   'launch.read'),
  ('social_manager',    'launch.execute'), ('social_manager',   'ai.query'),

  ('mailbox_user',      'inbox.read'),    ('mailbox_user',      'inbox.send'),
  ('mailbox_user',      'launch.read'),

  ('read_only',         'overview.read'), ('read_only',         'websites.read'),
  ('read_only',         'ads.read'),      ('read_only',         'analytics.read'),
  ('read_only',         'gtm.read'),      ('read_only',         'seo.read'),
  ('read_only',         'ux.read'),       ('read_only',         'social.read'),
  ('read_only',         'alerts.read'),   ('read_only',         'reports.read'),
  ('read_only',         'launch.read')
) as r(role, permission)
on conflict (role, permission) do nothing;

-- --- Seed data: the provider catalogue ------------------------------------

insert into public.provider_definitions
  (key, display_name, category, api_version, hosts, docs_url, blocking_approvals)
values
  ('google_ads', 'Google Ads', 'advertising', 'v25', '{ads.google.com,adwords.google.com}',
   'https://developers.google.com/google-ads/api/docs/start',
   array['Google Ads API access level applied for on the Google Cloud project (Explorer for production read access).',
         'Brand verification for Basic or Standard access levels.']),
  ('ga4', 'GA4', 'analytics', 'v1beta', '{analytics.google.com}',
   'https://developers.google.com/analytics/devguides/reporting/data/v1',
   array['Analytics Data API enabled on the Google Cloud project']),
  ('gsc', 'Search Console', 'search', 'v1', '{search.google.com}',
   'https://developers.google.com/webmaster-tools/v1/searchanalytics/query',
   array['Search Console API enabled', 'Property verified']),
  ('gtm', 'GTM', 'tagging', 'v2', '{tagmanager.google.com}',
   'https://developers.google.com/tag-platform/tag-manager/api/v2',
   array['Tag Manager API enabled and container shared with the OAuth client']),
  ('youtube', 'YouTube', 'social', 'v3', '{studio.youtube.com,www.youtube.com}',
   'https://developers.google.com/youtube/v3',
   array['YouTube Data API and YouTube Analytics API enabled']),
  ('gmail', 'Gmail', 'email', 'v1', '{mail.google.com}',
   'https://developers.google.com/workspace/gmail/api/guides',
   array['Gmail API enabled', 'Restricted-scope verification or security assessment if the scopes used are restricted']),
  ('meta', 'Meta / Facebook', 'social', 'v23.0',
   '{www.facebook.com,business.facebook.com,graph.facebook.com}',
   'https://developers.facebook.com/docs/graph-api/',
   array['Meta app with the required pages and insights permissions', 'App review for any publishing permission']),
  ('instagram', 'Instagram', 'social', 'v23.0', '{www.instagram.com,graph.facebook.com}',
   'https://developers.facebook.com/docs/instagram-api/',
   array['Instagram professional account linked to a Facebook Page', 'App review for the insights permissions']),
  ('linkedin', 'LinkedIn', 'social', '2026-10', '{www.linkedin.com}',
   'https://learn.microsoft.com/en-us/linkedin/marketing/integrations/migrations',
   array['LinkedIn app with organisation admin access and approved Marketing API scopes']),
  ('ahrefs', 'SEO / Rankings', 'seo', 'v3', '{app.ahrefs.com,docs.ahrefs.com}',
   'https://docs.ahrefs.com/',
   array['Ahrefs API key with units available on the subscribed plan']),
  ('clarity', 'Clarity / UX', 'ux', 'export-v1', '{clarity.microsoft.com}',
   'https://learn.microsoft.com/en-us/clarity/',
   array['Clarity project ID; API token if the plan exposes one']),
  ('pagespeed', 'PageSpeed', 'site', 'v5', '{pagespeed.web.dev,www.googleapis.com}',
   'https://developers.google.com/speed/docs/insights/v5/get-started',
   array['PageSpeed Insights API enabled']),
  ('uptime', 'Uptime / SSL', 'site', 'n/a', '{www.google.com}',
   'https://developers.google.com/speed/docs/insights/v5/get-started', '{}')
on conflict (key) do update
  set display_name = excluded.display_name,
      category = excluded.category,
      api_version = excluded.api_version,
      hosts = excluded.hosts,
      docs_url = excluded.docs_url,
      blocking_approvals = excluded.blocking_approvals,
      updated_at = now();

-- --- Seed data: the metric registry ---------------------------------------

insert into public.metric_definitions
  (key, display_name, definition, formula, connector, source_field, unit, grain,
   currency_aware, aggregation, dimensions, attribution_notes, caveats, freshness_target_seconds)
values
  ('ads.spend', 'Ad spend',
   'Total spend reported by Google Ads for the selected period.',
   'SUM(cost_micros) / 1000000', 'google_ads', 'metrics.cost_micros', 'currency', 'day',
   true, 'sum', '{campaign,ad_group,device,geo,network}',
   'Spend is attributed by Google Ads reporting, not by CCM.',
   array['Stored in micros of the account currency.',
         'Do not sum across accounts with different currencies without a dated exchange rate.',
         'Google Ads conversion data lags roughly 24-48 hours.'],
   10800),

  ('ads.conversions', 'Conversions',
   'Conversions attributed by Google Ads for the selected period.',
   'SUM(conversions)', 'google_ads', 'metrics.conversions', 'count', 'day',
   false, 'sum', '{campaign,ad_group,device,geo,network}',
   'Uses the Google Ads attribution model and the conversion actions configured in the account.',
   array['Not comparable with GA4 key events: different attribution windows and different conversion definitions.',
         'Attribution model, lookback window and conversion-action scope are account settings, not CCM settings.'],
   10800),

  ('ads.conversion_value', 'Conversion value',
   'Monetary value Google Ads attributes to conversions.',
   'SUM(conversion_value_micros) / 1000000', 'google_ads', 'metrics.conversion_value_micros',
   'currency', 'day', true, 'sum', '{campaign,ad_group}',
   'Only present when the account reports conversion value. If absent, ROAS is unavailable rather than zero.',
   array['Reported by the provider; CCM does not model or forecast value.'], 10800),

  ('ads.clicks', 'Clicks', 'Clicks reported by Google Ads.', 'SUM(clicks)',
   'google_ads', 'metrics.clicks', 'count', 'day', false, 'sum',
   '{campaign,ad_group,device,geo,network}', null, '{}', 10800),

  ('ads.impressions', 'Impressions', 'Impressions reported by Google Ads.',
   'SUM(impressions)', 'google_ads', 'metrics.impressions', 'count', 'day', false, 'sum',
   '{campaign,ad_group,device,geo,network}', null, '{}', 10800),

  ('ads.ctr', 'Click-through rate', 'Clicks divided by impressions.',
   'SUM(clicks) / SUM(impressions)', 'google_ads', 'metrics.ctr', 'ratio', 'day',
   false, 'ratio', '{campaign,ad_group,device}', null,
   array['Undefined when impressions are zero; shown as unavailable rather than 0%.'], 10800),

  ('ads.cpc', 'Average cost per click', 'Spend divided by clicks.',
   'SUM(cost_micros) / SUM(clicks) / 1000000', 'google_ads', 'metrics.average_cpc',
   'currency', 'day', true, 'ratio', '{campaign,ad_group,device}', null,
   array['Undefined when clicks are zero.'], 10800),

  ('ads.cpa', 'Cost per conversion', 'Spend divided by conversions.',
   'SUM(cost_micros) / SUM(conversions) / 1000000', 'google_ads', 'metrics.cost_per_conversion',
   'currency', 'day', true, 'ratio', '{campaign,ad_group}',
   'Inherits the Google Ads attribution model.',
   array['Undefined when conversions are zero.'], 10800),

  ('ads.roas', 'Return on ad spend', 'Conversion value divided by spend.',
   'SUM(conversion_value_micros) / SUM(cost_micros)', 'google_ads', 'metrics.roas',
   'ratio', 'day', true, 'ratio', '{campaign,ad_group}',
   null,
   array['Unavailable when the account does not report conversion value.',
         'Requires matching currencies.'], 10800),

  ('ga4.sessions', 'Sessions', 'Sessions reported by GA4.', 'SUM(sessions)',
   'ga4', 'sessions', 'count', 'day', false, 'sum',
   '{source,landing_page,device,geo}', null,
   array['GA4 reports with roughly 24 hours of delay.'], 10800),

  ('ga4.active_users', 'Active users', 'Distinct active users reported by GA4.',
   'SUM(active_users)', 'ga4', 'activeUsers', 'count', 'day', false, 'sum',
   '{source,landing_page,device,geo}', null,
   array['Active users are not additive across days; a daily sum is not a monthly total.'], 10800),

  ('ga4.key_events', 'Key events', 'Key events reported by GA4.', 'SUM(key_events)',
   'ga4', 'keyEvents', 'count', 'day', false, 'sum', '{event,landing_page,source}',
   'Key events use the GA4 attribution model, which differs from Google Ads.',
   array['Not comparable with Google Ads conversions without a stated definition check.'], 10800),

  ('ga4.engagement_rate', 'Engagement rate', 'Engaged sessions divided by sessions.',
   'SUM(engaged_sessions) / SUM(sessions)', 'ga4', 'engagedSessions', 'ratio', 'day',
   false, 'ratio', '{source,landing_page,device}', null, '{}', 10800),

  ('gsc.clicks', 'Organic clicks', 'Clicks reported by Google Search Console.',
   'SUM(clicks)', 'gsc', 'clicks', 'count', 'day', false, 'sum',
   '{query,page,country,device,search_type}', null,
   array['The query endpoint returns aggregated rows; it does not return every query.'], 43200),

  ('gsc.impressions', 'Organic impressions', 'Impressions reported by Google Search Console.',
   'SUM(impressions)', 'gsc', 'impressions', 'count', 'day', false, 'sum',
   '{query,page,country,device,search_type}', null,
   array['Aggregated by the API, not a complete query list.'], 43200),

  ('gsc.ctr', 'Organic click-through rate', 'Clicks divided by impressions.',
   'SUM(clicks) / SUM(impressions)', 'gsc', 'ctr', 'ratio', 'day', false, 'ratio',
   '{query,page,country,device}', null,
   array['Undefined when impressions are zero.'], 43200),

  ('gsc.position', 'Average position', 'Impression-weighted average position.',
   'SUM(position * impressions) / SUM(impressions)', 'gsc', 'position', 'position', 'day',
   false, 'weighted_average', '{query,page,country,device}', null,
   array['Impression-weighted, matching how Google reports a blended average.',
         'Distinct from third-party rank observations, which CCM stores separately.'], 43200),

  ('social.impressions', 'Social impressions', 'Impressions reported by the social platform.',
   'SUM(impressions)', 'meta,instagram,linkedin,youtube', 'impressions', 'count', 'day',
   false, 'sum', '{platform,account,post}',
   null,
   array['Organic profile analytics and paid social results are separate series and are never merged.',
         'Availability depends on account type and API approval.'], 21600),

  ('social.engagements', 'Social engagements', 'Engagements reported by the social platform.',
   'SUM(engagements)', 'meta,instagram,linkedin,youtube', 'engagements', 'count', 'day',
   false, 'sum', '{platform,account,post}', null,
   array['Platforms define engagement differently; cross-platform totals are not comparable.'], 21600),

  ('social.engagement_rate', 'Social engagement rate',
   'Engagements divided by reach, using the documented CCM formula.',
   'SUM(engagements) / SUM(reach)', 'meta,instagram,linkedin,youtube', 'derived',
   'ratio', 'day', false, 'ratio', '{platform,account}',
   null,
   array['Formula is engagements / reach. Platforms publishing their own rate may use a different denominator.'], 21600),

  ('site.uptime', 'Site uptime', 'Share of checks that succeeded.',
   'successful_checks / total_checks', 'uptime', 'status', 'ratio', 'day', false, 'ratio',
   '{website}', null, '{}', 300),

  ('site.response_time', 'Response time', 'Median response time for successful checks.',
   'median(response_time_ms)', 'uptime', 'response_time_ms', 'milliseconds', 'day',
   false, 'median', '{website}', null, '{}', 300)
on conflict (key) do update
  set display_name = excluded.display_name,
      definition = excluded.definition,
      formula = excluded.formula,
      connector = excluded.connector,
      source_field = excluded.source_field,
      unit = excluded.unit,
      grain = excluded.grain,
      currency_aware = excluded.currency_aware,
      aggregation = excluded.aggregation,
      dimensions = excluded.dimensions,
      attribution_notes = excluded.attribution_notes,
      caveats = excluded.caveats,
      freshness_target_seconds = excluded.freshness_target_seconds,
      updated_at = now();
