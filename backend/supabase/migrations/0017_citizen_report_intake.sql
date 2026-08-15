-- 0017_citizen_report_intake.sql
-- The first browser-to-database vertical slice: one explicit citizen action
-- atomically creates one Issue and its first Report. Intake and clustering stay
-- asynchronous and therefore can never block submission.

-- A device mints this before its first attempt. Retrying after a timeout must
-- return the original record rather than creating another civic problem.
alter table reports add column client_report_id uuid;

create unique index reports_user_client_id_idx
  on reports (user_id, client_report_id)
  where user_id is not null and client_report_id is not null;

comment on column reports.client_report_id is
  'Device-generated idempotency key. Unique per user so offline retries create '
  'one Issue and one Report, not duplicates.';

-- Older migrations allowed a nullable report pin even though the product model
-- requires one. Existing rows inherit their issue pin before the invariant is
-- tightened; all new reports must carry their own location.
update reports r
   set location = i.location
  from issues i
 where r.issue_id = i.id
   and r.location is null;

alter table reports alter column location set not null;

-- 0016's guard said citizens could not choose objective severity or routing,
-- but it only reset some of those columns. Enforce the documented boundary.
create or replace function guard_issue_write()
returns trigger language plpgsql as $$
declare
  v_role text := public.current_app_role();
begin
  if tg_op = 'INSERT' then
    if v_role in ('GOVERNMENT', 'ADMIN') then
      return new;
    end if;

    new.status             := 'OPEN';
    new.priority           := 'MEDIUM';
    new.severity           := 'MEDIUM';
    new.escalation_level   := 'LOCAL';
    new.routing_tier       := 'UNMAPPED';
    new.jurisdiction_id    := null;
    new.jurisdiction_match_method := 'NONE';
    new.authority_id       := null;
    new.department_id      := null;
    new.published_at       := null;
    new.moderation_verdict := null;
    new.moderation_reviewed_by := null;
    new.moderation_reviewed_at := null;
    new.owner_officer_id   := null;
    new.sla_due_at         := null;
    new.civic_pressure     := 0;
    new.satisfaction_score := null;
    new.report_count       := 0;
    new.follower_count     := 0;
    return new;
  end if;

  if v_role = 'ADMIN' then
    return new;
  end if;

  if v_role = 'GOVERNMENT' then
    if new.visibility < old.visibility
       and public.current_juris_level() in ('WARD') then
      raise exception 'only a supervisor may lower an issue visibility class';
    end if;
    return new;
  end if;

  if new.visibility < old.visibility then
    raise exception 'a reporter may raise an issue visibility class, never lower it';
  end if;

  new.status             := old.status;
  new.priority           := old.priority;
  new.severity           := old.severity;
  new.escalation_level   := old.escalation_level;
  new.routing_tier       := old.routing_tier;
  new.jurisdiction_id    := old.jurisdiction_id;
  new.jurisdiction_match_method := old.jurisdiction_match_method;
  new.authority_id       := old.authority_id;
  new.department_id      := old.department_id;
  new.owner_officer_id   := old.owner_officer_id;
  new.published_at       := old.published_at;
  new.moderation_verdict := old.moderation_verdict;
  new.moderation_reviewed_by := old.moderation_reviewed_by;
  new.moderation_reviewed_at := old.moderation_reviewed_at;
  new.sla_due_at         := old.sla_due_at;
  new.civic_pressure     := old.civic_pressure;
  new.satisfaction_score := old.satisfaction_score;
  new.report_count       := old.report_count;
  new.follower_count     := old.follower_count;
  new.merged_into_id     := old.merged_into_id;
  new.created_by         := old.created_by;
  return new;
end $$;

-- Queue handoff is a trigger so the RPC remains a normal security-invoker
-- function governed by the same INSERT policies as a browser statement.
create or replace function enqueue_citizen_report_intake()
returns trigger
language plpgsql security definer set search_path = public, pgmq as $$
begin
  perform pgmq.send(
    'intake',
    jsonb_build_object(
      'issue_id', new.issue_id,
      'report_id', new.id,
      'source', new.source,
      'enqueued_at', now()
    )
  );
  return new;
end $$;

create trigger reports_enqueue_intake
  after insert on reports
  for each row
  when (new.source = 'CITIZEN_APP')
  execute function enqueue_citizen_report_intake();

create or replace function submit_citizen_report(
  p_client_report_id uuid,
  p_description text,
  p_lat double precision,
  p_lng double precision,
  p_title text default null,
  p_category_id text default null,
  p_location_precision location_precision default 'POINT',
  p_location_visibility location_visibility default 'APPROXIMATE',
  p_is_anonymous boolean default true
) returns table (
  issue_id uuid,
  public_id text,
  report_id uuid,
  title text,
  routing_tier routing_tier,
  jurisdiction_id bigint,
  jurisdiction_match_method jurisdiction_match_method,
  published_at timestamptz
)
language plpgsql
security invoker
set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_issue issues%rowtype;
  v_report reports%rowtype;
  v_category text;
  v_point geography;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'sign in is required to submit a report';
  end if;

  if p_client_report_id is null then
    raise exception using errcode = '22023', message = 'client report id is required';
  end if;

  if p_description is null or length(btrim(p_description)) = 0 then
    raise exception using errcode = '22023', message = 'a description is required for text reports';
  end if;

  if length(p_description) > 4000 then
    raise exception using errcode = '22023', message = 'description must be 4000 characters or fewer';
  end if;

  if p_lat is null or p_lng is null then
    raise exception using errcode = '22023', message = 'location is required';
  end if;

  if p_lat < 6 or p_lat > 38 or p_lng < 68 or p_lng > 98 then
    raise exception using errcode = '22023', message = 'location must be within India';
  end if;

  -- Serialise retries from the same device action, then return the winner.
  perform pg_advisory_xact_lock(
    hashtextextended(v_user::text || ':' || p_client_report_id::text, 0)
  );

  select r.* into v_report
    from reports r
   where r.user_id = v_user
     and r.client_report_id = p_client_report_id;

  if found then
    select i.* into strict v_issue from issues i where i.id = v_report.issue_id;
    return query select v_issue.id, v_issue.public_id, v_report.id,
                        v_issue.title, v_issue.routing_tier,
                        v_issue.jurisdiction_id,
                        v_issue.jurisdiction_match_method,
                        v_issue.published_at;
    return;
  end if;

  if not check_rate_limit(v_user, 'REPORT', 10, interval '1 day') then
    raise exception using errcode = 'P0001', message = 'daily report limit reached';
  end if;

  select c.id into v_category
    from categories c
   where c.id = p_category_id and c.is_active;

  v_point := ST_SetSRID(ST_Point(p_lng, p_lat), 4326)::geography;

  v_issue.id := gen_random_uuid();
  v_issue.public_id := generate_public_id();
  insert into issues (
    id, public_id, title, description, category_id, location, location_precision,
    location_visibility, visibility, created_by
  ) values (
    v_issue.id,
    v_issue.public_id,
    coalesce(nullif(btrim(p_title), ''), left(btrim(p_description), 120)),
    btrim(p_description),
    v_category,
    v_point,
    p_location_precision,
    p_location_visibility,
    'PUBLIC',
    v_user
  );

  select i.* into strict v_issue from issues i where i.id = v_issue.id;

  v_report.id := gen_random_uuid();
  insert into reports (
    id, issue_id, user_id, client_report_id, description, media_type,
    location, is_anonymous, source
  ) values (
    v_report.id,
    v_issue.id, v_user, p_client_report_id, btrim(p_description), 'NONE',
    v_point, p_is_anonymous, 'CITIZEN_APP'
  );

  select r.* into strict v_report from reports r where r.id = v_report.id;

  return query select v_issue.id, v_issue.public_id, v_report.id,
                      v_issue.title, v_issue.routing_tier,
                      v_issue.jurisdiction_id,
                      v_issue.jurisdiction_match_method,
                      v_issue.published_at;
end $$;

revoke all on function submit_citizen_report(
  uuid, text, double precision, double precision, text, text,
  location_precision, location_visibility, boolean
) from public, anon;

grant execute on function submit_citizen_report(
  uuid, text, double precision, double precision, text, text,
  location_precision, location_visibility, boolean
) to authenticated;

-- Explicit grants keep the API usable under Supabase's current default of not
-- auto-exposing newly migrated objects. RLS remains the row boundary.
grant select on issues, reports, comments, issue_history,
  categories, departments, jurisdictions to anon, authenticated;
grant insert on issues, reports to authenticated;
grant select, insert, delete on issue_followers to authenticated;
grant usage, select on sequence issue_public_id_seq to authenticated;
