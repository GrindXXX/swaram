-- Government Phase-0: authoritative token claims and narrowly-scoped operations.

create or replace function public.custom_access_token(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := (event ->> 'user_id')::uuid;
  v_claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  v_officer government_officers%rowtype;
  v_role app_role;
begin
  select role into v_role from users where id = v_user;

  select * into v_officer
    from government_officers
   where user_id = v_user and is_active
   order by jurisdiction_level, id
   limit 1;

  v_claims := v_claims - array['app_role', 'dept_id', 'juris_id', 'juris_lvl'];
  if v_role = 'ADMIN' then
    v_claims := jsonb_set(v_claims, '{app_role}', '"ADMIN"');
  elsif v_officer.id is not null then
    v_claims := jsonb_set(v_claims, '{app_role}', '"GOVERNMENT"');
    v_claims := jsonb_set(v_claims, '{juris_id}', to_jsonb(v_officer.jurisdiction_id));
    v_claims := jsonb_set(v_claims, '{juris_lvl}', to_jsonb(v_officer.jurisdiction_level::text));
    if v_officer.department_id is not null then
      v_claims := jsonb_set(v_claims, '{dept_id}', to_jsonb(v_officer.department_id));
    end if;
  else
    v_claims := jsonb_set(v_claims, '{app_role}', '"CITIZEN"');
  end if;

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

revoke execute on function public.custom_access_token(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
grant select on public.users, public.government_officers to supabase_auth_admin;

comment on function public.custom_access_token(jsonb) is
  'Supabase custom access-token hook. Government scope comes only from an active government_officers posting; client metadata is ignored.';

create or replace function public.gov_can_operate_issue(p_issue uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
      from issues i
     where i.id = p_issue
       and (
         exists (select 1 from users u where u.id = auth.uid() and u.role = 'ADMIN')
          or exists (
            select 1
              from government_officers o
              join jurisdiction_descendants(o.jurisdiction_id) d on d.id = i.jurisdiction_id
            where o.user_id = auth.uid()
              and o.is_active
              and o.department_id = i.department_id
          )
       )
  );
$$;

revoke execute on function public.gov_can_operate_issue(uuid) from public, anon;
grant execute on function public.gov_can_operate_issue(uuid) to authenticated;

create or replace function public.gov_owns_issue(p_issue uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.gov_can_operate_issue(p_issue); $$;

revoke execute on function public.gov_owns_issue(uuid) from public, anon;
grant execute on function public.gov_owns_issue(uuid) to authenticated;

drop policy if exists issues_gov_update on issues;
create policy issues_gov_update on issues
  for update to authenticated
  using (public.gov_can_operate_issue(id))
  with check (public.gov_can_operate_issue(id));

create or replace function public.gov_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from users u where u.id = auth.uid() and u.role = 'ADMIN'
    union all
    select 1 from government_officers o where o.user_id = auth.uid() and o.is_active
  ) then
    raise exception 'government access required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_data order by
           case when row_data ->> 'sla_due_at' is null then 1 else 0 end,
           row_data ->> 'sla_due_at', row_data ->> 'updated_at' desc), '[]'::jsonb)
    into v_result
    from (
      select jsonb_build_object(
        'id', i.id, 'public_id', i.public_id, 'title', coalesce(i.title, 'Untitled issue'),
        'description', i.description, 'status', i.status, 'priority', i.priority,
        'severity', i.severity, 'routing_tier', i.routing_tier,
        'department', d.name, 'jurisdiction', j.name,
        'owner', case when i.routing_tier = 'ONBOARDED' then up.display_name else null end,
        'report_count', i.report_count, 'follower_count', i.follower_count,
        'civic_pressure', i.civic_pressure,
        'sla_due_at', case when i.routing_tier = 'ONBOARDED' then i.sla_due_at else null end,
        'created_at', i.created_at, 'updated_at', i.updated_at
      ) row_data
      from issues i
      left join departments d on d.id = i.department_id
      left join jurisdictions j on j.id = i.jurisdiction_id
      left join government_officers own on own.id = i.owner_officer_id and own.is_active
      left join users up on up.id = own.user_id
      where public.gov_can_operate_issue(i.id)
        and i.status not in ('CLOSED', 'MERGED', 'REJECTED')
    ) q;
  return v_result;
end;
$$;

create or replace function public.gov_issue_detail(p_public_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_issue issues%rowtype; v_result jsonb;
begin
  select * into v_issue from issues where public_id = p_public_id;
  if v_issue.id is null or not public.gov_can_operate_issue(v_issue.id) then
    return null;
  end if;

  select jsonb_build_object(
    'id', i.id, 'public_id', i.public_id, 'title', coalesce(i.title, 'Untitled issue'),
    'description', i.description, 'address', i.address, 'status', i.status,
    'priority', i.priority, 'severity', i.severity, 'routing_tier', i.routing_tier,
    'department', d.name, 'jurisdiction', j.name,
    'owner', case when i.routing_tier = 'ONBOARDED' then up.display_name else null end,
    'report_count', i.report_count, 'follower_count', i.follower_count,
    'civic_pressure', i.civic_pressure,
    'sla_due_at', case when i.routing_tier = 'ONBOARDED' then i.sla_due_at else null end,
    'created_at', i.created_at, 'updated_at', i.updated_at,
    'comments', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'content', c.content, 'visibility', c.visibility,
      'is_official', c.is_official, 'author', coalesce(p.display_name, 'Swaram user'),
      'created_at', c.created_at) order by c.created_at desc)
      from comments c left join users p on p.id = c.user_id
      where c.issue_id = i.id and c.deleted_at is null and not c.is_hidden), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object(
      'id', h.id, 'action', h.action, 'old_value', h.old_value,
      'new_value', h.new_value, 'actor_type', h.actor_type, 'created_at', h.created_at)
      order by h.created_at desc) from issue_history h where h.issue_id = i.id), '[]'::jsonb),
    'resolutions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'attempt', r.attempt, 'action_taken', r.action_taken,
      'intent', r.intent, 'photo_url', r.resolution_photo_url,
      'submitted_at', r.submitted_at, 'outcome', r.outcome) order by r.attempt desc)
      from resolution_submissions r where r.issue_id = i.id), '[]'::jsonb)
  ) into v_result
  from issues i
  left join departments d on d.id = i.department_id
  left join jurisdictions j on j.id = i.jurisdiction_id
  left join government_officers own on own.id = i.owner_officer_id and own.is_active
  left join users up on up.id = own.user_id
  where i.id = v_issue.id;
  return v_result;
end;
$$;

create or replace function public.gov_start_issue(p_public_id text)
returns issue_status
language plpgsql
security definer
set search_path = public
as $$
declare v_issue issues%rowtype;
begin
  select * into v_issue from issues where public_id = p_public_id for update;
  if v_issue.id is null or not public.gov_can_operate_issue(v_issue.id) then
    raise exception 'issue not found or outside officer scope' using errcode = '42501';
  end if;
  if v_issue.routing_tier <> 'ONBOARDED' then
    raise exception 'only onboarded issues can enter government work' using errcode = '22023';
  end if;
  if v_issue.status not in ('OPEN', 'ASSIGNED', 'ACKNOWLEDGED', 'REOPENED') then
    raise exception 'invalid transition from % to IN_PROGRESS', v_issue.status using errcode = '22023';
  end if;
  update issues set status = 'IN_PROGRESS' where id = v_issue.id;
  return 'IN_PROGRESS';
end;
$$;

create or replace function public.gov_post_public_reply(p_public_id text, p_content text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_issue issues%rowtype; v_id uuid;
begin
  select * into v_issue from issues where public_id = p_public_id for share;
  if v_issue.id is null or not public.gov_can_operate_issue(v_issue.id) then
    raise exception 'issue not found or outside officer scope' using errcode = '42501';
  end if;
  if v_issue.visibility <> 'PUBLIC' or v_issue.published_at is null or v_issue.status = 'HELD' then
    raise exception 'a public reply requires a published public issue' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_content, ''))) < 2 then
    raise exception 'reply is required' using errcode = '22023';
  end if;
  if length(p_content) > 4000 then
    raise exception 'reply must be 4000 characters or fewer' using errcode = '22023';
  end if;
  if not check_rate_limit(auth.uid(), 'OFFICIAL_REPLY', 20, interval '1 hour', v_issue.id::text) then
    raise exception 'official reply rate limit reached' using errcode = 'P0001';
  end if;
  insert into comments (issue_id, user_id, content, visibility, is_official)
  values (v_issue.id, auth.uid(), btrim(p_content), 'PUBLIC', true)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.gov_submit_resolution(
  p_public_id text, p_action_taken text, p_intent text default null,
  p_photo_url text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_issue issues%rowtype; v_id uuid; v_attempt int;
begin
  select * into v_issue from issues where public_id = p_public_id for update;
  if v_issue.id is null or not public.gov_can_operate_issue(v_issue.id) then
    raise exception 'issue not found or outside officer scope' using errcode = '42501';
  end if;
  if v_issue.status not in ('IN_PROGRESS', 'ACKNOWLEDGED', 'REOPENED') then
    raise exception 'resolution cannot be submitted from %', v_issue.status using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_action_taken, ''))) < 5 then
    raise exception 'action taken is required' using errcode = '22023';
  end if;
  select coalesce(max(attempt), 0) + 1 into v_attempt
    from resolution_submissions where issue_id = v_issue.id;
  insert into resolution_submissions (
    issue_id, attempt, submitted_by, authority_id, department_id, action_taken,
    intent, resolution_photo_url, verification_opened_at, eligible_count,
    quorum_target
  ) values (
    v_issue.id, v_attempt, auth.uid(), v_issue.authority_id, v_issue.department_id,
    btrim(p_action_taken), nullif(btrim(p_intent), ''), nullif(btrim(p_photo_url), ''),
    now(), v_issue.report_count + v_issue.follower_count,
    greatest(3, ceil(v_issue.report_count * 0.2)::int)
  ) returning id into v_id;
  update issues set status = 'AWAITING_VERIFICATION' where id = v_issue.id;
  return v_id;
end;
$$;

revoke execute on function public.gov_queue() from public, anon;
revoke execute on function public.gov_issue_detail(text) from public, anon;
revoke execute on function public.gov_start_issue(text) from public, anon;
revoke execute on function public.gov_post_public_reply(text, text) from public, anon;
revoke execute on function public.gov_submit_resolution(text, text, text, text) from public, anon;
grant execute on function public.gov_queue() to authenticated;
grant execute on function public.gov_issue_detail(text) to authenticated;
grant execute on function public.gov_start_issue(text) to authenticated;
grant execute on function public.gov_post_public_reply(text, text) to authenticated;
grant execute on function public.gov_submit_resolution(text, text, text, text) to authenticated;
