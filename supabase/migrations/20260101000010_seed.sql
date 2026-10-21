-- =============================================================================
-- CCM 0010 — Seed data: roles, provider catalogue and the metric registry.
--
-- The role/permission matrix here is the authority. The TypeScript mirror in
-- src/domain/permissions.ts exists for UI affordances; a test asserts the two
-- stay in step.
-- =============================================================================

insert into public.roles (key, label, account_scoped, description) values
  ('owner',             'Owner',              false, 'Full control including workspace ownership and deletion.'),
  ('admin',             'Administrator',      false, 'Full control of features, users and connections.'),
  ('marketing_analyst', 'Marketing Analyst',  false, 'Reads every channel; manages alerts and exports.'),
  ('seo',                'SEO',                false, 'Search Console, rankings and technical SEO.'),
  ('ads_manager',        'Ads Manager',        false, 'Paid media reporting.'),
  ('social_manager',     'Social Manager',     false, 'Social accounts, content and inbox.'),
  ('mailbox_user',       'Mailbox User',       true,  'Only the mailboxes explicitly granted to them.'),
  ('read_only',          'Read-only',          false, 'Can view reporting but change nothing.')
on conflict (key) do update
  set label = excluded.label,
      account_scoped = excluded.account_scoped,
      description = excluded.description;

-- owner / admin / read_only permissions are expanded explicitly so the table
-- stays readable in the Supabase dashboard.
insert into public.role_permissions (role, permission)
select 'owner', permission from unnest(array[
  'overview.read','websites.read','ads.read','analytics.read','gtm.read','seo.read',
  'ux.read','social.read','inbox.read','inbox.send','alerts.read','alerts.manage',
  'reports.read','reports.export','integrations.read','integrations.manage',
  'settings.manage','audit.read','launch.read','launch.execute','ai.query'
]) as permission
on conflict do nothing;

insert into public.role_permissions (role, permission)
select 'admin', permission from unnest(array[
  'overview.read','websites.read','ads.read','analytics.read','gtm.read','seo.read',
  'ux.read','social.read','inbox.read','inbox.send','alerts.read','alerts.manage',
  'reports.read','reports.export','integrations.read','integrations.manage',
  'settings.manage','audit.read','launch.read','launch.execute','ai.query'
]) as permission
on conflict do nothing;

insert into public.role_permissions (role, permission)
select 'marketing_analyst', permission from unnest(array[
  'overview.read','websites.read','ads.read','analytics.read','gtm.read','seo.read',
  'ux.read','social.read','alerts.read','alerts.manage','reports.read','reports.export',
  'launch.read','launch.execute','ai.query'
]) as permission
on conflict do nothing;

insert into public.role_permissions (role, permission)
select 'seo', permission from unnest(array[
  'overview.read','websites.read','seo.read','analytics.read','reports.read',
  'reports.export','launch.read','launch.execute','ai.query'
]) as permission
on conflict do nothing;

insert into public.role_permissions (role, permission)
select 'ads_manager', permission from unnest(array[
  'overview.read','websites.read','ads.read','analytics.read','reports.read',
  'reports.export','launch.read','launch.execute','ai.query'
]) as permission
on conflict do nothing;

insert into public.role_permissions (role, permission)
select 'social_manager', permission from unnest(array[
  'overview.read','social.read','inbox.read','reports.read','reports.export',
  'launch.read','launch.execute','ai.query'
]) as permission
on conflict do nothing;

insert into public.role_permissions (role, permission)
select 'mailbox_user', permission from unnest(array[
  'inbox.read','inbox.send','launch.read'
]) as permission
on conflict do nothing;

insert into public.role_permissions (role, permission)
select 'read_only', permission from unnest(array[
  'overview.read','websites.read','ads.read','analytics.read','gtm.read','seo.read',
  'ux.read','social.read','alerts.read','reports.read','launch.read'
]) as permission
on conflict do nothing;

-- --- Provider catalogue -----------------------------------------------------

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

-- --- Metric registry --------------------------------------------------------

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