-- =============================================================================
-- CCM 0011 — Sync queue functions.
--
-- The queue is claimed with `FOR UPDATE SKIP LOCKED` so that several workers
-- (or two Vercel invocations racing) never process the same job. The claim
-- happens inside a database function because a plain PostgREST update cannot
-- express a row lock.
-- =============================================================================

create or replace function public.claim_sync_jobs(
  p_workspace_id uuid,
  p_limit integer,
  p_lease_owner text,
  p_lease_seconds integer
)
returns setof public.sync_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select j.id
    from public.sync_jobs j
    where j.status = 'queued'
      and j.run_after <= now()
      and (j.locked_until is null or j.locked_until < now())
      and (p_workspace_id is null or j.workspace_id = p_workspace_id)
    order by j.run_after asc, j.created_at asc
    for update skip locked
    limit greatest(1, least(p_limit, 100))
  )
  update public.sync_jobs j
  set status = 'running',
      locked_until = now() + make_interval(secs => greatest(1, p_lease_seconds)),
      lease_owner = p_lease_owner,
      attempts = j.attempts + 1,
      updated_at = now()
  from candidates c
  where j.id = c.id
  returning j.*;
end;
$$;

create or replace function public.complete_sync_job(
  p_job_id uuid,
  p_status public.sync_job_status,
  p_rows_written integer,
  p_duration_ms integer,
  p_error_code text,
  p_error_message text,
  p_run_after timestamptz,
  p_dead_letter boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sync_jobs
  set status = case
        when p_dead_letter then 'dead_letter'::public.sync_job_status
        else p_status
      end,
      run_after = coalesce(p_run_after, run_after),
      locked_until = null,
      lease_owner = null,
      last_error = coalesce(p_error_message, last_error),
      updated_at = now()
  where id = p_job_id;

  insert into public.sync_runs (
    workspace_id, job_id, status, finished_at, rows_written, duration_ms,
    error_code, error_message
  )
  select
    j.workspace_id,
    j.id,
    case
      when p_dead_letter then 'dead_letter'::public.sync_job_status
      else p_status
    end,
    now(),
    p_rows_written,
    p_duration_ms,
    p_error_code,
    p_error_message
  from public.sync_jobs j
  where j.id = p_job_id;
end;
$$;

create or replace function public.record_sync_error(
  p_workspace_id uuid,
  p_connection_id uuid,
  p_job_id uuid,
  p_error_code text,
  p_error_message text,
  p_retryable boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sync_errors (
    workspace_id, connection_id, job_id, error_code, error_message, retryable
  )
  values (
    p_workspace_id, p_connection_id, p_job_id, p_error_code, p_error_message, p_retryable
  );
end;
$$;

-- The dispatcher calls these with the service role, so no RLS policy is
-- granted to `authenticated` for them.
revoke all on function public.claim_sync_jobs(uuid, integer, text, integer) from public;
revoke all on function public.complete_sync_job(uuid, public.sync_job_status, integer, integer, text, text, timestamptz, boolean) from public;
revoke all on function public.record_sync_error(uuid, uuid, uuid, text, text, boolean) from public;

grant execute on function public.claim_sync_jobs(uuid, integer, text, integer) to service_role;
grant execute on function public.complete_sync_job(uuid, public.sync_job_status, integer, integer, text, text, timestamptz, boolean) to service_role;
grant execute on function public.record_sync_error(uuid, uuid, uuid, text, text, boolean) to service_role;
