-- =============================================================================
-- CCM 0018 — The launch ticket's single-use guard.
--
-- `launch_tickets` had a SELECT policy and an INSERT policy, but no UPDATE
-- policy. The update that marks a ticket consumed therefore matched no rows,
-- and two things followed:
--
--   * every launch outcome report was refused with "already used", so the
--     launch audit trail stayed empty;
--   * the durable replay guard never fired, and a ticket stayed consumable
--     for its whole sixty-second lifetime.
--
-- The policy is scoped to the ticket's own owner, so one person's ticket
-- cannot be consumed by another.
-- =============================================================================

create policy launch_tickets_update on public.launch_tickets
  for update to authenticated
  using (user_id = auth.uid() and public.has_permission(workspace_id, 'launch.execute'))
  with check (user_id = auth.uid() and public.has_permission(workspace_id, 'launch.execute'));
