-- 0020_taxonomy_and_sla_baseline.sql
-- Canonical jurisdiction-generic taxonomy from data/departments/taxonomy.json.
-- This enables intake proposals without inventing a concrete authority.

insert into authority_types (id, description, level) values
  ('ULB_ENGINEERING', 'ULB civil engineering wing', 'ULB'),
  ('ULB_SANITATION', 'ULB solid waste and sanitation wing', 'ULB'),
  ('ULB_ELECTRICAL', 'ULB street lighting section', 'ULB'),
  ('ULB_HEALTH', 'ULB public health department', 'ULB'),
  ('ULB_HORTICULTURE', 'ULB parks and trees department', 'ULB'),
  ('ULB_TOWN_PLANNING', 'ULB town planning enforcement wing', 'ULB'),
  ('ULB_ANIMAL_HUSBANDRY', 'ULB stray animal control wing', 'ULB'),
  ('STATE_WATER_BOARD', 'State or city water and sewerage board', 'STATE'),
  ('STATE_PHED', 'State Public Health Engineering Department', 'STATE'),
  ('STATE_DISCOM', 'State electricity distribution company', 'STATE'),
  ('STATE_PWD', 'State Public Works Department', 'STATE'),
  ('NHAI', 'National Highways Authority of India', 'STATE'),
  ('TRAFFIC_POLICE', 'City or state traffic police', 'ULB'),
  ('STATE_FIRE', 'State Fire and Emergency Services', 'STATE'),
  ('REVENUE_DEPT', 'District Collector or Revenue Department', 'DISTRICT')
on conflict (id) do update set
  description = excluded.description,
  level = excluded.level;

insert into categories (id, label, is_sensitive, cluster_radius_m, default_severity, sort_order) values
  ('pothole_road_damage', 'Pothole / Road Damage', false, 100, 'MEDIUM', 10),
  ('streetlight', 'Streetlight Not Working', false, 150, 'MEDIUM', 20),
  ('garbage_swm', 'Garbage / Solid Waste', false, 200, 'MEDIUM', 30),
  ('water_supply', 'Water Supply', false, 1000, 'HIGH', 40),
  ('sewerage_drainage', 'Sewerage / Drainage / Waterlogging', false, 500, 'HIGH', 50),
  ('power_outage', 'Electricity Outage / Fault', false, 1000, 'HIGH', 60),
  ('traffic_signal_signage', 'Traffic Signal / Signage', false, 200, 'HIGH', 70),
  ('encroachment', 'Encroachment on Public Land', false, 300, 'MEDIUM', 80),
  ('stray_animals', 'Stray Animals', false, 500, 'MEDIUM', 90),
  ('parks_trees', 'Parks / Fallen Trees / Green Cover', false, 300, 'MEDIUM', 100),
  ('illegal_construction', 'Illegal / Unauthorized Construction', false, 300, 'MEDIUM', 110),
  ('public_health_sanitation', 'Public Health / Sanitation', false, 500, 'HIGH', 120),
  ('fire_hazard', 'Fire Hazard', true, 500, 'CRITICAL', 130)
on conflict (id) do update set
  label = excluded.label,
  is_sensitive = excluded.is_sensitive,
  cluster_radius_m = excluded.cluster_radius_m,
  default_severity = excluded.default_severity,
  sort_order = excluded.sort_order,
  is_active = true;

insert into category_authority_rules (category_id, seq, authority_type, condition) values
  ('pothole_road_damage', 0, 'ULB_ENGINEERING', 'within municipal boundary'),
  ('pothole_road_damage', 1, 'STATE_PWD', 'state highway outside municipal limits'),
  ('pothole_road_damage', 2, 'NHAI', 'national highway'),
  ('streetlight', 0, 'ULB_ELECTRICAL', null),
  ('garbage_swm', 0, 'ULB_SANITATION', null),
  ('water_supply', 0, 'STATE_WATER_BOARD', 'dedicated water board exists'),
  ('water_supply', 1, 'STATE_PHED', 'no dedicated water board'),
  ('sewerage_drainage', 0, 'STATE_WATER_BOARD', 'dedicated water board exists'),
  ('sewerage_drainage', 1, 'ULB_ENGINEERING', 'storm-water drainage'),
  ('power_outage', 0, 'STATE_DISCOM', null),
  ('traffic_signal_signage', 0, 'TRAFFIC_POLICE', null),
  ('traffic_signal_signage', 1, 'ULB_ENGINEERING', null),
  ('encroachment', 0, 'ULB_TOWN_PLANNING', null),
  ('encroachment', 1, 'REVENUE_DEPT', null),
  ('stray_animals', 0, 'ULB_ANIMAL_HUSBANDRY', null),
  ('parks_trees', 0, 'ULB_HORTICULTURE', null),
  ('illegal_construction', 0, 'ULB_TOWN_PLANNING', null),
  ('public_health_sanitation', 0, 'ULB_HEALTH', null),
  ('fire_hazard', 0, 'STATE_FIRE', null)
on conflict (category_id, seq) do update set
  authority_type = excluded.authority_type,
  condition = excluded.condition;

-- Acknowledgement and resolution are separate promises in the product. The
-- initial schema retained only the resolution deadline.
alter table issues add column sla_ack_due_at timestamptz;

create index issues_sla_ack_due_idx on issues (sla_ack_due_at)
  where sla_ack_due_at is not null and acknowledged_at is null;

create or replace function set_sla_due_at()
returns trigger language plpgsql as $$
declare
  v_ack interval;
  v_resolve interval;
  v_base timestamptz;
begin
  if new.routing_tier <> 'ONBOARDED' then
    new.sla_ack_due_at := null;
    new.sla_due_at := null;
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_base := coalesce(new.created_at, now());
  elsif old.routing_tier <> 'ONBOARDED' or new.department_id is distinct from old.department_id then
    v_base := now();
  elsif new.priority is distinct from old.priority then
    v_base := old.created_at;
  else
    return new;
  end if;

  select s.ack_interval, s.resolve_interval into v_ack, v_resolve
    from sla_targets(new.priority, new.department_id) s;
  new.sla_ack_due_at := v_base + v_ack;
  new.sla_due_at := v_base + v_resolve;
  return new;
end;
$$;

-- Existing RLS policies continue to govern the row; grants make the new column
-- readable wherever the issue itself is readable.
grant select (sla_ack_due_at) on issues to anon, authenticated;
