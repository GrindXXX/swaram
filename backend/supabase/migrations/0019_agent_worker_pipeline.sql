-- 0019_agent_worker_pipeline.sql
-- Agents write evidence and proposals. Only a verified human may turn a
-- proposal into a change to an issue or its reports.

alter table agent_runs
  add column resolution_submission_id uuid
    references resolution_submissions(id) on delete set null,
  add column proposal_applied_by uuid references users(id),
  add column proposal_applied_at timestamptz,
  add constraint agent_runs_known_agent
    check (agent_name in ('intake', 'cluster', 'verify')) not valid,
  add constraint agent_runs_subject_matches_agent
    check (
      (agent_name = 'intake' and issue_id is not null and report_id is not null)
      or (agent_name = 'cluster' and issue_id is not null)
      or (agent_name = 'verify' and resolution_submission_id is not null)
    ) not valid,
  add constraint agent_runs_proposal_application_complete
    check (num_nonnulls(proposal_applied_by, proposal_applied_at) in (0, 2));

create index agent_runs_resolution_submission_idx
  on agent_runs (resolution_submission_id)
  where resolution_submission_id is not null;

comment on constraint agent_runs_known_agent on agent_runs is
  'NOT VALID preserves any historical pre-0019 names while rejecting every new name except intake, cluster and verify.';

create table cluster_candidates (
  id uuid primary key default gen_random_uuid(),
  agent_run_id bigint not null references agent_runs(id),
  source_issue_id uuid not null references issues(id),
  target_issue_id uuid not null references issues(id),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  rationale text not null,
  review_status text not null default 'PENDING'
    check (review_status in ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  review_reason text,
  created_at timestamptz not null default now(),
  constraint cluster_candidates_distinct_issues
    check (source_issue_id <> target_issue_id),
  constraint cluster_candidates_review_complete
    check (
      (review_status = 'PENDING' and reviewed_by is null and reviewed_at is null)
      or (review_status <> 'PENDING' and reviewed_by is not null and reviewed_at is not null)
    ),
  unique (agent_run_id, source_issue_id, target_issue_id)
);

create index cluster_candidates_source_idx
  on cluster_candidates (source_issue_id, created_at desc);
create index cluster_candidates_target_idx
  on cluster_candidates (target_issue_id, created_at desc);
create index cluster_candidates_pending_idx
  on cluster_candidates (created_at)
  where review_status = 'PENDING';

alter table cluster_candidates enable row level security;

create policy cluster_candidates_human_read on cluster_candidates
  for select to authenticated
  using (
    public.is_admin()
    or (
      public.current_app_role() = 'GOVERNMENT'
      and public.in_gov_scope((select i.jurisdiction_id from issues i where i.id = source_issue_id))
      and public.in_gov_scope((select i.jurisdiction_id from issues i where i.id = target_issue_id))
    )
  );

revoke all on cluster_candidates from public, anon, authenticated, service_role;
grant select on cluster_candidates to authenticated;
grant select, insert on cluster_candidates to service_role;

-- Write authorization never trusts a role claim by itself. Admin status is
-- checked against users; government scope is checked against active postings.
create or replace function public.is_verified_human_approver(p_issue uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from users u
     where u.id = auth.uid()
       and (
         (public.current_app_role() = 'ADMIN' and u.role = 'ADMIN')
         or (
           public.current_app_role() = 'GOVERNMENT'
           and u.role = 'GOVERNMENT'
           and exists (
             select 1
               from issues i
              where i.id = p_issue
                and public.gov_scope_covers(i.jurisdiction_id)
           )
         )
       )
  );
$$;

revoke all on function public.is_verified_human_approver(uuid) from public, anon, authenticated;

create or replace function public.guard_agent_run_mutation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'agent runs are append-only';
  end if;

  if to_jsonb(new) - array['was_overridden','overridden_by','overridden_at','override_reason']
     = to_jsonb(old) - array['was_overridden','overridden_by','overridden_at','override_reason'] then
    if old.was_overridden or not new.was_overridden
       or new.overridden_by is distinct from auth.uid()
       or new.overridden_at is null
       or nullif(btrim(new.override_reason), '') is null
       or not public.is_verified_human_approver(old.issue_id) then
      raise exception using errcode = '42501', message = 'invalid agent override';
    end if;
    return new;
  end if;

  if to_jsonb(new) - array['proposal_applied_by','proposal_applied_at']
     = to_jsonb(old) - array['proposal_applied_by','proposal_applied_at'] then
    if old.proposal_applied_at is not null
       or new.proposal_applied_by is distinct from auth.uid()
       or new.proposal_applied_at is null
       or old.agent_name <> 'intake'
       or old.status <> 'SUCCESS'
       or not public.is_verified_human_approver(old.issue_id) then
      raise exception using errcode = '42501', message = 'invalid intake proposal application';
    end if;
    return new;
  end if;

  raise exception using errcode = '55000', message = 'agent run evidence is immutable';
end;
$$;

create trigger agent_runs_guard_mutation
  before update or delete on agent_runs
  for each row execute function public.guard_agent_run_mutation();

create policy agent_runs_admin_override on agent_runs
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin() and was_overridden and overridden_by = auth.uid());

revoke insert, delete on agent_runs from public, anon, authenticated;
revoke update, delete on agent_runs from service_role;
grant select, update on agent_runs to authenticated;
grant select, insert on agent_runs to service_role;
grant usage, select on sequence agent_runs_id_seq to service_role;

create or replace function public.guard_cluster_candidate_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from agent_runs r
       where r.id = new.agent_run_id
         and r.agent_name = 'cluster'
         and r.status = 'SUCCESS'
         and r.issue_id = new.source_issue_id
    ) then
      raise exception using errcode = '23514', message = 'cluster candidate requires a matching successful cluster run';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'cluster proposals are append-only';
  end if;

  if old.review_status <> 'PENDING'
     or new.review_status not in ('APPROVED', 'REJECTED')
     or new.reviewed_by is distinct from auth.uid()
     or new.reviewed_at is null
     or to_jsonb(new) - array['review_status','reviewed_by','reviewed_at','review_reason']
        <> to_jsonb(old) - array['review_status','reviewed_by','reviewed_at','review_reason'] then
    raise exception using errcode = '55000', message = 'cluster proposal may be reviewed exactly once';
  end if;
  return new;
end;
$$;

create trigger cluster_candidates_guard_mutation
  before insert or update or delete on cluster_candidates
  for each row execute function public.guard_cluster_candidate_mutation();

-- RLS is bypassed by service_role, so append-only audit tables also need a
-- trigger-level invariant and explicit privilege removal.
create or replace function public.prevent_append_only_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception using errcode = '55000', message = tg_table_name || ' is append-only';
end;
$$;

create trigger issue_history_prevent_mutation
  before update or delete on issue_history
  for each row execute function public.prevent_append_only_mutation();
create trigger issue_transfers_prevent_mutation
  before update or delete on issue_transfers
  for each row execute function public.prevent_append_only_mutation();

revoke update, delete on issue_history, issue_transfers
  from public, anon, authenticated, service_role;

-- service_role bypasses RLS, but it still obeys SQL privileges. Workers may
-- read domain state and insert proposals; they cannot use model output to write
-- citizen-facing state directly. Existing owner-defined triggers and the human
-- approval RPCs below retain the privileges needed for sanctioned changes.
revoke insert, update, delete on
  issues, reports, issue_evidence, issue_followers, issue_participants,
  issue_transfers, issue_history, resolution_submissions, verification_responses
from service_role;

create or replace function public.apply_intake_proposal(p_agent_run_id bigint)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_run agent_runs%rowtype;
  v_issue issues%rowtype;
  v_output jsonb;
  v_jurisdiction bigint;
  v_authority bigint;
  v_department bigint;
  v_category text;
  v_tier routing_tier;
  v_match jurisdiction_match_method;
  v_visibility issue_visibility;
  v_verdict moderation_verdict;
  v_status issue_status;
  v_published timestamptz;
  v_rejection_reason text;
begin
  select * into v_run from agent_runs where id = p_agent_run_id for update;
  if not found or v_run.agent_name <> 'intake' or v_run.status <> 'SUCCESS'
     or v_run.output is null or jsonb_typeof(v_run.output) <> 'object' then
    raise exception using errcode = '22023', message = 'valid successful intake proposal required';
  end if;
  if v_run.proposal_applied_at is not null then
    raise exception using errcode = '55000', message = 'intake proposal was already applied';
  end if;

  select i.* into v_issue
    from issues i join reports r on r.issue_id = i.id
   where i.id = v_run.issue_id and r.id = v_run.report_id
   for update of i;
  if not found or v_issue.status not in ('OPEN', 'HELD') or v_issue.merged_into_id is not null then
    raise exception using errcode = '55000', message = 'intake proposal target is stale';
  end if;

  v_output := v_run.output;
  begin
    v_jurisdiction := nullif(v_output->>'jurisdiction_id', '')::bigint;
    v_authority := nullif(v_output->>'authority_id', '')::bigint;
    v_department := nullif(v_output->>'department_id', '')::bigint;
    v_category := nullif(v_output->>'category_id', '');
    v_tier := coalesce(nullif(v_output->>'routing_tier', '')::routing_tier, 'UNMAPPED');
    v_match := coalesce(nullif(v_output->>'jurisdiction_match_method', '')::jurisdiction_match_method, 'NONE');
    v_visibility := coalesce(nullif(v_output->>'visibility', '')::issue_visibility, v_issue.visibility);
    v_verdict := nullif(v_output->>'moderation_verdict', '')::moderation_verdict;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'intake proposal contains an invalid typed value';
  end;

  if v_verdict is null then
    raise exception using errcode = '22023', message = 'intake moderation verdict is required';
  end if;
  if v_category is not null and not exists (select 1 from categories c where c.id = v_category and c.is_active) then
    raise exception using errcode = '22023', message = 'intake category is not active';
  end if;

  if not (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'ADMIN')
    and public.current_app_role() = 'ADMIN'
  ) and not (
    public.current_app_role() = 'GOVERNMENT'
    and exists (select 1 from users u where u.id = auth.uid() and u.role = 'GOVERNMENT')
    and public.gov_scope_covers(v_jurisdiction)
  ) then
    raise exception using errcode = '42501', message = 'human approval is outside the caller scope';
  end if;

  if v_tier = 'CONTACTABLE' then
    if not exists (
      select 1 from authorities a
       where a.id = v_authority and a.is_active
         and a.verification_status = 'VERIFIED'
         and a.grievance_email is not null
         and a.department_id is not distinct from v_department
    ) then
      raise exception using errcode = '22023', message = 'contactable routing requires a verified authority';
    end if;
  elsif v_tier = 'ONBOARDED' then
    if v_department is null or not exists (
      select 1
        from government_officers o
        join jurisdiction_descendants(o.jurisdiction_id) d on d.id = v_jurisdiction
       where o.department_id = v_department and o.is_active
    ) then
      raise exception using errcode = '22023', message = 'onboarded routing requires an active in-scope officer';
    end if;
    if v_authority is not null and not exists (
      select 1 from authorities a
       where a.id = v_authority and a.is_active
         and a.department_id is not distinct from v_department
    ) then
      raise exception using errcode = '22023', message = 'routing authority does not match the department';
    end if;
  elsif v_authority is not null or v_department is not null then
    raise exception using errcode = '22023', message = 'unmapped routing cannot assign an authority or department';
  end if;

  v_rejection_reason := nullif(btrim(v_output->>'rejection_reason'), '');
  if v_verdict = 'REJECT' then
    if v_rejection_reason is null then
      raise exception using errcode = '22023', message = 'rejected intake requires a reason';
    end if;
    v_status := 'REJECTED';
    v_published := null;
  elsif v_verdict in ('HOLD', 'EMERGENCY') then
    v_status := 'HELD';
    v_published := null;
  else
    v_status := 'OPEN';
    v_published := case when v_visibility = 'CONFIDENTIAL' then null else now() end;
  end if;

  update issues
     set title = coalesce(nullif(btrim(v_output->>'title'), ''), title),
         category_id = v_category,
         subcategory = nullif(btrim(v_output->>'subcategory'), ''),
         severity = coalesce(nullif(v_output->>'severity', '')::issue_severity, severity),
         priority = coalesce(nullif(v_output->>'priority', '')::issue_priority, priority),
         visibility = v_visibility,
         moderation_verdict = v_verdict,
         moderation_reviewed_by = auth.uid(),
         moderation_reviewed_at = now(),
         jurisdiction_id = v_jurisdiction,
         jurisdiction_match_method = v_match,
         authority_id = v_authority,
         department_id = v_department,
         routing_tier = v_tier,
         status = v_status,
         rejection_reason = v_rejection_reason,
         published_at = v_published
   where id = v_issue.id;

  update agent_runs
     set proposal_applied_by = auth.uid(), proposal_applied_at = now()
   where id = v_run.id;

  perform log_issue_event(v_issue.id, 'INTAKE_PROPOSAL_APPROVED', null, v_run.id::text,
    jsonb_build_object('agent_run_id', v_run.id, 'approved_by', auth.uid()));
  return v_issue.id;
end;
$$;

revoke all on function public.apply_intake_proposal(bigint) from public, anon;
grant execute on function public.apply_intake_proposal(bigint) to authenticated;

create or replace function public.approve_cluster_merge(
  p_candidate_id uuid,
  p_reason text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_candidate cluster_candidates%rowtype;
  v_source_status issue_status;
  v_target_status issue_status;
begin
  select * into v_candidate from cluster_candidates where id = p_candidate_id for update;
  if not found or v_candidate.review_status <> 'PENDING' then
    raise exception using errcode = '55000', message = 'cluster proposal is stale or already reviewed';
  end if;

  perform 1 from issues
   where id in (v_candidate.source_issue_id, v_candidate.target_issue_id)
   order by id for update;
  select status into v_source_status from issues where id = v_candidate.source_issue_id;
  select status into v_target_status from issues where id = v_candidate.target_issue_id;

  if not public.is_verified_human_approver(v_candidate.source_issue_id)
     or not public.is_verified_human_approver(v_candidate.target_issue_id) then
    raise exception using errcode = '42501', message = 'cluster approval is outside the caller scope';
  end if;
  if v_source_status not in ('OPEN', 'HELD')
     or v_target_status in ('MERGED', 'REJECTED', 'CLOSED')
     or exists (select 1 from resolution_submissions where issue_id = v_candidate.source_issue_id)
     or exists (select 1 from issue_participants where issue_id = v_candidate.source_issue_id)
     or exists (select 1 from issue_transfers where issue_id = v_candidate.source_issue_id)
     or exists (select 1 from comments where issue_id = v_candidate.source_issue_id) then
    raise exception using errcode = '55000', message = 'source issue changed after cluster proposal';
  end if;

  update issue_evidence set issue_id = v_candidate.target_issue_id
   where issue_id = v_candidate.source_issue_id;
  update reports set issue_id = v_candidate.target_issue_id
   where issue_id = v_candidate.source_issue_id;

  insert into issue_followers (issue_id, user_id, muted, created_at)
    select v_candidate.target_issue_id, user_id, muted, created_at
      from issue_followers where issue_id = v_candidate.source_issue_id
  on conflict do nothing;
  delete from issue_followers where issue_id = v_candidate.source_issue_id;

  update issues
     set status = 'MERGED', merged_into_id = v_candidate.target_issue_id
   where id = v_candidate.source_issue_id;

  update cluster_candidates
     set review_status = 'APPROVED', reviewed_by = auth.uid(),
         reviewed_at = now(), review_reason = nullif(btrim(p_reason), '')
   where id = v_candidate.id;

  perform log_issue_event(v_candidate.source_issue_id, 'CLUSTER_MERGE_APPROVED',
    v_candidate.source_issue_id::text, v_candidate.target_issue_id::text,
    jsonb_build_object('candidate_id', v_candidate.id, 'agent_run_id', v_candidate.agent_run_id,
                       'approved_by', auth.uid(), 'reason', nullif(btrim(p_reason), '')));
  return v_candidate.target_issue_id;
end;
$$;

revoke all on function public.approve_cluster_merge(uuid, text) from public, anon;
grant execute on function public.approve_cluster_merge(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Narrow PGMQ 1.5.1 worker API. Message ids cross the API as text so JavaScript
-- never rounds bigint values. Mutations lock and compare read_ct before acting.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pgmq.meta where queue_name = 'dead_letter') then
    perform pgmq.create('dead_letter');
  end if;
end;
$$;

create or replace function public.worker_queue_allowed(p_queue text)
returns boolean language sql immutable as $$
  select p_queue = any (array['intake','cluster','verify','dispatch','notify','dead_letter']);
$$;

create or replace function public.worker_lock_queue_message(
  p_queue text, p_msg_id text, p_expected_read_ct integer
) returns jsonb
language plpgsql security definer set search_path = public, pgmq, pg_temp as $$
declare
  v_message jsonb;
  v_id bigint;
begin
  if not public.worker_queue_allowed(p_queue)
     or p_msg_id is null or p_msg_id !~ '^[0-9]+$'
     or p_expected_read_ct is null or p_expected_read_ct < 1 then
    raise exception using errcode = '22023', message = 'invalid queue message reference';
  end if;
  v_id := p_msg_id::bigint;
  execute format('select message from pgmq.%I where msg_id = $1 and read_ct = $2 for update', 'q_' || p_queue)
    into v_message using v_id, p_expected_read_ct;
  if not found then
    raise exception using errcode = '40001', message = 'queue message is missing or was read by another worker';
  end if;
  return v_message;
end;
$$;

create or replace function public.worker_queue_read(
  p_queue text, p_visibility_timeout integer default 60, p_batch_size integer default 1
) returns table (
  msg_id text, read_ct integer, enqueued_at timestamptz, vt timestamptz, message jsonb
)
language plpgsql security definer set search_path = public, pgmq, pg_temp as $$
begin
  if not public.worker_queue_allowed(p_queue)
     or p_visibility_timeout < 1 or p_visibility_timeout > 43200
     or p_batch_size < 1 or p_batch_size > 100 then
    raise exception using errcode = '22023', message = 'invalid queue read request';
  end if;
  return query
    select r.msg_id::text, r.read_ct, r.enqueued_at, r.vt, r.message
      from pgmq.read(p_queue, p_visibility_timeout, p_batch_size) r;
end;
$$;

create or replace function public.worker_queue_send(
  p_queue text, p_message jsonb, p_delay_seconds integer default 0
) returns text
language plpgsql security definer set search_path = public, pgmq, pg_temp as $$
declare v_id bigint;
begin
  if not public.worker_queue_allowed(p_queue)
     or p_message is null or p_delay_seconds < 0 or p_delay_seconds > 604800 then
    raise exception using errcode = '22023', message = 'invalid queue send request';
  end if;
  select pgmq.send(p_queue, p_message, p_delay_seconds) into v_id;
  return v_id::text;
end;
$$;

create or replace function public.worker_queue_archive(
  p_queue text, p_msg_id text, p_expected_read_ct integer
) returns text
language plpgsql security definer set search_path = public, pgmq, pg_temp as $$
begin
  perform public.worker_lock_queue_message(p_queue, p_msg_id, p_expected_read_ct);
  if not pgmq.archive(p_queue, p_msg_id::bigint) then
    raise exception using errcode = '40001', message = 'queue message could not be archived';
  end if;
  return p_msg_id;
end;
$$;

create or replace function public.worker_queue_retry(
  p_queue text, p_msg_id text, p_expected_read_ct integer, p_delay_seconds integer
) returns text
language plpgsql security definer set search_path = public, pgmq, pg_temp as $$
begin
  if p_delay_seconds < 1 or p_delay_seconds > 604800 then
    raise exception using errcode = '22023', message = 'invalid retry delay';
  end if;
  perform public.worker_lock_queue_message(p_queue, p_msg_id, p_expected_read_ct);
  perform pgmq.set_vt(p_queue, p_msg_id::bigint, p_delay_seconds);
  return p_msg_id;
end;
$$;

create or replace function public.worker_queue_dead_letter(
  p_queue text, p_msg_id text, p_expected_read_ct integer, p_reason text
) returns text
language plpgsql security definer set search_path = public, pgmq, pg_temp as $$
declare
  v_message jsonb;
  v_dead_id bigint;
begin
  if p_queue = 'dead_letter' or nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'invalid dead-letter request';
  end if;
  v_message := public.worker_lock_queue_message(p_queue, p_msg_id, p_expected_read_ct);
  select pgmq.send('dead_letter', jsonb_build_object(
    'source_queue', p_queue,
    'source_msg_id', p_msg_id,
    'source_read_ct', p_expected_read_ct,
    'reason', btrim(p_reason),
    'failed_at', now(),
    'message', v_message
  )) into v_dead_id;
  if not pgmq.archive(p_queue, p_msg_id::bigint) then
    raise exception using errcode = '40001', message = 'queue message could not be dead-lettered';
  end if;
  return v_dead_id::text;
end;
$$;

revoke all on function public.worker_queue_allowed(text) from public, anon, authenticated, service_role;
revoke all on function public.worker_lock_queue_message(text, text, integer) from public, anon, authenticated, service_role;
revoke all on function public.worker_queue_read(text, integer, integer) from public, anon, authenticated;
revoke all on function public.worker_queue_send(text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.worker_queue_archive(text, text, integer) from public, anon, authenticated;
revoke all on function public.worker_queue_retry(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.worker_queue_dead_letter(text, text, integer, text) from public, anon, authenticated;

grant execute on function public.worker_queue_read(text, integer, integer) to service_role;
grant execute on function public.worker_queue_send(text, jsonb, integer) to service_role;
grant execute on function public.worker_queue_archive(text, text, integer) to service_role;
grant execute on function public.worker_queue_retry(text, text, integer, integer) to service_role;
grant execute on function public.worker_queue_dead_letter(text, text, integer, text) to service_role;

-- Workers receive narrow, pre-shaped context instead of broad table mutation
-- rights. Exact coordinates remain server-side and never enter a public view.
create or replace function public.worker_intake_context(
  p_issue_id uuid, p_report_id uuid
) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'issue_id', i.id,
    'report_id', r.id,
    'text', coalesce(r.description, i.description, ''),
    'transcript', r.transcript,
    'address', i.address
  ) into v_result
  from issues i
  join reports r on r.issue_id = i.id
  where i.id = p_issue_id and r.id = p_report_id;

  if v_result is null then
    raise exception using errcode = '22023', message = 'intake report context was not found';
  end if;
  return v_result;
end;
$$;

create or replace function public.worker_cluster_context(p_issue_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_source issues%rowtype;
  v_candidates jsonb;
begin
  select * into v_source from issues where id = p_issue_id;
  if not found then
    raise exception using errcode = '22023', message = 'cluster source issue was not found';
  end if;

  if v_source.visibility = 'CONFIDENTIAL' then
    v_candidates := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'issueId', i.id,
      'text', concat_ws(E'\n', i.title, i.description),
      'location', jsonb_build_object(
        'lat', ST_Y(i.location::geometry),
        'lng', ST_X(i.location::geometry)
      ),
      'distanceM', ST_Distance(v_source.location, i.location)
    ) order by ST_Distance(v_source.location, i.location)), '[]'::jsonb)
      into v_candidates
    from issues i
    where i.id <> v_source.id
      and i.visibility <> 'CONFIDENTIAL'
      and i.status not in ('MERGED', 'REJECTED', 'CLOSED')
      and ST_DWithin(v_source.location, i.location, 500)
    limit 25;
  end if;

  return jsonb_build_object(
    'issue', jsonb_build_object(
      'issueId', v_source.id,
      'text', concat_ws(E'\n', v_source.title, v_source.description),
      'location', jsonb_build_object(
        'lat', ST_Y(v_source.location::geometry),
        'lng', ST_X(v_source.location::geometry)
      )
    ),
    'candidates', v_candidates
  );
end;
$$;

create or replace function public.worker_verify_context(p_resolution_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'issue_id', i.id,
    'resolution_id', s.id,
    'before_description', i.description,
    'after_description', s.action_taken,
    'same_location', case
      when s.resolution_gps_distance_m is null then null
      else s.resolution_gps_distance_m <= 250
    end
  ) into v_result
  from resolution_submissions s
  join issues i on i.id = s.issue_id
  where s.id = p_resolution_id;

  if v_result is null then
    raise exception using errcode = '22023', message = 'verification context was not found';
  end if;
  return v_result;
end;
$$;

revoke all on function public.worker_intake_context(uuid, uuid) from public, anon, authenticated;
revoke all on function public.worker_cluster_context(uuid) from public, anon, authenticated;
revoke all on function public.worker_verify_context(uuid) from public, anon, authenticated;
grant execute on function public.worker_intake_context(uuid, uuid) to service_role;
grant execute on function public.worker_cluster_context(uuid) to service_role;
grant execute on function public.worker_verify_context(uuid) to service_role;

-- Filing a resolution is an explicit officer action. It opens community
-- verification and enqueues the advisory verifier; the verifier never closes.
create or replace function public.open_resolution_verification()
returns trigger
language plpgsql security definer set search_path = public, pgmq as $$
begin
  update resolution_submissions
     set verification_opened_at = coalesce(verification_opened_at, now())
   where id = new.id;

  update issues
     set status = 'AWAITING_VERIFICATION'
   where id = new.issue_id
     and status not in ('MERGED', 'REJECTED', 'CLOSED');

  perform pgmq.send('verify', jsonb_build_object(
    'issue_id', new.issue_id,
    'resolution_id', new.id,
    'enqueued_at', now()
  ));
  return new;
end;
$$;

create trigger resolution_submissions_open_verification
  after insert on resolution_submissions
  for each row execute function public.open_resolution_verification();

-- Workers use only the wrappers. Existing owner-owned triggers remain able to
-- enqueue because SECURITY DEFINER resolves privileges as their owner.
revoke execute on all functions in schema pgmq from public, anon, authenticated, service_role;
revoke all on schema pgmq from public, anon, authenticated, service_role;
