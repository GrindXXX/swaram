begin;

select plan(23);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'citizen@example.com', '', now(), '{}', '{}', now(), now()),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'other@example.com', '', now(), '{}', '{}', now(), now());

reset role;
insert into issues (id, public_id, title, description, location, visibility, published_at, created_by)
values (
  '30000000-0000-4000-8000-000000000003', 'CIV-20000', 'Broken crossing', 'Unsafe crossing',
  ST_SetSRID(ST_Point(77.5946, 12.9716), 4326)::geography, 'PUBLIC', now(),
  '20000000-0000-4000-8000-000000000002'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"CITIZEN"}', true);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(auth.uid(), '10000000-0000-4000-8000-000000000001'::uuid, 'citizen JWT is active');
select lives_ok($$select * from set_citizen_issue_following('CIV-20000', true)$$, 'citizen can follow');
select is((select count(*)::int from issue_followers), 1, 'follow row exists');
select is((select follower_count from issues where public_id = 'CIV-20000'), 1, 'follow counter is live');
select ok((select is_following from citizen_issue_state('CIV-20000')), 'state reports following');
select is((select is_following from set_citizen_issue_following('CIV-20000', true)), true, 'repeated follow is idempotent');

select lives_ok($$select create_citizen_comment('CIV-20000', 'The crossing is still unsafe.')$$, 'citizen can comment');
select is((select count(*)::int from comments), 1, 'one public comment exists');
select is((select content from comments limit 1), 'The crossing is still unsafe.', 'comment is trimmed and stored');

insert into reports (
  issue_id, user_id, client_report_id, description, media_type, location,
  is_anonymous, source, is_facing_too
) values (
  '30000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000006', 'normal report', 'NONE',
  ST_SetSRID(ST_Point(77.5946, 12.9716), 4326)::geography,
  true, 'CITIZEN_APP', true
);
reset role;
select isnt((select is_facing_too from reports where client_report_id = '60000000-0000-4000-8000-000000000006'), true, 'direct report inserts cannot forge facing-too');
delete from reports where client_report_id = '60000000-0000-4000-8000-000000000006';
set local role authenticated;

select ok((select inserted from add_citizen_issue_report('CIV-20000', '40000000-0000-4000-8000-000000000004')), 'facing too reports a new insert');
select is((select count(id)::int from reports where is_facing_too), 1, 'facing too creates one marked report');
select is((select report_count from issues where public_id = 'CIV-20000'), 1, 'report counter is live');
select ok((select has_reported from citizen_issue_state('CIV-20000')), 'state reports citizen has reported');
reset role;
select is(
  (select count(*)::int
     from pgmq.q_intake q
    where q.message ->> 'report_id' in (
      select r.id::text from reports r where r.is_facing_too
    )),
  0,
  'facing-too confirmation does not enqueue canonical issue reclassification'
);
set local role authenticated;

select isnt((select inserted from add_citizen_issue_report('CIV-20000', '50000000-0000-4000-8000-000000000005')), true, 'repeated facing too reports no insert');
select is((select count(id)::int from reports where is_facing_too), 1, 'idempotency keeps one report');

select lives_ok($$select * from set_citizen_issue_following('CIV-20000', false)$$, 'citizen can unfollow');
select is((select follower_count from issues where public_id = 'CIV-20000'), 0, 'unfollow counter is live');
select isnt((select is_following from citizen_issue_state('CIV-20000')), true, 'state reports unfollowed');

select ok(has_function_privilege('authenticated', 'citizen_issue_state(text)', 'EXECUTE'), 'authenticated can read citizen issue state');
select ok(not has_function_privilege('anon', 'add_citizen_issue_report(text,uuid)', 'EXECUTE'), 'anonymous callers cannot add facing-too reports');
select throws_ok(
  $$select * from set_citizen_issue_following('CIV-NOT-FOUND', true)$$,
  'P0002', 'issue not found', 'follow reports a missing issue cleanly'
);

select * from finish();
rollback;
