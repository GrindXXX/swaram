begin;

select plan(11);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'reporter@example.com', '', now(),
    '{}', '{"name":"Reporter"}', now(), now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'other@example.com', '', now(),
    '{}', '{"name":"Other citizen"}', now(), now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"CITIZEN"}',
  true
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  auth.uid(),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'test request carries the reporter JWT subject'
);

select lives_ok(
  $$select * from submit_citizen_report(
    '30000000-0000-4000-8000-000000000003',
    'A drain is overflowing across the road.',
    12.9716,
    77.5946
  )$$,
  'an authenticated citizen can atomically submit'
);

select is(
  (select count(issue_id)::int from citizen_my_issue_ids() where relation = 'created'),
  1,
  'reporter can read the created issue'
);
select ok(
  (select has_reported from citizen_issue_state(
    (select public_id from issues where title = 'A drain is overflowing across the road.')
  )),
  'reporter can read the created report'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('request.jwt.claim.sub', '', true);
select is(
  (select count(id)::int from issues where title = 'A drain is overflowing across the road.'),
  0,
  'anon cannot read an unpublished issue'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated","app_role":"CITIZEN"}',
  true
);
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select is(
  (select count(id)::int from issues where title = 'A drain is overflowing across the road.'),
  0,
  'another citizen cannot read an unpublished issue'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"CITIZEN"}',
  true
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select * from submit_citizen_report(
    '30000000-0000-4000-8000-000000000003',
    'A drain is overflowing across the road.',
    12.9716,
    77.5946
  )$$,
  'retrying the same device action succeeds'
);

reset role;
select is(
  (select count(*)::int from issues where created_by = '10000000-0000-4000-8000-000000000001'),
  1,
  'idempotent retry creates no second issue'
);
select is(
  (select count(*)::int from reports where client_report_id = '30000000-0000-4000-8000-000000000003'),
  1,
  'idempotent retry creates no second report'
);
select is(
  (select count(*)::int from reports where client_report_id = '30000000-0000-4000-8000-000000000003'),
  1,
  'the device idempotency key identifies one report'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"CITIZEN"}',
  true
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select * from submit_citizen_report(
    '40000000-0000-4000-8000-000000000004',
    'No location supplied.',
    null,
    null
  )$$,
  '22023',
  'location is required',
  'location is mandatory at the database boundary'
);

select * from finish();
rollback;
