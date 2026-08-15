-- Safe browser write paths for actions taken from the public citizen issue page.

alter table reports add column is_facing_too boolean not null default false;

create unique index reports_one_facing_too_per_user_issue_idx
  on reports (issue_id, user_id)
  where is_facing_too and user_id is not null;

comment on column reports.is_facing_too is
  'True only for the explicit citizen "I am facing this too" action. The partial unique index makes that action idempotent per citizen and issue.';

-- Split the original all-operations policy so an authenticated caller cannot
-- follow a hidden issue by bypassing the RPC and posting its internal UUID.
drop policy issue_followers_self on issue_followers;
create policy issue_followers_self_read on issue_followers
  for select to authenticated using (user_id = auth.uid());
create policy issue_followers_self_insert on issue_followers
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_issue(issue_id));
create policy issue_followers_self_update on issue_followers
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy issue_followers_self_delete on issue_followers
  for delete to authenticated using (user_id = auth.uid());

-- Normal report intake must not be able to impersonate the explicit action.
-- The facing-too RPC is SECURITY DEFINER, so its insert does not run as the
-- browser role; every direct browser insert/update is clamped here.
create function guard_facing_too_write()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.is_facing_too := false;
    else
      new.is_facing_too := old.is_facing_too;
    end if;
  end if;
  return new;
end $$;

create trigger reports_guard_facing_too
  before insert or update of is_facing_too on reports
  for each row execute function guard_facing_too_write();

-- Confirming an existing issue is not a new classification job. Otherwise the
-- boilerplate confirmation could overwrite the canonical issue.
drop trigger reports_enqueue_intake on reports;
create trigger reports_enqueue_intake
  after insert on reports
  for each row
  when (new.source = 'CITIZEN_APP' and not new.is_facing_too)
  execute function enqueue_citizen_report_intake();

create or replace function citizen_issue_state(p_public_id text)
returns table (is_following boolean, has_reported boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select
    exists (
      select 1 from issue_followers f
       where f.issue_id = i.id and f.user_id = auth.uid()
    ),
    exists (
      select 1 from reports r
       where r.issue_id = i.id and r.user_id = auth.uid()
    )
  from issues i
  where i.public_id = p_public_id
    and public.can_view_issue(i.id);
$$;

create or replace function citizen_my_issue_ids()
returns table (issue_id uuid, relation text)
language sql stable security definer set search_path = public, pg_temp as $$
  select i.id, 'created'::text
    from issues i
   where auth.uid() is not null and i.created_by = auth.uid()
  union
  select f.issue_id, 'following'::text
    from issue_followers f
   where auth.uid() is not null and f.user_id = auth.uid();
$$;

create or replace function set_citizen_issue_following(
  p_public_id text,
  p_following boolean
) returns table (is_following boolean, follower_count integer)
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_issue_id uuid;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'sign in is required to follow an issue';
  end if;

  select i.id into v_issue_id from issues i where i.public_id = p_public_id;
  if v_issue_id is null then
    raise exception using errcode = 'P0002', message = 'issue not found';
  end if;

  if p_following then
    insert into issue_followers (issue_id, user_id)
    values (v_issue_id, v_user)
    on conflict (issue_id, user_id) do nothing;
  else
    delete from issue_followers
     where issue_id = v_issue_id and user_id = v_user;
  end if;

  return query
    select p_following, i.follower_count from issues i where i.id = v_issue_id;
end $$;

create or replace function create_citizen_comment(
  p_public_id text,
  p_content text
) returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_issue_id uuid;
  v_comment_id uuid := gen_random_uuid();
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'sign in is required to comment';
  end if;
  if p_content is null or length(btrim(p_content)) = 0 then
    raise exception using errcode = '22023', message = 'comment cannot be empty';
  end if;
  if length(p_content) > 1000 then
    raise exception using errcode = '22023', message = 'comment must be 1000 characters or fewer';
  end if;

  select i.id into v_issue_id from issues i where i.public_id = p_public_id;
  if v_issue_id is null then
    raise exception using errcode = 'P0002', message = 'issue not found';
  end if;

  if not check_rate_limit(v_user, 'COMMENT', 5, interval '1 hour', v_issue_id::text) then
    raise exception using errcode = 'P0001', message = 'hourly comment limit reached';
  end if;

  insert into comments (id, issue_id, user_id, content, visibility, is_official)
  values (v_comment_id, v_issue_id, v_user, btrim(p_content), 'PUBLIC', false);
  return v_comment_id;
end $$;

create or replace function add_citizen_issue_report(
  p_public_id text,
  p_client_report_id uuid
) returns table (inserted boolean, report_count integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_issue issues%rowtype;
  v_report_id uuid;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'sign in is required to report that you are facing this issue';
  end if;
  if p_client_report_id is null then
    raise exception using errcode = '22023', message = 'client report id is required';
  end if;

  select i.* into v_issue from issues i where i.public_id = p_public_id;
  if not found or not public.can_view_issue(v_issue.id) then
    raise exception using errcode = 'P0002', message = 'issue not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || v_issue.id::text || ':facing', 0));

  select r.id into v_report_id
    from reports r
   where r.issue_id = v_issue.id and r.user_id = v_user and r.is_facing_too;

  if v_report_id is not null then
    return query select false, i.report_count from issues i where i.id = v_issue.id;
    return;
  end if;

  if not check_rate_limit(v_user, 'REPORT', 10, interval '1 day') then
    raise exception using errcode = 'P0001', message = 'daily report limit reached';
  end if;

  insert into reports (
    id, issue_id, user_id, client_report_id, description, media_type,
    location, is_anonymous, source, is_facing_too
  ) values (
    gen_random_uuid(), v_issue.id, v_user, p_client_report_id,
    'Citizen confirmed they are facing this issue.', 'NONE',
    v_issue.location, true, 'CITIZEN_APP', true
  );

  return query select true, i.report_count from issues i where i.id = v_issue.id;
end $$;

revoke all on function citizen_issue_state(text) from public, anon;
revoke all on function citizen_my_issue_ids() from public, anon;
revoke all on function set_citizen_issue_following(text, boolean) from public, anon;
revoke all on function create_citizen_comment(text, text) from public, anon;
revoke all on function add_citizen_issue_report(text, uuid) from public, anon;

grant execute on function citizen_issue_state(text) to authenticated;
grant execute on function citizen_my_issue_ids() to authenticated;
grant execute on function set_citizen_issue_following(text, boolean) to authenticated;
grant execute on function create_citizen_comment(text, text) to authenticated;
grant execute on function add_citizen_issue_report(text, uuid) to authenticated;

grant insert on comments to authenticated;
grant select, insert, update, delete on issue_followers to authenticated;
