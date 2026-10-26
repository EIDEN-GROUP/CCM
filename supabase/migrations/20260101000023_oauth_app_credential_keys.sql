-- Application credentials are keyed by the OAuth app, while provider_definitions
-- lists account products (ga4, google_ads, etc.). The Google OAuth app therefore
-- intentionally has the key "google", which is not an account provider key.
alter table public.provider_app_credentials
  drop constraint if exists provider_app_credentials_provider_key_fkey;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'provider_app_credentials_provider_key_check'
      and conrelid = 'public.provider_app_credentials'::regclass
  ) then
    alter table public.provider_app_credentials
      add constraint provider_app_credentials_provider_key_check
      check (provider_key in ('google', 'meta', 'linkedin'));
  end if;
end $$;
