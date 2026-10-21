-- =============================================================================
-- CCM 0013 — Provider quota accounting.
--
-- A provider that has an operations quota (Google Ads, Ahrefs, Meta) needs the
-- usage recorded, or the quota cannot be respected before the provider
-- rejects a call.
--
-- `add_provider_quota_usage` increments the counter atomically, so two
-- workers cannot lose an update between a read and a write.
--
-- The counter resets when the quota window rolls over, which the caller
-- signals by passing a window start.
-- =============================================================================

create or replace function public.add_provider_quota_usage(
  p_connection_id uuid,
  p_calls        integer,
  p_window_start timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
begin
  update public.provider_connections
     set quota_used = case
                         when p_window_start is not null
                          and quota_window_started_at is distinct from p_window_start
                           then p_calls
                         else quota_used + p_calls
                       end,
         quota_window_started_at = coalesce(p_window_start, quota_window_started_at),
         updated_at = now()
   where id = p_connection_id
   returning quota_used into v_used;

  return coalesce(v_used, 0);
end;
$$;

revoke all on function public.add_provider_quota_usage(uuid, integer, timestamptz) from public;
grant execute on function public.add_provider_quota_usage(uuid, integer, timestamptz) to service_role;

-- The quota check the worker makes before every provider call. It returns
-- true when there is room left.
create or replace function public.has_provider_quota(
  p_connection_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select quota_limit is null or quota_used < quota_limit
        from public.provider_connections
       where id = p_connection_id
    ),
    true
  );
$$;

revoke all on function public.has_provider_quota(uuid) from public;
grant execute on function public.has_provider_quota(uuid) to service_role;
