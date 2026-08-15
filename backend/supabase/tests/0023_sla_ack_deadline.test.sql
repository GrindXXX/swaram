begin;

select plan(4);

insert into issues (
  id, public_id, title, location, priority, routing_tier,
  jurisdiction_id, department_id, created_at
) values (
  '93000000-0000-4000-8000-000000000001', 'CIV-93000', 'SLA test',
  ST_SetSRID(ST_Point(77.6408, 12.9784), 4326)::geography,
  'HIGH', 'ONBOARDED', 102, 201, '2026-08-15 00:00:00+00'
);

select is(
  (select sla_ack_due_at from issues where public_id = 'CIV-93000'),
  '2026-08-15 02:00:00+00'::timestamptz,
  'department acknowledgement override is persisted'
);
select is(
  (select sla_due_at from issues where public_id = 'CIV-93000'),
  '2026-08-17 00:00:00+00'::timestamptz,
  'department resolution override is persisted'
);

update issues set routing_tier = 'CONTACTABLE' where public_id = 'CIV-93000';
select is(
  (select sla_ack_due_at from issues where public_id = 'CIV-93000'),
  null::timestamptz,
  'acknowledgement clock clears outside Tier 1'
);
select is(
  (select sla_due_at from issues where public_id = 'CIV-93000'),
  null::timestamptz,
  'resolution clock clears outside Tier 1'
);

select * from finish();
rollback;
