-- 0019_security_hardening.sql
-- Column-level and definer-function boundaries that RLS alone cannot express.

-- Government write scope is both geographic and departmental. Read scope stays
-- geographic so collaborating departments can still see the complete record.
create or replace function public.gov_scope_covers_department(
  p_juris bigint,
  p_department bigint
) returns boolean
language sql stable security definer set search_path = public as $$
  select p_juris is not null
     and p_department is not null
     and auth.uid() is not null
     and exists (
       select 1
         from government_officers o
        join jurisdiction_descendants(o.jurisdiction_id) d on d.id = p_juris
       where o.user_id = auth.uid()
          and (o.department_id is null or o.department_id = p_department)
          and o.is_active
     );
$$;

revoke all on function public.gov_scope_covers_department(bigint, bigint)
  from public, anon;
grant execute on function public.gov_scope_covers_department(bigint, bigint)
  to authenticated;

create or replace function public.gov_owns_issue(p_issue uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from issues i
     where i.id = p_issue
       and public.is_gov()
       and public.gov_scope_covers_department(i.jurisdiction_id, i.department_id)
  );
$$;

drop policy issues_gov_update on issues;
create policy issues_gov_update on issues
  for update to authenticated
  using (
    public.current_app_role() = 'GOVERNMENT'
    and public.gov_scope_covers_department(jurisdiction_id, department_id)
  )
  with check (
    public.current_app_role() = 'GOVERNMENT'
    and public.gov_scope_covers_department(jurisdiction_id, department_id)
  );

-- Self-service profile updates may change presentation and preferences, never
-- account identity, verification state, role, suspension, or row identity.
create or replace function public.guard_user_write()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated'
     and auth.uid() = old.id then
    new.id := old.id;
    new.email := old.email;
    new.full_name := old.full_name;
    new.role := old.role;
    new.phone := old.phone;
    new.phone_verified_at := old.phone_verified_at;
    new.identity_tier := old.identity_tier;
    new.verification_ref := old.verification_ref;
    new.is_suspended := old.is_suspended;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

create trigger users_guard_write
  before update on users
  for each row execute function public.guard_user_write();

-- Authors may edit comment text or soft-delete it. Trust, moderation, thread,
-- issue, and author fields remain controlled by government/system workflows.
create or replace function public.guard_comment_write()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated'
     and auth.uid() = old.user_id then
    new.id := old.id;
    new.issue_id := old.issue_id;
    new.user_id := old.user_id;
    new.parent_id := old.parent_id;
    new.created_at := old.created_at;

    -- Scoped officers retain moderation workflows on their own comments.
    if not (public.is_gov() and public.gov_owns_issue(old.issue_id)) then
      new.visibility := old.visibility;
      new.is_official := old.is_official;
      new.is_representative := old.is_representative;
      new.flag_count := old.flag_count;
      new.is_hidden := old.is_hidden;
      new.hidden_at := old.hidden_at;
    end if;
  end if;
  return new;
end $$;

create trigger comments_guard_write
  before update on comments
  for each row execute function public.guard_comment_write();

-- Reports are evidence. Authors can correct narrative/media and anonymity, but
-- cannot move the evidence, reattribute it, or rewrite its provenance.
create or replace function public.guard_report_write()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated'
     and auth.uid() = old.user_id then
    new.id := old.id;
    new.issue_id := old.issue_id;
    new.user_id := old.user_id;
    new.client_report_id := old.client_report_id;
    new.location := old.location;
    new.source := old.source;
    new.created_at := old.created_at;
    new.embedding := old.embedding;
  end if;
  return new;
end $$;

create trigger reports_guard_write
  before update on reports
  for each row execute function public.guard_report_write();

-- Keep the existing citizen and officer workflows while making computed and
-- moderation fields writable only by admin/service paths.
create or replace function public.guard_issue_write()
returns trigger language plpgsql as $$
declare
  v_role text := public.current_app_role();
begin
  -- SQL migrations, cron, and service-role workers remain authoritative. This
  -- trigger is the browser-role boundary layered underneath RLS.
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if v_role = 'ADMIN' then
      return new;
    end if;

    if v_role = 'GOVERNMENT' then
      if not public.gov_scope_covers_department(new.jurisdiction_id, new.department_id) then
        raise exception using errcode = '42501',
          message = 'government issue writes require an active posting in the issue department';
      end if;
    else
      new.status := 'OPEN';
      new.priority := 'MEDIUM';
      new.severity := 'MEDIUM';
      new.escalation_level := 'LOCAL';
      new.routing_tier := 'UNMAPPED';
      new.jurisdiction_id := null;
      new.jurisdiction_match_method := 'NONE';
      new.authority_id := null;
      new.department_id := null;
      new.owner_officer_id := null;
    end if;

    -- public_id is allocated by the database even when a browser supplies one.
    new.public_id := public.generate_public_id();
    new.published_at := null;
    new.moderation_verdict := null;
    new.moderation_reviewed_by := null;
    new.moderation_reviewed_at := null;
    new.sla_due_at := null;
    new.acknowledged_at := null;
    new.resolved_at := null;
    new.closed_at := null;
    new.civic_pressure := 0;
    new.satisfaction_score := null;
    new.report_count := 0;
    new.follower_count := 0;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if v_role = 'ADMIN' then
    return new;
  end if;

  if v_role = 'GOVERNMENT' then
    if not public.gov_scope_covers_department(old.jurisdiction_id, old.department_id)
       or not public.gov_scope_covers_department(new.jurisdiction_id, new.department_id) then
      raise exception using errcode = '42501',
        message = 'government issue writes require an active posting in the issue department';
    end if;

    if new.visibility < old.visibility
       and public.current_juris_level() = 'WARD' then
      raise exception 'only a supervisor may lower an issue visibility class';
    end if;

    if new.owner_officer_id is not null and not exists (
      select 1
        from government_officers o
        join jurisdiction_descendants(o.jurisdiction_id) d
          on d.id = new.jurisdiction_id
       where o.id = new.owner_officer_id
         and o.department_id = new.department_id
         and o.is_active
    ) then
      raise exception using errcode = '23514',
        message = 'issue owner must be active in the issue department and jurisdiction';
    end if;

    new.id := old.id;
    new.public_id := old.public_id;
    new.published_at := old.published_at;
    new.moderation_verdict := old.moderation_verdict;
    new.moderation_reviewed_by := old.moderation_reviewed_by;
    new.moderation_reviewed_at := old.moderation_reviewed_at;
    new.sla_due_at := old.sla_due_at;
    new.acknowledged_at := old.acknowledged_at;
    new.resolved_at := old.resolved_at;
    new.closed_at := old.closed_at;
    new.civic_pressure := old.civic_pressure;
    new.satisfaction_score := old.satisfaction_score;
    new.report_count := old.report_count;
    new.follower_count := old.follower_count;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    return new;
  end if;

  if new.visibility < old.visibility then
    raise exception 'a reporter may raise an issue visibility class, never lower it';
  end if;

  -- Citizen issue edits are limited to title, description, and safer visibility.
  new.id := old.id;
  new.public_id := old.public_id;
  new.category_id := old.category_id;
  new.subcategory := old.subcategory;
  new.location := old.location;
  new.address := old.address;
  new.location_precision := old.location_precision;
  new.location_visibility := old.location_visibility;
  new.severity := old.severity;
  new.priority := old.priority;
  new.civic_pressure := old.civic_pressure;
  new.estimated_people_affected := old.estimated_people_affected;
  new.escalation_level := old.escalation_level;
  new.routing_tier := old.routing_tier;
  new.jurisdiction_id := old.jurisdiction_id;
  new.jurisdiction_match_method := old.jurisdiction_match_method;
  new.authority_id := old.authority_id;
  new.department_id := old.department_id;
  new.owner_officer_id := old.owner_officer_id;
  new.status := old.status;
  new.moderation_verdict := old.moderation_verdict;
  new.moderation_reviewed_by := old.moderation_reviewed_by;
  new.moderation_reviewed_at := old.moderation_reviewed_at;
  new.published_at := old.published_at;
  new.sla_due_at := old.sla_due_at;
  new.acknowledged_at := old.acknowledged_at;
  new.resolved_at := old.resolved_at;
  new.closed_at := old.closed_at;
  new.satisfaction_score := old.satisfaction_score;
  new.merged_into_id := old.merged_into_id;
  new.rejection_reason := old.rejection_reason;
  new.report_count := old.report_count;
  new.follower_count := old.follower_count;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end $$;

-- Bind roster lookup to the authenticated subject; a caller cannot enumerate
-- another person's unpublished roster record through the definer function.
create or replace function public.officer_claim_candidate(p_user_id uuid)
returns table (
  roster_record_id bigint, name text, designation text,
  department_id bigint, jurisdiction_id bigint, signal text
) language plpgsql stable security definer set search_path = public as $$
declare v_email text;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'officer claim lookup is limited to the signed-in user';
  end if;

  select lower(u.email) into v_email from users u where u.id = auth.uid();
  if v_email is null then return; end if;

  return query
  select r.id, r.name, r.designation, r.department_id, r.jurisdiction_id,
         'ROSTER_EMAIL'::text
    from officer_roster_records r
   where lower(r.email) = v_email
     and r.deactivated_at is null
     and r.match_status in ('PENDING','MATCHED')
   limit 2;

  if not found and (v_email like '%@%.gov.in' or v_email like '%@%.nic.in') then
    return query select null::bigint, null::text, null::text,
                        null::bigint, null::bigint, 'GOV_DOMAIN'::text;
  end if;
end $$;

revoke all on function public.officer_claim_candidate(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.officer_claim_candidate(uuid) to authenticated;

-- The public signature remains usable by the intake RPC, but its user argument
-- is no longer authority: it must equal the JWT subject.
create or replace function public.check_rate_limit(
  p_user uuid,
  p_action text,
  p_limit int,
  p_window interval default interval '1 day',
  p_scope text default ''
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_start timestamptz;
  v_count int;
begin
  if auth.uid() is null or p_user is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'rate limits are bound to the signed-in user';
  end if;
  if p_action is null or btrim(p_action) = '' or p_limit is null or p_limit <= 0
     or p_window is null or extract(epoch from p_window) <= 0 then
    raise exception using errcode = '22023', message = 'invalid rate limit parameters';
  end if;

  v_start := to_timestamp(
    floor(extract(epoch from now()) / extract(epoch from p_window))
    * extract(epoch from p_window)
  );

  insert into rate_limits (user_id, action, scope, window_start, count)
  values (p_user, p_action, coalesce(p_scope, ''), v_start, 1)
  on conflict (user_id, action, scope, window_start)
    do update set count = rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end $$;

revoke all on function public.check_rate_limit(uuid, text, int, interval, text)
  from public, anon, authenticated, service_role;
grant execute on function public.check_rate_limit(uuid, text, int, interval, text)
  to authenticated;

-- Correlate the denormalised issue id with its submission. Canonicalise any
-- legacy mismatch before making the invariant structural.
update verification_responses r
   set issue_id = s.issue_id
  from resolution_submissions s
 where s.id = r.resolution_submission_id
   and r.issue_id is distinct from s.issue_id;

alter table resolution_submissions
  add constraint resolution_submissions_id_issue_key unique (id, issue_id);
alter table verification_responses
  add constraint verification_responses_submission_issue_fk
  foreign key (resolution_submission_id, issue_id)
  references resolution_submissions (id, issue_id) on delete cascade;

drop policy verification_insert on verification_responses;
create policy verification_insert on verification_responses
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (public.is_issue_reporter(issue_id) or public.is_issue_follower(issue_id))
    and exists (
      select 1 from resolution_submissions s
       where s.id = resolution_submission_id
         and s.issue_id = issue_id
         and s.verification_closed_at is null
    )
  );

-- Explicit table privileges make the policy-backed update workflows portable
-- across Supabase projects regardless of historical default grants.
grant select on users to authenticated;
grant select on resolution_submissions, verification_responses
  to anon, authenticated;
grant update on users, issues, reports, comments, verification_responses
  to authenticated;
grant insert on comments, verification_responses to authenticated;
