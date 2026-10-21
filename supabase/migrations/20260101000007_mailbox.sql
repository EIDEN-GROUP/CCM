-- =============================================================================
-- CCM 0007 — Unified mailbox.
--
-- Mailbox content is isolated from the rest of the product:
--   * Separate tables with their own policies and their own permission set.
--   * Message bodies and attachments are NOT stored by default. Only metadata
--     and a short snippet are cached, and the snippet may contain patient
--     content, so it never leaves this schema: no analytics table, no AI
--     prompt, no export, no log line.
--   * AI processing is opt-in per mailbox and defaults to off.
-- =============================================================================

create table if not exists public.mailbox_connections (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  -- The mailbox is modelled as an external account so that account-scoped
  -- roles (for example `mailbox_user`) can be granted access to exactly one
  -- mailbox through the same mechanism as every other account.
  account_id     uuid not null references public.external_accounts(id) on delete cascade,
  provider_key   text not null references public.provider_definitions(key),
  mailbox_email  text not null,
  display_label  text not null,
  -- oauth (Gmail/Workspace, Microsoft Graph) | imap | smtp
  auth_method    text not null default 'oauth',
  host           text,
  port           integer,
  username       text,
  status         public.connection_status not null default 'needs_setup',
  scopes         text[] not null default '{}',
  -- Opt-in per mailbox. Never enabled by default.
  ai_processing_enabled boolean not null default false,
  last_sync_at   timestamptz,
  last_error     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (workspace_id, mailbox_email)
);

create table if not exists public.mailbox_threads (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  mailbox_id     uuid not null references public.mailbox_connections(id) on delete cascade,
  provider_thread_id text not null,
  subject        text,
  -- Short preview. May contain sensitive content — see the file header.
  snippet        text,
  participant_count integer,
  message_count  integer,
  is_unread      boolean not null default false,
  is_starred     boolean not null default false,
  has_attachments boolean not null default false,
  last_message_at timestamptz,
  labels         text[] not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (mailbox_id, provider_thread_id)
);

create index if not exists mailbox_threads_mailbox_idx
  on public.mailbox_threads (mailbox_id, last_message_at desc);

create table if not exists public.mailbox_messages (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  mailbox_id     uuid not null references public.mailbox_connections(id) on delete cascade,
  thread_id      uuid references public.mailbox_threads(id) on delete cascade,
  provider_message_id text not null,
  from_address   text,
  from_name      text,
  to_addresses   text[] not null default '{}',
  cc_addresses   text[] not null default '{}',
  subject        text,
  -- 'none' | 'provider'. CCM stores metadata by default; a full body is
  -- fetched on demand from the provider and is never persisted here.
  body_storage   text not null default 'none',
  body_size_bytes integer,
  snippet        text,
  sent_at        timestamptz,
  received_at    timestamptz,
  is_unread      boolean not null default false,
  is_draft       boolean not null default false,
  labels         text[] not null default '{}',
  source_fetched_at timestamptz not null default now(),
  unique (mailbox_id, provider_message_id)
);

create index if not exists mailbox_messages_thread_idx
  on public.mailbox_messages (thread_id, received_at desc);

-- Provider pagination / history cursors so a mailbox sync resumes rather
-- than restarting.
create table if not exists public.mailbox_cursors (
  mailbox_id   uuid not null references public.mailbox_connections(id) on delete cascade,
  stream       text not null,
  cursor_value text,
  history_id   text,
  updated_at   timestamptz not null default now(),
  primary key (mailbox_id, stream)
);
