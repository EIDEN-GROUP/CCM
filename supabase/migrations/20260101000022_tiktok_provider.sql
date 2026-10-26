-- TikTok browser launch support. API analytics and account discovery remain
-- unavailable until a separate, approved connector is implemented.
insert into public.provider_definitions
  (key, display_name, category, api_version, hosts, docs_url, blocking_approvals)
values
  ('tiktok', 'TikTok', 'social', 'n/a', array['www.tiktok.com']::text[],
   'https://developers.tiktok.com/', array[]::text[])
on conflict (key) do update
  set display_name = excluded.display_name,
      category = excluded.category,
      api_version = excluded.api_version,
      hosts = excluded.hosts,
      docs_url = excluded.docs_url,
      blocking_approvals = excluded.blocking_approvals,
      updated_at = now();
