begin;

select plan(29);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'citizen@example.com', '', now(), '{}', '{}', now(), now()),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'other@example.com', '', now(), '{}', '{}', now(), now()),
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'officer@gov.in', '', now(), '{}', '{}', now(), now());

insert into jurisdictions (id, name, level, source)
values (9001, 'Test ward', 'WARD', 'pgTAP');
insert into departments (id, name, slug, jurisdiction_id)
values (9101, 'Roads', 'test-roads', 9001),
       (9102, 'Water', 'test-water', 9001);

update users set role = 'GOVERNMENT' where id = '30000000-0000-4000-8000-000000000003';
insert into government_officers (id, user_id, department_id, jurisdiction_id, jurisdiction_level)
values (9201, '30000000-0000-4000-8000-000000000003', 9101, 9001, 'WARD');

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated","app_role":"ADMIN"}',
  true
);
insert into issues (
  id, public_id, title, description, location, visibility, published_at,
  moderation_verdict, jurisdiction_id, department_id, routing_tier, created_by
) values
  ('40000000-0000-4000-8000-000000000004', 'CIV-29001', 'Road issue', 'Road issue',
   ST_SetSRID(ST_Point(77.5946, 12.9716), 4326)::geography, 'PUBLIC', now(),
   'CLEAR', 9001, 9101, 'ONBOARDED', '10000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000005', 'CIV-29002', 'Water issue', 'Water issue',
   ST_SetSRID(ST_Point(77.5947, 12.9717), 4326)::geography, 'PUBLIC', now(),
   'CLEAR', 9001, 9102, 'ONBOARDED', '20000000-0000-4000-8000-000000000002');

insert into comments (id, issue_id, user_id, content)
values ('60000000-0000-4000-8000-000000000006',
        '40000000-0000-4000-8000-000000000004',
        '10000000-0000-4000-8000-000000000001', 'Original');
insert into reports (
  id, issue_id, user_id, client_report_id, description, location, source
) values (
  '70000000-0000-4000-8000-000000000007',
  '40000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000007', 'Original evidence',
  ST_SetSRID(ST_Point(77.5946, 12.9716), 4326)::geography, 'IMPORT'
);
insert into officer_roster_records (
  id, source_batch_id, email, department_id, jurisdiction_id
) values (9301, 'pgtap', 'citizen@example.com', 9101, 9001);
insert into resolution_submissions (
  id, issue_id, submitted_by, department_id, action_taken, verification_opened_at
) values (
  '80000000-0000-4000-8000-000000000008',
  '40000000-0000-4000-8000-000000000004',
  '30000000-0000-4000-8000-000000000003', 9101, 'Repaired', now()
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"CITIZEN"}',
  true
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

update users
   set display_name = 'Safe profile edit', email = 'forged@example.com',
       full_name = 'Forged legal identity', role = 'ADMIN',
       identity_tier = 'ENHANCED', is_suspended = true
 where id = '10000000-0000-4000-8000-000000000001';
select is((select display_name from users where id = auth.uid()), 'Safe profile edit',
          'citizen profile presentation remains editable');
select is((select email from users where id = auth.uid()), 'citizen@example.com',
          'citizen cannot rewrite identity email');
select is((select role::text from users where id = auth.uid()), 'CITIZEN',
          'citizen cannot self-promote');
select is((select identity_tier from users where id = auth.uid()), 'EMAIL',
          'citizen cannot forge identity tier');
select isnt((select is_suspended from users where id = auth.uid()), true,
            'citizen cannot clear or set suspension state');

update comments
   set content = 'Edited', issue_id = '50000000-0000-4000-8000-000000000005',
       user_id = '20000000-0000-4000-8000-000000000002', visibility = 'INTERNAL',
       is_official = true, is_representative = true, is_hidden = true, flag_count = 99
 where id = '60000000-0000-4000-8000-000000000006';
select is((select content from comments where id = '60000000-0000-4000-8000-000000000006'),
          'Edited', 'citizen comment content remains editable');
select is((select issue_id from comments where id = '60000000-0000-4000-8000-000000000006'),
          '40000000-0000-4000-8000-000000000004'::uuid, 'comment cannot move issues');
select is((select user_id from comments where id = '60000000-0000-4000-8000-000000000006'),
          auth.uid(), 'comment cannot be reattributed');
select is(
  (select (visibility::text, is_official, is_representative, is_hidden, flag_count)::text
     from comments where id = '60000000-0000-4000-8000-000000000006'),
  '(PUBLIC,f,f,f,0)', 'citizen cannot forge comment trust or moderation flags'
);

update reports
   set description = 'Corrected evidence',
       issue_id = '50000000-0000-4000-8000-000000000005',
       user_id = '20000000-0000-4000-8000-000000000002',
       client_report_id = gen_random_uuid(),
       location = ST_SetSRID(ST_Point(80, 20), 4326)::geography,
       source = 'OFFICER'
 where id = '70000000-0000-4000-8000-000000000007';
reset role;
select is((select description from reports where id = '70000000-0000-4000-8000-000000000007'),
          'Corrected evidence', 'report narrative remains editable');
select is((select issue_id from reports where id = '70000000-0000-4000-8000-000000000007'),
          '40000000-0000-4000-8000-000000000004'::uuid, 'report cannot move issues');
select is((select user_id from reports where id = '70000000-0000-4000-8000-000000000007'),
          auth.uid(), 'report cannot be reattributed');
select is((select source::text from reports where id = '70000000-0000-4000-8000-000000000007'),
          'IMPORT', 'report source is immutable');
select is(round(ST_X((select location::geometry from reports where id = '70000000-0000-4000-8000-000000000007'))::numeric, 4),
          77.5946::numeric, 'report location is immutable');

set local role authenticated;
select lives_ok(
  $$select * from officer_claim_candidate('10000000-0000-4000-8000-000000000001')$$,
  'officer candidate lookup works for the signed-in subject'
);
select throws_ok(
  $$select * from officer_claim_candidate('20000000-0000-4000-8000-000000000002')$$,
  '42501', 'officer claim lookup is limited to the signed-in user',
  'officer candidate lookup cannot enumerate another user'
);
select throws_ok(
  $$select check_rate_limit('20000000-0000-4000-8000-000000000002', 'REPORT', 10)$$,
  '42501', 'rate limits are bound to the signed-in user',
  'rate limiter cannot consume or probe another user budget'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.officer_claim_candidate(uuid)',
    'EXECUTE'
  ),
  'authenticated may execute officer candidate lookup'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.officer_claim_candidate(uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute officer candidate lookup'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.check_rate_limit(uuid,text,integer,interval,text)',
    'EXECUTE'
  ),
  'authenticated may execute the subject-bound rate limiter'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.check_rate_limit(uuid,text,integer,interval,text)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute the rate limiter'
);

reset role;
select throws_ok(
  $$insert into verification_responses (
      resolution_submission_id, issue_id, user_id, verdict
    ) values (
      '80000000-0000-4000-8000-000000000008',
      '50000000-0000-4000-8000-000000000005',
      '10000000-0000-4000-8000-000000000001', 'COMPLETELY_FIXED'
    )$$,
  '23503', null, 'verification response cannot mismatch submission and issue'
);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"CITIZEN"}',
  true
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$insert into verification_responses (
      resolution_submission_id, issue_id, user_id, verdict
    ) values (
      '80000000-0000-4000-8000-000000000008',
      '40000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000001', 'COMPLETELY_FIXED'
    )$$,
  'matching verification response remains valid'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated","app_role":"GOVERNMENT","juris_id":"9001","juris_lvl":"WARD","dept_id":"9101"}',
  true
);
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);

update issues set status = 'IN_PROGRESS', report_count = 999, civic_pressure = 100,
                  published_at = null, moderation_verdict = 'REJECT'
 where id = '40000000-0000-4000-8000-000000000004';
select is((select status::text from issues where id = '40000000-0000-4000-8000-000000000004'),
          'IN_PROGRESS', 'in-department government lifecycle work remains valid');
select is(
  (select (report_count, civic_pressure, published_at is not null, moderation_verdict::text)::text
     from issues where id = '40000000-0000-4000-8000-000000000004'),
  '(1,0.00,t,CLEAR)', 'government cannot forge system-owned issue state'
);

update issues set status = 'IN_PROGRESS'
 where id = '50000000-0000-4000-8000-000000000005';
select is((select status::text from issues where id = '50000000-0000-4000-8000-000000000005'),
           'OPEN', 'government cannot write another department issue');

select lives_ok(
  $$insert into issues (
      id, public_id, title, description, location, visibility, published_at,
      moderation_verdict, jurisdiction_id, department_id, routing_tier,
      civic_pressure, report_count, follower_count, created_by
    ) values (
      '90000000-0000-4000-8000-000000000009', 'FORGED-ID', 'Officer issue',
      'Officer-created issue',
      ST_SetSRID(ST_Point(77.5948, 12.9718), 4326)::geography,
      'PUBLIC', now(), 'CLEAR', 9001, 9101, 'ONBOARDED', 99, 99, 99,
      '30000000-0000-4000-8000-000000000003'
    )$$,
  'government can create an issue in its department'
);
select isnt(
  (select public_id from issues where id = '90000000-0000-4000-8000-000000000009'),
  'FORGED-ID',
  'government cannot choose a system-owned public id'
);
select is(
  (select (published_at, moderation_verdict, civic_pressure,
           report_count, follower_count)::text
     from issues where id = '90000000-0000-4000-8000-000000000009'),
  '(,,0.00,0,0)',
  'government inserts cannot forge publication, moderation, or counters'
);

select * from finish();
rollback;
