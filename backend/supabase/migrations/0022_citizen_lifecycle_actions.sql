-- 0022_citizen_lifecycle_actions.sql
-- Browser lifecycle actions use narrow RPCs so rate limits and eligibility are
-- enforced with RLS-compatible server checks, never client-side filters.

create or replace function public.current_app_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role',
    (select u.role::text from users u where u.id = auth.uid()),
    'ANON'
  );
$$;

create or replace function public.current_juris_id() returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'juris_id', '')::bigint,
    (select o.jurisdiction_id from government_officers o
      where o.user_id = auth.uid() and o.is_active order by o.id limit 1)
  );
$$;

create or replace function public.current_juris_level() returns jurisdiction_level
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'juris_lvl', '')::jurisdiction_level,
    (select o.jurisdiction_level from government_officers o
      where o.user_id = auth.uid() and o.is_active order by o.id limit 1)
  );
$$;

create or replace function public.current_dept_id() returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'dept_id', '')::bigint,
    (select o.department_id from government_officers o
      where o.user_id = auth.uid() and o.is_active order by o.id limit 1)
  );
$$;

create or replace function public.add_citizen_comment(p_issue_id uuid, p_content text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.can_view_issue_detail(p_issue_id) then
    raise exception using errcode = '42501', message = 'sign in and issue access are required';
  end if;
  if nullif(btrim(p_content), '') is null or length(p_content) > 2000 then
    raise exception using errcode = '22023', message = 'comment must contain 1 to 2000 characters';
  end if;
  if not check_rate_limit(auth.uid(), 'COMMENT', 5, interval '1 hour', p_issue_id::text) then
    raise exception using errcode = 'P0001', message = 'hourly comment limit reached';
  end if;

  insert into comments (issue_id, user_id, content, visibility, is_official)
  values (p_issue_id, auth.uid(), btrim(p_content), 'PUBLIC', false)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.toggle_issue_support(p_issue_id uuid)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not public.can_view_issue(p_issue_id) then
    raise exception using errcode = '42501', message = 'sign in and issue access are required';
  end if;
  if exists (select 1 from issue_reactions where issue_id = p_issue_id and user_id = auth.uid()) then
    delete from issue_reactions where issue_id = p_issue_id and user_id = auth.uid();
    return false;
  end if;
  insert into issue_reactions (issue_id, user_id, reaction_type)
  values (p_issue_id, auth.uid(), 'SUPPORT');
  return true;
end;
$$;

create or replace function public.toggle_issue_follow(p_issue_id uuid)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not public.can_view_issue(p_issue_id) then
    raise exception using errcode = '42501', message = 'sign in and issue access are required';
  end if;
  if exists (select 1 from issue_followers where issue_id = p_issue_id and user_id = auth.uid()) then
    delete from issue_followers where issue_id = p_issue_id and user_id = auth.uid();
    return false;
  end if;
  insert into issue_followers (issue_id, user_id) values (p_issue_id, auth.uid());
  return true;
end;
$$;

create or replace function public.submit_verification_response(
  p_issue_id uuid,
  p_resolution_id uuid,
  p_verdict verification_verdict,
  p_comment text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null or not (
    public.is_issue_reporter(p_issue_id) or public.is_issue_follower(p_issue_id)
  ) then
    raise exception using errcode = '42501', message = 'only reporters and followers may verify';
  end if;
  if not exists (
    select 1 from resolution_submissions s
     where s.id = p_resolution_id and s.issue_id = p_issue_id
       and s.verification_opened_at is not null and s.verification_closed_at is null
  ) then
    raise exception using errcode = '22023', message = 'verification window is not open';
  end if;

  insert into verification_responses (
    resolution_submission_id, issue_id, user_id, verdict, comment, is_reporter
  ) values (
    p_resolution_id, p_issue_id, auth.uid(), p_verdict,
    nullif(btrim(p_comment), ''), public.is_issue_reporter(p_issue_id)
  )
  on conflict (resolution_submission_id, user_id) do update set
    verdict = excluded.verdict,
    comment = excluded.comment,
    is_reporter = excluded.is_reporter
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.verification_context(p_issue_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_result jsonb;
begin
  if not public.can_view_issue(p_issue_id) then return null; end if;
  select jsonb_build_object(
    'resolution_id', s.id,
    'action_taken', s.action_taken,
    'submitted_at', s.submitted_at,
    'resolution_photo_url', s.resolution_photo_url,
    'same_location', case when s.resolution_gps_distance_m is null then null
                          else s.resolution_gps_distance_m <= 250 end,
    'verification_open', s.verification_opened_at is not null and s.verification_closed_at is null,
    'breakdown', coalesce((select jsonb_agg(to_jsonb(b)) from verification_breakdown(p_issue_id) b), '[]'::jsonb)
  ) into v_result
  from resolution_submissions s
  where s.issue_id = p_issue_id
  order by s.attempt desc limit 1;
  return v_result;
end;
$$;

revoke all on function public.add_citizen_comment(uuid, text) from public, anon;
revoke all on function public.toggle_issue_support(uuid) from public, anon;
revoke all on function public.toggle_issue_follow(uuid) from public, anon;
revoke all on function public.submit_verification_response(uuid, uuid, verification_verdict, text) from public, anon;
grant execute on function public.add_citizen_comment(uuid, text) to authenticated;
grant execute on function public.toggle_issue_support(uuid) to authenticated;
grant execute on function public.toggle_issue_follow(uuid) to authenticated;
grant execute on function public.submit_verification_response(uuid, uuid, verification_verdict, text) to authenticated;
grant execute on function public.verification_context(uuid) to anon, authenticated;
