-- Deterministic local demo data. Jurisdiction polygons are intentionally absent;
-- all seeded routing provenance is the resolver's honest centroid fallback.

select set_config('request.jwt.claims', '{"app_role":"ADMIN"}', false);

insert into jurisdictions (
  id, lgd_code, name, name_local, level, parent_id, state_code, district_code,
  body_type, geometry, centroid, source, created_at, updated_at
) values
  (101, '29', 'Karnataka', 'Karnataka', 'STATE', null, 29, null,
   'State', null, ST_SetSRID(ST_Point(77.5946, 12.9716), 4326),
   'local-demo-seed', '2026-08-01 09:00:00+00', '2026-08-01 09:00:00+00'),
  (102, '572', 'Bengaluru Urban', 'Bengaluru Nagara', 'DISTRICT', 101, 29, 572,
   'District', null, ST_SetSRID(ST_Point(77.5946, 12.9716), 4326),
   'local-demo-seed', '2026-08-01 09:00:00+00', '2026-08-01 09:00:00+00'),
  (103, '276600', 'Bengaluru Civic Corporation', 'Bengaluru Mahanagara Palike', 'ULB', 102, 29, 572,
   'Municipal Corporation', null, ST_SetSRID(ST_Point(77.5946, 12.9716), 4326),
   'local-demo-seed', '2026-08-01 09:00:00+00', '2026-08-01 09:00:00+00'),
  (104, 'BLR-EAST', 'East Zone', 'Purva Valaya', 'ZONE', 103, 29, 572,
   'Municipal Zone', null, ST_SetSRID(ST_Point(77.6408, 12.9784), 4326),
   'local-demo-seed', '2026-08-01 09:00:00+00', '2026-08-01 09:00:00+00'),
  (105, 'BLR-IND-100', 'Indiranagar Ward', 'Indiranagara Ward', 'WARD', 104, 29, 572,
   'Municipal Ward', null, ST_SetSRID(ST_Point(77.6408, 12.9784), 4326),
   'local-demo-seed', '2026-08-01 09:00:00+00', '2026-08-01 09:00:00+00');

insert into authority_types (id, description, level) values
  ('ULB_ENGINEERING', 'Municipal roads and civil works', 'ULB'),
  ('ULB_SANITATION', 'Municipal solid waste and sanitation', 'ULB'),
  ('ULB_ELECTRICAL', 'Municipal street lighting', 'ULB'),
  ('STATE_WATER_BOARD', 'State urban water utility', 'DISTRICT');

insert into categories (
  id, label, is_sensitive, cluster_radius_m, default_severity, sort_order, is_active
) values
  ('pothole_road_damage', 'Pothole or road damage', false, 80, 'MEDIUM', 10, true),
  ('garbage_waste', 'Garbage or waste', false, 150, 'MEDIUM', 20, true),
  ('streetlight_not_working', 'Streetlight not working', false, 100, 'LOW', 30, true),
  ('water_leak_supply', 'Water leak or supply', false, 250, 'HIGH', 40, true),
  ('other_civic', 'Other civic issue', false, 150, 'MEDIUM', 90, true),
  ('personal_safety', 'Personal safety concern', true, 500, 'HIGH', 100, true);

insert into category_authority_rules (category_id, seq, authority_type, condition) values
  ('pothole_road_damage', 0, 'ULB_ENGINEERING', null),
  ('garbage_waste', 0, 'ULB_SANITATION', null),
  ('streetlight_not_working', 0, 'ULB_ELECTRICAL', null),
  ('water_leak_supply', 0, 'STATE_WATER_BOARD', null),
  ('other_civic', 0, 'ULB_ENGINEERING', 'local demo triage fallback');

insert into departments (
  id, name, slug, authority_type, jurisdiction_id, description, sla_overrides, is_active, created_at
) values
  (201, 'Civic Works Department', 'blr-civic-works', 'ULB_ENGINEERING', 102,
   'Local demo roads and civil works queue.',
   '{"HIGH":{"ack_hours":2,"resolve_days":2}}'::jsonb, true, '2026-08-01 09:00:00+00'),
  (202, 'Solid Waste Department', 'blr-solid-waste', 'ULB_SANITATION', 102,
   'Local demo sanitation queue.', null, true, '2026-08-01 09:00:00+00'),
  (203, 'Street Lighting Department', 'blr-street-lighting', 'ULB_ELECTRICAL', 102,
   'Local demo street-lighting queue.', null, true, '2026-08-01 09:00:00+00'),
  (204, 'Water Services', 'blr-water-services', 'STATE_WATER_BOARD', 102,
   'Intentionally unverified local demo authority.', null, true, '2026-08-01 09:00:00+00');

insert into authorities (
  id, name, authority_type, jurisdiction_id, department_id, level, officer_name,
  grievance_email, verification_status, source, source_url, last_verified_at,
  is_active, created_at, updated_at
) values
  (301, 'Bengaluru Civic Works Authority', 'ULB_ENGINEERING', 102, 201, 'DISTRICT',
   'Demo Nodal Engineer', 'works.demo@example.gov.in', 'VERIFIED', 'local-demo-seed',
   'https://example.gov.in/local-demo', '2026-08-01 09:00:00+00', true,
   '2026-08-01 09:00:00+00', '2026-08-01 09:00:00+00'),
  (302, 'Bengaluru Solid Waste Authority', 'ULB_SANITATION', 102, 202, 'DISTRICT',
   'Demo Sanitation Nodal Officer', 'waste.demo@example.gov.in', 'VERIFIED', 'local-demo-seed',
   'https://example.gov.in/local-demo', '2026-08-01 09:00:00+00', true,
   '2026-08-01 09:00:00+00', '2026-08-01 09:00:00+00'),
  (303, 'Bengaluru Street Lighting Authority', 'ULB_ELECTRICAL', 102, 203, 'DISTRICT',
   'Demo Lighting Nodal Officer', 'lights.demo@example.gov.in', 'VERIFIED', 'local-demo-seed',
   'https://example.gov.in/local-demo', '2026-08-01 09:00:00+00', true,
   '2026-08-01 09:00:00+00', '2026-08-01 09:00:00+00'),
  (304, 'Bengaluru Water Services (unverified demo)', 'STATE_WATER_BOARD', 102, 204, 'DISTRICT',
   null, 'unverified.demo@example.invalid', 'DRAFT', 'local-demo-seed', null, null, true,
   '2026-08-01 09:00:00+00', '2026-08-01 09:00:00+00');

-- Fixed auth IDs make issue authorship and officer scope stable after every reset.
--
-- GoTrue scans these token columns into Go strings, which cannot hold NULL:
-- leaving them unset makes every sign-in for a seeded account fail with
-- 500 "Database error finding user" (Scan error ... converting NULL to string).
-- Real signups get '' from GoTrue itself, so this only ever bites seeded users
-- — which is exactly the officer account the whole /gov surface depends on.
-- They are set explicitly below; do not drop them from this insert.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone_change, phone_change_token,
  reauthentication_token
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'asha.demo@example.com', '', '2026-08-01 09:00:00+00',
   '{"provider":"email","providers":["email"]}', '{"name":"Asha"}',
   '2026-08-01 09:00:00+00', '2026-08-01 09:00:00+00',
   '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'ravi.demo@example.com', '', '2026-08-01 09:00:00+00',
   '{"provider":"email","providers":["email"]}', '{"name":"Ravi"}',
   '2026-08-01 09:00:00+00', '2026-08-01 09:00:00+00',
   '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'officer.demo@example.gov.in', '', '2026-08-01 09:00:00+00',
   '{"provider":"email","providers":["email"]}', '{"name":"Officer Kiran"}',
   '2026-08-01 09:00:00+00', '2026-08-01 09:00:00+00',
   '', '', '', '', '', '', '', '');

update users
   set role = 'GOVERNMENT', home_jurisdiction_id = 102, full_name = 'Kiran Rao'
 where id = '10000000-0000-0000-0000-000000000003';
update users
   set home_jurisdiction_id = 102
 where id in ('10000000-0000-0000-0000-000000000001',
              '10000000-0000-0000-0000-000000000002');

insert into officer_roster_records (
  id, source_batch_id, name, designation, department_ref, jurisdiction_ref,
  department_id, jurisdiction_id, jurisdiction_lvl, email, employee_ref,
  match_status, matched_user_id, confirmed_at, source_url, created_at
) values (
  401, 'local-demo-2026-08', 'Kiran Rao', 'Assistant Executive Engineer',
  'Civic Works Department', 'Bengaluru Urban', 201, 102, 'DISTRICT',
  'officer.demo@example.gov.in', 'DEMO-AEE-001', 'CONFIRMED',
  '10000000-0000-0000-0000-000000000003', '2026-08-01 09:30:00+00',
  'https://example.gov.in/local-demo-roster', '2026-08-01 09:00:00+00'
);

insert into government_officers (
  id, user_id, department_id, jurisdiction_id, jurisdiction_level, designation,
  employee_ref, roster_record_id, confirmed_at, last_attested_at, max_workload,
  is_active, created_at
) values (
  501, '10000000-0000-0000-0000-000000000003', 201, 102, 'DISTRICT',
  'Assistant Executive Engineer', 'DEMO-AEE-001', 401,
  '2026-08-01 09:30:00+00', '2026-08-01 09:30:00+00', 50, true,
  '2026-08-01 09:30:00+00'
);

insert into issues (
  id, public_id, title, description, category_id, location, address,
  location_precision, location_visibility, visibility, severity, priority,
  civic_pressure, estimated_people_affected, routing_tier, jurisdiction_id,
  jurisdiction_match_method, authority_id, department_id, owner_officer_id,
  status, moderation_verdict, published_at, sla_due_at, acknowledged_at,
  resolved_at, satisfaction_score, created_by, created_at, updated_at
) values
  ('20000000-0000-0000-0000-000000000001', 'CIV-10000',
   'Deep pothole near 12th Main',
   'A deep pothole is slowing traffic near the 12th Main junction.',
   'pothole_road_damage', ST_SetSRID(ST_Point(77.6412, 12.9788), 4326)::geography,
   '12th Main, Indiranagar', 'POINT', 'APPROXIMATE', 'PUBLIC', 'HIGH', 'HIGH',
   64.50, 320, 'ONBOARDED', 102, 'CENTROID_FALLBACK', 301, 201, 501,
   'ASSIGNED', 'CLEAR', '2026-08-10 08:05:00+00', '2026-08-12 08:00:00+00', null,
   null, null, '10000000-0000-0000-0000-000000000001',
   '2026-08-10 08:00:00+00', '2026-08-14 10:00:00+00'),
  ('20000000-0000-0000-0000-000000000002', 'CIV-10001',
   'Garbage collection missed on Cross Road',
   'Waste has remained at the collection point for three days.',
   'garbage_waste', ST_SetSRID(ST_Point(77.6380, 12.9758), 4326)::geography,
   '6th Cross, Indiranagar', 'POINT', 'APPROXIMATE', 'PUBLIC', 'MEDIUM', 'MEDIUM',
   42.25, 90, 'CONTACTABLE', 102, 'CENTROID_FALLBACK', 302, 202, null,
   'OPEN', 'CLEAR', '2026-08-12 07:35:00+00', null, null, null, null,
   '10000000-0000-0000-0000-000000000002',
   '2026-08-12 07:30:00+00', '2026-08-12 07:35:00+00'),
  ('20000000-0000-0000-0000-000000000003', 'CIV-10002',
   'Streetlights dark beside the bus stop',
   'Two streetlights beside the evening bus stop are not working.',
   'streetlight_not_working', ST_SetSRID(ST_Point(77.6450, 12.9810), 4326)::geography,
   'CMH Road bus stop, Indiranagar', 'POINT', 'APPROXIMATE', 'PUBLIC', 'MEDIUM', 'MEDIUM',
   51.75, 180, 'CONTACTABLE', 102, 'CENTROID_FALLBACK', 303, 203, null,
   'ACKNOWLEDGED', 'CLEAR', '2026-08-11 18:20:00+00', null,
   '2026-08-12 06:45:00+00', null, null,
   '10000000-0000-0000-0000-000000000001',
   '2026-08-11 18:15:00+00', '2026-08-12 06:45:00+00'),
  ('20000000-0000-0000-0000-000000000004', 'CIV-10003',
   'Footpath slab repaired near the park',
   'The broken footpath slab was replaced and the walking path is usable again.',
   'other_civic', ST_SetSRID(ST_Point(77.6425, 12.9765), 4326)::geography,
   'Defence Colony Park, Indiranagar', 'POINT', 'APPROXIMATE', 'PUBLIC', 'LOW', 'LOW',
   18.00, 45, 'ONBOARDED', 102, 'CENTROID_FALLBACK', 301, 201, 501,
   'RESOLVED', 'CLEAR', '2026-08-06 09:05:00+00', '2026-08-20 09:00:00+00',
   '2026-08-06 12:00:00+00', '2026-08-13 15:00:00+00', 80.00,
   '10000000-0000-0000-0000-000000000002',
   '2026-08-06 09:00:00+00', '2026-08-13 15:00:00+00');

insert into reports (
  id, issue_id, user_id, client_report_id, description, media_type, location,
  is_anonymous, source, created_at
) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', null,
   'The pothole is difficult to see after rain.', 'NONE',
   ST_SetSRID(ST_Point(77.6412, 12.9788), 4326)::geography, false, 'IMPORT',
   '2026-08-10 08:00:00+00'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000002', null,
   'I also encounter this pothole on my commute.', 'NONE',
   ST_SetSRID(ST_Point(77.6411, 12.9787), 4326)::geography, true, 'IMPORT',
   '2026-08-11 08:20:00+00'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000002', null,
   'The regular collection did not happen this week.', 'NONE',
   ST_SetSRID(ST_Point(77.6380, 12.9758), 4326)::geography, false, 'IMPORT',
   '2026-08-12 07:30:00+00'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000001', null,
   'The bus stop area is very dark after sunset.', 'NONE',
   ST_SetSRID(ST_Point(77.6450, 12.9810), 4326)::geography, true, 'IMPORT',
   '2026-08-11 18:15:00+00'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000004',
   '10000000-0000-0000-0000-000000000002', null,
   'The slab was broken and created a trip hazard.', 'NONE',
   ST_SetSRID(ST_Point(77.6425, 12.9765), 4326)::geography, false, 'IMPORT',
   '2026-08-06 09:00:00+00');

insert into issue_history (
  id, issue_id, actor_id, actor_type, action, old_value, new_value, metadata, created_at
) values
  (601, '20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000003', 'OFFICER', 'OWNER_ACCEPTED', null,
   'Assistant Executive Engineer', '{"note":"Road inspection scheduled"}',
   '2026-08-10 10:00:00+00'),
  (602, '20000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000003', 'OFFICER', 'STATUS_CHANGED', 'OPEN',
   'ACKNOWLEDGED', '{"note":"Lighting crew notified"}', '2026-08-12 06:45:00+00'),
  (603, '20000000-0000-0000-0000-000000000004', null, 'SYSTEM', 'STATUS_CHANGED',
   'AWAITING_VERIFICATION', 'RESOLVED', '{"community_verification":"4 of 5 completely fixed"}',
   '2026-08-13 15:00:00+00');

insert into agent_runs (
  id, agent_name, issue_id, report_id, input, output, confidence, model,
  prompt_version, latency_ms, status, created_at
) values
  (701, 'intake', '20000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001',
   '{"mode":"seeded-local-demo","text":"The pothole is difficult to see after rain."}',
   '{"category_id":"pothole_road_damage","routing":{"method":"CENTROID_FALLBACK","tier":"ONBOARDED"},"fallback":true}',
   0.920, 'deterministic-local-fallback-v1', 'local-fallback-v1', 2, 'SUCCESS',
   '2026-08-10 08:05:00+00');

select setval(pg_get_serial_sequence('jurisdictions', 'id'), 105, true);
select setval(pg_get_serial_sequence('departments', 'id'), 204, true);
select setval(pg_get_serial_sequence('authorities', 'id'), 304, true);
select setval(pg_get_serial_sequence('officer_roster_records', 'id'), 401, true);
select setval(pg_get_serial_sequence('government_officers', 'id'), 501, true);
select setval(pg_get_serial_sequence('issue_history', 'id'), 603, true);
select setval(pg_get_serial_sequence('agent_runs', 'id'), 701, true);
select setval('issue_public_id_seq', 10003, true);
select set_config('request.jwt.claims', '', false);
