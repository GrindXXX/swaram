begin;

select plan(14);

insert into issues (id, public_id, title, description, location, visibility, published_at)
values
  ('92220000-0000-4000-8000-000000000001', 'CIV-92220', 'Restricted test',
   'Private business and resident details',
   ST_SetSRID(ST_Point(77.6408, 12.9784), 4326)::geography,
   'RESTRICTED', now()),
  ('92220000-0000-4000-8000-000000000002', 'CIV-92221', 'Confidential test',
   'Invisible confidential details',
   ST_SetSRID(ST_Point(77.6408, 12.9784), 4326)::geography,
   'CONFIDENTIAL', null);

select ok(
  has_column_privilege('anon', 'public.issues', 'title', 'select'),
  'anonymous users may read safe issue metadata'
);
select ok(
  not has_column_privilege('anon', 'public.issues', 'location', 'select'),
  'anonymous users cannot select exact issue coordinates'
);
select ok(
  not has_column_privilege('anon', 'public.issues', 'address', 'select'),
  'anonymous users cannot select reverse-geocoded addresses'
);
select ok(
  not has_column_privilege('authenticated', 'public.issues', 'location', 'select'),
  'authenticated browser users cannot bypass location privacy'
);
select ok(
  not has_column_privilege('anon', 'public.reports', 'location', 'select'),
  'anonymous users cannot select exact report coordinates'
);
select ok(
  not has_column_privilege('authenticated', 'public.reports', 'description', 'select'),
  'browser users cannot bypass redaction by selecting raw report text'
);
select ok(
  not has_column_privilege('anon', 'public.issue_evidence', 'location', 'select'),
  'anonymous users cannot select evidence coordinates'
);
select ok(
  not has_column_privilege('anon', 'public.issues', 'created_by', 'select'),
  'anonymous users cannot identify the issue creator UUID'
);
select ok(
  not has_column_privilege('anon', 'public.reports', 'user_id', 'select'),
  'anonymous users cannot identify report author UUIDs'
);
select ok(
  not has_column_privilege('anon', 'public.issue_evidence', 'uploaded_by', 'select'),
  'anonymous users cannot identify evidence uploader UUIDs'
);
select ok(
  not has_column_privilege('anon', 'public.issues', 'description', 'select'),
  'anonymous users cannot bypass restricted redaction with direct description reads'
);
select ok(
  has_function_privilege('anon', 'public.citizen_issue_descriptions(uuid[])', 'EXECUTE'),
  'anonymous users receive issue narratives only through the visibility-aware projection'
);

set local role anon;
select is(
  (select description from citizen_issue_descriptions(array['92220000-0000-4000-8000-000000000001'::uuid])),
  null::text,
  'restricted descriptions are redacted for anonymous readers'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","app_role":"CITIZEN"}',
  true
);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is(
  (select count(*)::int from citizen_issue_state('CIV-92221')),
  0,
  'citizen state lookup does not reveal confidential issue identifiers'
);

select * from finish();
rollback;
