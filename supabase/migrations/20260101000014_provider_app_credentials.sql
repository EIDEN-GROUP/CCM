-- =============================================================================
-- CCM 0014 — Provider application credentials.
--
-- The client id and the client secret of a provider's app are deployment
-- configuration, not workspace content. They are stored per workspace so
-- that:
--
--   * the owner can enter them in the interface instead of editing .env and
--     redeploying — which is what made connecting a provider a chore;
--   * the secret is encrypted at rest with AES-256-GCM, bound to the row, so
--     it cannot be moved between providers;
--   * the RLS model stays uniform: every row carries a workspace_id, so the
--     authorisation helpers apply unchanged.
--
-- A row records that an app is *configured*. It never records that the
-- provider is *connected* — that is `provider_connections`, and it is only
-- written after a real OAuth round trip succeeds.
--
-- The plaintext secret is never returned by any endpoint. The settings
-- screen shows which providers are configured, never their values.
-- =============================================================================

create table if not exists public.provider_app_credentials (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  provider_key     text not null references public.provider_definitions(key) on delete cascade,
  -- The public half: the client id, the app id, or an API key.
  client_id        text not null,
  -- The private half, encrypted. Null for a provider that only needs a key.
  encrypted_secret text,
  -- A non-reversible fingerprint, so a rotated secret is detectable.
  key_fingerprint  text,
  -- The exact redirect URI registered with the provider.
  redirect_uri     text,
  -- The scopes the owner has granted. Informational; the OAuth request
  -- carries the scope list the provider config asks for.
  scopes           text[] not null default '{}',
  notes            text,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (workspace_id, provider_key)
);

create index if not exists provider_app_credentials_workspace_idx
  on public.provider_app_credentials (workspace_id, provider_key);

alter table public.provider_app_credentials enable row level security;

-- Only somebody who can manage the workspace settings may see or change an
-- app credential. The OAuth routes read the secret with the service role
-- after a permission check, so a broader role does not need table access.
create policy provider_app_credentials_read on public.provider_app_credentials
  for select to authenticated
  using (public.has_permission(workspace_id, 'settings.manage'));

create policy provider_app_credentials_write on public.provider_app_credentials
  for all to authenticated
  using (public.has_permission(workspace_id, 'settings.manage'))
  with check (public.has_permission(workspace_id, 'settings.manage'));
