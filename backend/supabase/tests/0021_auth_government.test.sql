begin;
select plan(18);

insert into jurisdictions (id, name, level, source) values
  (21001, 'Test zone', 'ZONE', 'pgtap'),
  (21002, 'Test ward', 'WARD', 'pgtap'),
  (21003, 'Other ward', 'WARD', 'pgtap');
update jurisdictions set parent_id = 21001 where id = 21002;
insert into departments (id, name, slug, jurisdiction_id) values
  (21001, 'Roads', 'test-roads', 21002), (21002, 'Water', 'test-water', 21002);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('21000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'officer@example.test', '', now(),
   '{"app_role":"ADMIN","dept_id":999}', '{}', now(), now()),
  ('21000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'citizen@example.test', '', now(), '{}', '{}', now(), now());

insert into government_officers (id, user_id, department_id, jurisdiction_id, jurisdiction_level, is_active)
values
  (21001, '21000000-0000-4000-8000-000000000001', 21001, 21001, 'ZONE', true),
  (21002, '21000000-0000-4000-8000-000000000001', null, 21001, 'ZONE', true);
update users set role = 'GOVERNMENT' where id = '21000000-0000-4000-8000-000000000001';

select is(custom_access_token('{"user_id":"21000000-0000-4000-8000-000000000001","claims":{"app_role":"ADMIN","dept_id":999}}') #>> '{claims,app_role}', 'GOVERNMENT', 'active posting mints government role');
select is(custom_access_token('{"user_id":"21000000-0000-4000-8000-000000000001","claims":{}}') #>> '{claims,dept_id}', '21001', 'department claim comes from posting');
select is(custom_access_token('{"user_id":"21000000-0000-4000-8000-000000000001","claims":{}}') #>> '{claims,juris_id}', '21001', 'jurisdiction claim comes from posting');
select is(custom_access_token('{"user_id":"21000000-0000-4000-8000-000000000002","claims":{"app_role":"GOVERNMENT"}}') #>> '{claims,app_role}', 'CITIZEN', 'client metadata cannot mint government access');

select set_config('request.jwt.claims', '{"app_role":"ADMIN"}', true);
insert into issues (id, public_id, title, location, visibility, published_at, routing_tier,
  jurisdiction_id, department_id, status) values
  ('21100000-0000-4000-8000-000000000001', 'CIV-21001', 'Road issue', ST_GeogFromText('POINT(77 12)'), 'PUBLIC', now(), 'ONBOARDED', 21002, 21001, 'OPEN'),
  ('21100000-0000-4000-8000-000000000002', 'CIV-21002', 'Water issue', ST_GeogFromText('POINT(77 12)'), 'PUBLIC', now(), 'ONBOARDED', 21002, 21002, 'OPEN'),
  ('21100000-0000-4000-8000-000000000003', 'CIV-21003', 'Unmapped issue', ST_GeogFromText('POINT(77 12)'), 'PUBLIC', now(), 'UNMAPPED', 21002, 21001, 'OPEN');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"GOVERNMENT","dept_id":21001,"juris_id":21001,"juris_lvl":"ZONE"}', true);
select set_config('request.jwt.claim.sub', '21000000-0000-4000-8000-000000000001', true);

select ok(gov_can_operate_issue('21100000-0000-4000-8000-000000000001'), 'officer operates own department in jurisdiction subtree');
select isnt(gov_can_operate_issue('21100000-0000-4000-8000-000000000002'), true, 'officer cannot operate another department');
select is(jsonb_array_length(gov_queue()), 2, 'queue is scoped by active posting, not token alone');
select lives_ok($$select gov_start_issue('CIV-21001')$$, 'valid transition succeeds');
select is((select status::text from issues where public_id = 'CIV-21001'), 'IN_PROGRESS', 'transition persisted');
select throws_ok($$select gov_start_issue('CIV-21003')$$, '22023', 'only onboarded issues can enter government work', 'non-onboarded issue cannot acquire operational state');
select lives_ok($$select gov_post_public_reply('CIV-21001', 'A crew is attending this issue.')$$, 'official public reply succeeds in scope');
select ok((select is_official and visibility = 'PUBLIC' from comments where issue_id = '21100000-0000-4000-8000-000000000001'), 'reply is public and official');
select lives_ok($$select gov_submit_resolution('CIV-21001', 'The damaged section was repaired.', 'Citizens may inspect the repair.', null)$$, 'resolution opens community verification');
select is((select status::text from issues where public_id = 'CIV-21001'), 'AWAITING_VERIFICATION', 'resolution opens verification instead of declaring success');
select is((gov_issue_detail('CIV-21003') ->> 'owner'), null, 'non-onboarded detail has no fabricated owner');
select is((gov_issue_detail('CIV-21003') ->> 'sla_due_at'), null, 'non-onboarded detail has no fabricated SLA');

reset role;
update government_officers set is_active = false
 where user_id = '21000000-0000-4000-8000-000000000001';
select is(custom_access_token('{"user_id":"21000000-0000-4000-8000-000000000001","claims":{"app_role":"GOVERNMENT","dept_id":21001}}') #>> '{claims,app_role}', 'CITIZEN', 'inactive posting removes government claim');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"GOVERNMENT","dept_id":21001,"juris_id":21001,"juris_lvl":"ZONE"}', true);
select set_config('request.jwt.claim.sub', '21000000-0000-4000-8000-000000000001', true);
select isnt(gov_can_operate_issue('21100000-0000-4000-8000-000000000003'), true, 'stale government claims cannot operate after posting deactivation');

select * from finish();
rollback;
