begin;

select plan(23);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('91000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pipeline-citizen@example.com', '', now(), '{}', '{"name":"Citizen"}', now(), now()),
  ('92000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pipeline-admin@example.com', '', now(), '{}', '{"name":"Admin"}', now(), now());

update users set role = 'ADMIN' where id = '92000000-0000-4000-8000-000000000002';

insert into issues (id, public_id, title, description, location, created_by)
values
  ('93000000-0000-4000-8000-000000000003', 'CIV-99001', 'Raw source', 'Raw source',
   ST_SetSRID(ST_Point(77.5946, 12.9716), 4326)::geography,
   '91000000-0000-4000-8000-000000000001'),
  ('94000000-0000-4000-8000-000000000004', 'CIV-99002', 'Existing issue', 'Existing issue',
   ST_SetSRID(ST_Point(77.5947, 12.9717), 4326)::geography,
   '92000000-0000-4000-8000-000000000002');

insert into reports (id, issue_id, user_id, description, location)
values ('95000000-0000-4000-8000-000000000005',
        '93000000-0000-4000-8000-000000000003',
        '91000000-0000-4000-8000-000000000001', 'Raw report',
        ST_SetSRID(ST_Point(77.5946, 12.9716), 4326)::geography);

select throws_ok(
  $$insert into agent_runs (agent_name, issue_id, report_id, input, model)
    values ('safety', '93000000-0000-4000-8000-000000000003',
            '95000000-0000-4000-8000-000000000005', '{}', 'test')$$,
  '23514', null, 'new agent names are limited to the three pipeline stages'
);

insert into agent_runs (id, agent_name, issue_id, report_id, input, output, model)
values (
  99001, 'intake', '93000000-0000-4000-8000-000000000003',
  '95000000-0000-4000-8000-000000000005', '{}',
  '{"title":"Reviewed drain overflow","category_id":null,"severity":"HIGH","priority":"HIGH","visibility":"PUBLIC","moderation_verdict":"HOLD","jurisdiction_id":null,"jurisdiction_match_method":"NONE","authority_id":null,"department_id":null,"routing_tier":"UNMAPPED"}',
  'test-model'
), (
  99002, 'cluster', '93000000-0000-4000-8000-000000000003', null,
  '{}', '{"same_problem":true}', 'test-model'
);

insert into cluster_candidates (
  id, agent_run_id, source_issue_id, target_issue_id, confidence, rationale
) values (
  '96000000-0000-4000-8000-000000000006', 99002,
  '93000000-0000-4000-8000-000000000003',
  '94000000-0000-4000-8000-000000000004', 0.950, 'Same drain and location'
);

set local role service_role;
select throws_ok(
  $$update issues set title = 'Agent committed this' where id = '93000000-0000-4000-8000-000000000003'$$,
  '42501', null, 'service worker cannot directly commit citizen-facing changes'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"CITIZEN"}', true);
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);

select is((select count(*)::int from agent_runs), 0, 'citizen cannot read private agent evidence');
select is((select count(*)::int from cluster_candidates), 0, 'citizen cannot read cluster proposals');
select throws_ok(
  $$select apply_intake_proposal(99001)$$,
  '42501', 'human approval is outside the caller scope',
  'citizen cannot apply an intake proposal'
);
select throws_ok(
  $$select approve_cluster_merge('96000000-0000-4000-8000-000000000006')$$,
  '42501', 'cluster approval is outside the caller scope',
  'citizen cannot approve a cluster merge'
);

select set_config('request.jwt.claims',
  '{"sub":"92000000-0000-4000-8000-000000000002","role":"authenticated","app_role":"ADMIN"}', true);
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000002', true);

select is(
  (select count(*)::int from agent_runs where id in (99001, 99002)),
  2,
  'admin can inspect agent evidence'
);
select is((select count(*)::int from cluster_candidates), 1, 'admin can inspect cluster proposals');
select lives_ok($$select apply_intake_proposal(99001)$$, 'admin can apply an intake proposal');
select is(
  (select title from issues where id = '93000000-0000-4000-8000-000000000003'),
  'Reviewed drain overflow', 'approved intake fields are applied'
);
select is(
  (select status::text from issues where id = '93000000-0000-4000-8000-000000000003'),
  'HELD', 'moderation remains a human-approved publication boundary'
);
select is(
  (select proposal_applied_by from agent_runs where id = 99001),
  '92000000-0000-4000-8000-000000000002'::uuid,
  'intake approval records its human actor'
);
select throws_ok(
  $$select apply_intake_proposal(99001)$$,
  '55000', 'intake proposal was already applied',
  'an intake proposal cannot be applied twice'
);

select lives_ok(
  $$select approve_cluster_merge('96000000-0000-4000-8000-000000000006', 'Confirmed same incident')$$,
  'admin can approve a pending merge'
);
select is(
  (select issue_id from reports where id = '95000000-0000-4000-8000-000000000005'),
  '94000000-0000-4000-8000-000000000004'::uuid,
  'approval, not agent insertion, moves the report'
);
select is(
  (select merged_into_id from issues where id = '93000000-0000-4000-8000-000000000003'),
  '94000000-0000-4000-8000-000000000004'::uuid,
  'the merged issue retains its redirect'
);
select is(
  (select review_status from cluster_candidates where id = '96000000-0000-4000-8000-000000000006'),
  'APPROVED', 'cluster proposal records the human decision'
);
select ok(
  exists (select 1 from issue_history
           where issue_id = '93000000-0000-4000-8000-000000000003'
             and action = 'CLUSTER_MERGE_APPROVED'),
  'merge approval is appended to issue history'
);

reset role;
select throws_ok(
  $$delete from agent_runs where id = 99002$$,
  '55000', 'agent runs are append-only', 'even an RLS-bypassing owner cannot erase an agent run'
);

select ok(
  has_function_privilege('service_role', 'public.worker_queue_read(text,integer,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.worker_queue_read(text,integer,integer)', 'EXECUTE'),
  'queue reads are exposed only to service_role'
);
select ok(
  has_function_privilege('service_role', 'public.worker_queue_dead_letter(text,text,integer,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.worker_queue_dead_letter(text,text,integer,text)', 'EXECUTE'),
  'queue dead-lettering is exposed only to service_role'
);

set local role service_role;
select lives_ok(
  $$do $test$
  declare v_id text; v_row record;
  begin
    v_id := worker_queue_send('notify', '{"test":"receipt"}', 0);
    select * into strict v_row from worker_queue_read('notify', 30, 10) where msg_id = v_id;
    perform worker_queue_retry('notify', v_id, v_row.read_ct, 1);
    perform worker_queue_archive('notify', v_id, v_row.read_ct);
  end $test$;$$,
  'queue send, read, retry and archive complete without nested lock waits'
);
select lives_ok(
  $$do $test$
  declare v_id text; v_row record;
  begin
    v_id := worker_queue_send('notify', '{"test":"dead-letter"}', 0);
    select * into strict v_row from worker_queue_read('notify', 30, 10) where msg_id = v_id;
    perform worker_queue_dead_letter('notify', v_id, v_row.read_ct, 'test terminal failure');
  end $test$;$$,
  'dead-letter moves and archives one receipt atomically'
);

select * from finish();
rollback;
