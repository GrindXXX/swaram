-- 0015_triggers.sql
-- Everything the database must guarantee regardless of which client wrote the
-- row. Three surfaces and a worker process all write these tables; anything
-- enforced only in application code is enforced only sometimes.
--
-- The rule with the sharpest edge is the SLA one: a clock is set ONLY for
-- routing_tier = 'ONBOARDED'. Tier 2 and Tier 3 issues get dispatch state
-- instead ("Sent to X - awaiting response", "Published - no authority contact
-- yet"). A countdown against a department that has never heard of Swaram is a
-- lie to the citizen and it poisons every SLA metric downstream.

-- ---------------------------------------------------------------------------
-- Actor resolution
-- ---------------------------------------------------------------------------

-- Who is doing this. Null in cron and worker contexts, which is how a SYSTEM
-- action is distinguished from a human one in the timeline.
create or replace function acting_user_id()
returns uuid language sql stable as $$
  select nullif(
           coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'sub',
         '')::uuid;
$$;

-- ---------------------------------------------------------------------------
-- issue_history -- append-only, never edited, never deleted (PRD S17)
-- ---------------------------------------------------------------------------

create table if not exists issue_history (
  id         bigserial primary key,
  issue_id   uuid not null references issues(id) on delete cascade,
  actor_id   uuid references users(id),
  actor_type text not null default 'SYSTEM'
             check (actor_type in ('CITIZEN','OFFICER','ADMIN','SYSTEM','AGENT')),
  action     text not null,           -- 'STATUS_CHANGED', 'OWNER_CHANGED', ...
  old_value  text,
  new_value  text,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

comment on table issue_history is
  'Powers the citizen status ladder and the officer activity tab. Append-only '
  'by policy (0016): there is no UPDATE or DELETE grant on this table for any '
  'role including ADMIN. An audit log an operator can edit is not an audit log.';

create index issue_history_issue_idx on issue_history (issue_id, created_at);
create index issue_history_actor_idx on issue_history (actor_id);
create index issue_history_action_idx on issue_history (action, created_at desc);

create or replace function log_issue_event(
  p_issue uuid, p_action text, p_old text, p_new text, p_meta jsonb default null
-- security definer because issue_history has no INSERT policy for anyone
-- (0016). The only way a row lands in the audit log is through this function,
-- fired by a trigger -- never through a client statement.
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := acting_user_id();
  v_type  text;
begin
  select case
           when v_actor is null then 'SYSTEM'
           when u.role = 'ADMIN' then 'ADMIN'
           when u.role = 'GOVERNMENT' then 'OFFICER'
           else 'CITIZEN'
         end into v_type
  from users u where u.id = v_actor;

  insert into issue_history (issue_id, actor_id, actor_type, action,
                             old_value, new_value, metadata)
  values (p_issue, v_actor, coalesce(v_type, 'SYSTEM'), p_action,
          p_old, p_new, p_meta);
end $$;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger issues_touch_updated
  before update on issues
  for each row execute function touch_updated_at();

create trigger comments_touch_updated
  before update on comments
  for each row execute function touch_updated_at();

create trigger users_touch_updated
  before update on users
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Counters
-- ---------------------------------------------------------------------------

-- report_count is "27 people affected". It is never the same number as the
-- issue count and never the same number as follower_count; conflating any two
-- of them destroys all three (PRD S03).
-- security definer: a citizen inserting a report must be able to bump the
-- counter on an issue they have no UPDATE policy on. The alternative -- giving
-- citizens UPDATE on issues -- would let them edit status.
create or replace function sync_report_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update issues set report_count = report_count + 1 where id = new.issue_id;

    -- A reporter follows their own issue by default; they can mute without
    -- withdrawing the report.
    if new.user_id is not null then
      insert into issue_followers (issue_id, user_id)
      values (new.issue_id, new.user_id)
      on conflict do nothing;
    end if;

  elsif tg_op = 'DELETE' then
    update issues set report_count = greatest(0, report_count - 1)
     where id = old.issue_id;

  elsif tg_op = 'UPDATE' and new.issue_id is distinct from old.issue_id then
    -- Clustering moves reports between issues. The evidence follows the merge;
    -- both counters must move with it or the crowd count silently inflates.
    update issues set report_count = greatest(0, report_count - 1)
     where id = old.issue_id;
    update issues set report_count = report_count + 1 where id = new.issue_id;
  end if;

  return null;
end $$;

create trigger reports_sync_count
  after insert or update of issue_id or delete on reports
  for each row execute function sync_report_count();

create or replace function sync_follower_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update issues set follower_count = follower_count + 1 where id = new.issue_id;
  else
    update issues set follower_count = greatest(0, follower_count - 1)
     where id = old.issue_id;
  end if;
  return null;
end $$;

create trigger issue_followers_sync_count
  after insert or delete on issue_followers
  for each row execute function sync_follower_count();

-- Flag -> auto-hide at 3 -> human review (PRD S20). Hiding is reversible and
-- the row is never deleted, so an overturned flag restores the comment intact.
-- security definer: flagging a comment must hide it even though the flagger has
-- no UPDATE right on someone else's comment.
create or replace function sync_flag_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'COMMENT' then
    update comments
       set flag_count = flag_count + 1,
           is_hidden  = (flag_count + 1 >= 3),
           hidden_at  = case when flag_count + 1 >= 3 and not is_hidden
                             then now() else hidden_at end
     where id = new.target_id::uuid;
  end if;
  return null;
end $$;

create trigger flags_sync_count
  after insert on flags
  for each row execute function sync_flag_count();

-- ---------------------------------------------------------------------------
-- SLA
-- ---------------------------------------------------------------------------

-- PRD S10's matrix, with per-department overrides from departments.sla_overrides
-- (e.g. {"HIGH": {"ack_hours": 2, "resolve_days": 2}}). Returns nulls for a
-- department that has not onboarded, because there is no promise to express.
create or replace function sla_targets(
  p_priority issue_priority,
  p_department bigint default null
) returns table (ack_interval interval, resolve_interval interval)
language plpgsql stable as $$
declare
  v_over jsonb;
  v_ack  numeric;
  v_res  numeric;
begin
  select d.sla_overrides -> p_priority::text into v_over
    from departments d where d.id = p_department;

  v_ack := (v_over ->> 'ack_hours')::numeric;
  v_res := (v_over ->> 'resolve_days')::numeric;

  return query select
    coalesce(make_interval(hours => v_ack::int),
             case p_priority
               when 'CRITICAL' then interval '1 hour'
               when 'HIGH'     then interval '4 hours'
               when 'MEDIUM'   then interval '1 day'
               when 'LOW'      then interval '2 days'
             end),
    coalesce(make_interval(days => v_res::int),
             case p_priority
               when 'CRITICAL' then interval '24 hours'
               when 'HIGH'     then interval '3 days'
               when 'MEDIUM'   then interval '7 days'
               when 'LOW'      then interval '14 days'
             end);
end $$;

create or replace function set_sla_due_at()
returns trigger language plpgsql as $$
declare
  v_resolve interval;
  v_base    timestamptz;
begin
  -- Tier 2 and Tier 3 get no clock, ever. Not a long one, not a nullable one --
  -- none. If an issue drops out of Tier 1 (the officer's roster row was
  -- deactivated), the clock is removed rather than left running against nobody.
  if new.routing_tier <> 'ONBOARDED' then
    new.sla_due_at := null;
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_base := coalesce(new.created_at, now());
  elsif old.routing_tier <> 'ONBOARDED' then
    -- Just onboarded. The clock starts when a real officer became reachable,
    -- not retroactively from a creation date they could not have acted on.
    v_base := now();
  elsif new.department_id is distinct from old.department_id then
    -- A genuine cross-department re-route restarts the clock; the receiving
    -- department did not have the issue before now (PRD S10).
    v_base := now();
  elsif new.priority is distinct from old.priority then
    -- A re-prioritisation re-measures the SAME elapsed time against the new
    -- target. Basing it on now() would hand a department a fresh window every
    -- time it downgraded a ticket.
    v_base := old.created_at;
  else
    return new;                       -- nothing that affects the clock changed
  end if;

  select s.resolve_interval into v_resolve
    from sla_targets(new.priority, new.department_id) s;

  new.sla_due_at := v_base + v_resolve;
  return new;
end $$;

create trigger issues_set_sla
  before insert or update of priority, routing_tier, department_id on issues
  for each row execute function set_sla_due_at();

-- ---------------------------------------------------------------------------
-- Lifecycle bookkeeping + the activity timeline
-- ---------------------------------------------------------------------------

-- Stamps the lifecycle timestamps from the status transition so they can never
-- disagree with the status itself.
create or replace function stamp_issue_lifecycle()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'ACKNOWLEDGED' and new.acknowledged_at is null then
      new.acknowledged_at := now();
    elsif new.status = 'RESOLVED' and new.resolved_at is null then
      new.resolved_at := now();
    elsif new.status = 'CLOSED' and new.closed_at is null then
      new.closed_at := now();
    elsif new.status = 'REOPENED' then
      -- Reopening genuinely un-resolves the issue. Leaving resolved_at set
      -- would let a department bank the resolution time for a fix that failed.
      new.resolved_at := null;
      new.closed_at   := null;
    end if;
  end if;
  return new;
end $$;

create trigger issues_stamp_lifecycle
  before update of status on issues
  for each row execute function stamp_issue_lifecycle();

create or replace function log_issue_changes()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    perform log_issue_event(new.id, 'STATUS_CHANGED',
                            old.status::text, new.status::text, null);
  end if;

  if new.owner_officer_id is distinct from old.owner_officer_id then
    perform log_issue_event(new.id, 'OWNER_CHANGED',
                            old.owner_officer_id::text,
                            new.owner_officer_id::text, null);
  end if;

  if new.department_id is distinct from old.department_id then
    perform log_issue_event(new.id, 'DEPARTMENT_CHANGED',
                            old.department_id::text, new.department_id::text,
                            jsonb_build_object('authority_id', new.authority_id));
  end if;

  if new.priority is distinct from old.priority then
    perform log_issue_event(new.id, 'PRIORITY_CHANGED',
                            old.priority::text, new.priority::text,
                            jsonb_build_object('sla_due_at', new.sla_due_at));
  end if;

  -- Lowering a visibility class is a supervisor-only action and is logged
  -- specifically, because it is the one moderation action that can expose
  -- someone (PRD S03).
  if new.visibility is distinct from old.visibility then
    perform log_issue_event(new.id,
      case when new.visibility = 'PUBLIC' or old.visibility = 'CONFIDENTIAL'
           then 'VISIBILITY_LOWERED' else 'VISIBILITY_RAISED' end,
      old.visibility::text, new.visibility::text, null);
  end if;

  if new.published_at is distinct from old.published_at
     and new.published_at is not null then
    perform log_issue_event(new.id, 'PUBLISHED', null,
                            new.published_at::text,
                            jsonb_build_object('verdict', new.moderation_verdict));
  end if;

  if new.escalation_level is distinct from old.escalation_level then
    perform log_issue_event(new.id, 'ESCALATED',
                            old.escalation_level::text,
                            new.escalation_level::text, null);
  end if;

  return null;
end $$;

create trigger issues_log_changes
  after update on issues
  for each row execute function log_issue_changes();

create or replace function log_issue_created()
returns trigger language plpgsql as $$
begin
  perform log_issue_event(new.id, 'CREATED', null, new.status::text,
    jsonb_build_object('routing_tier', new.routing_tier,
                       'category_id',  new.category_id,
                       'match_method', new.jurisdiction_match_method));
  return null;
end $$;

create trigger issues_log_created
  after insert on issues
  for each row execute function log_issue_created();

-- Transfers number themselves. The chain is rendered oldest-first and a gap or
-- a duplicate seq breaks the public accountability log.
create or replace function set_transfer_seq()
returns trigger language plpgsql as $$
begin
  if new.seq is null then
    select coalesce(max(seq) + 1, 0) into new.seq
      from issue_transfers where issue_id = new.issue_id;
  end if;
  return new;
end $$;

create trigger issue_transfers_set_seq
  before insert on issue_transfers
  for each row execute function set_transfer_seq();

-- ---------------------------------------------------------------------------
-- Authority registry health
-- ---------------------------------------------------------------------------

-- A bounced or ignored address is worse than no address: it routes a citizen's
-- report into the void while telling them it was sent. Three bounces and the
-- row stops being auto-contactable until a human re-verifies it.
create or replace function downgrade_bounced_authority()
returns trigger language plpgsql as $$
begin
  if new.bounce_count >= 3
     and new.verification_status = 'VERIFIED' then
    new.verification_status := 'SCRAPED_UNVERIFIED';
    new.last_verified_at    := null;
  end if;
  return new;
end $$;

create trigger authorities_downgrade_on_bounce
  before update of bounce_count on authorities
  for each row execute function downgrade_bounced_authority();

comment on function downgrade_bounced_authority is
  'Downgrade, never delete. The row keeps its source and history so an admin '
  'can see what was tried; only its right to be emailed automatically is '
  'revoked. Issues already routed to it fall back to the ULB grievance cell.';

create trigger authorities_touch_updated
  before update on authorities
  for each row execute function touch_updated_at();
