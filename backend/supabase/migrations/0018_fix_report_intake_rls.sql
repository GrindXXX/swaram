-- 0018_fix_report_intake_rls.sql
-- INSERT ... RETURNING also evaluates SELECT policies. On a brand-new issue,
-- the reporter policy could not observe the row until the statement completed.
-- Assign identifiers first, insert without RETURNING, then read under RLS.

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
