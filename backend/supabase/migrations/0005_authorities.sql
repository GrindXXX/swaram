-- 0005_authorities.sql
-- The authority registry: who is actually reachable, and how well we trust it.
-- Loaded by backend/scripts/04_load_authorities.ts from the four scraped CSVs.
--
-- Reality check (technical-plan.html S01): jurisdiction coverage is national
-- (4,814 ULBs) but reachable named contacts total ~380, and they are ministry-
-- and state-level. Most of India resolves to no authority at all. That is an
-- expected outcome, not an error -- see routing_tier.

create table organisations (
  id         bigserial primary key,
  name       text not null,
  type       text,                    -- 'CONTRACTOR', 'AGENCY', 'PSU'
  contact_email text,
  phone      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table departments (
  id              bigserial primary key,
  name            text not null,
  slug            text unique not null,
  authority_type  text references authority_types(id),
  jurisdiction_id bigint references jurisdictions(id),
  description     text,
  -- Per-department SLA overrides, e.g. {"HIGH": {"ack_hours":2,"resolve_days":2}}
  sla_overrides   jsonb,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (jurisdiction_id, slug)
);

create index departments_jurisdiction_idx on departments (jurisdiction_id);
create index departments_authority_type_idx on departments (authority_type);

create table authorities (
  id                  bigserial primary key,
  name                text not null,
  authority_type      text references authority_types(id),
  jurisdiction_id     bigint references jurisdictions(id),
  department_id       bigint references departments(id),
  level               jurisdiction_level,

  -- First-contact officer (CPGRAMS "nodal")
  officer_name        text,
  grievance_email     text,
  phone               text,

  -- Second rung. The scraped data already contains a real escalation ladder
  -- (88 appellate officers); reuse it rather than inventing one.
  appellate_name      text,
  appellate_email     text,

  official_handles    jsonb,          -- stored, but V1 never auto-posts

  verification_status verification_status not null default 'DRAFT',
  source              text not null,  -- which CSV / URL this row came from
  source_url          text,
  last_verified_at    timestamptz,

  -- A bounced or ignored address is worse than no address. Three bounces
  -- downgrade the row out of VERIFIED (trigger in 0015).
  bounce_count        int not null default 0,
  last_bounce_at      timestamptz,

  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index authorities_jurisdiction_idx on authorities (jurisdiction_id);
create index authorities_type_idx on authorities (authority_type);
create index authorities_verified_idx on authorities (verification_status)
  where verification_status = 'VERIFIED';

comment on column authorities.verification_status is
  'Only VERIFIED rows may be emailed automatically. state_agencies.csv ships '
  'with 0 of 36 verified and two column-shifted rows (KARNATAKA, TELANGANA), so '
  'water and electricity must not auto-route until D3 completes.';

-- Resolve (lat, lng, category) -> authority, with the routing tier.
-- This is the join the intake pipeline calls. No model participates.
create or replace function resolve_authority(
  p_lat      double precision,
  p_lng      double precision,
  p_category text
) returns table (
  jurisdiction_id bigint,
  authority_id    bigint,
  department_id   bigint,
  tier            routing_tier,
  method          jurisdiction_match_method
) language plpgsql stable as $$
declare
  v_jur    bigint;
  v_method jurisdiction_match_method;
begin
  select r.jurisdiction_id, r.method into v_jur, v_method
    from resolve_jurisdiction(p_lat, p_lng) r;

  if v_jur is null then
    return query select null::bigint, null::bigint, null::bigint,
                        'UNMAPPED'::routing_tier, v_method;
    return;
  end if;

  -- Walk the category's resolution_order against this jurisdiction AND its
  -- ancestors: a ward-level pin should still find a city-level water board.
  return query
  with scope as (
    select v_jur as id
    union all
    select a.id from jurisdiction_ancestors(v_jur) a
  ),
  candidate as (
    select a.id as auth_id, a.department_id as dept_id, r.seq,
           a.verification_status, a.grievance_email
    from category_authority_rules r
    join authorities a
      on a.authority_type = r.authority_type
     and a.jurisdiction_id in (select id from scope)
     and a.is_active
    where r.category_id = p_category
    order by r.seq
    limit 1
  )
  select v_jur,
         c.auth_id,
         c.dept_id,
         case
           when exists (
             select 1 from government_officers o
             where o.department_id = c.dept_id
               and o.jurisdiction_id in (select id from scope)
               and o.is_active
           ) then 'ONBOARDED'::routing_tier
           when c.grievance_email is not null
            and c.verification_status = 'VERIFIED'
             then 'CONTACTABLE'::routing_tier
           else 'UNMAPPED'::routing_tier
         end,
         v_method
  from candidate c
  -- No candidate at all is still a valid answer: jurisdiction known, nobody to send it to.
  union all
  select v_jur, null::bigint, null::bigint, 'UNMAPPED'::routing_tier, v_method
  where not exists (select 1 from candidate)
  limit 1;
end $$;
