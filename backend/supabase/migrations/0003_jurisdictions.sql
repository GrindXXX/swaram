-- 0003_jurisdictions.sql
-- The geography spine. Every routing decision starts here.
--
-- WARNING: the repo ships NO boundary geometry (see technical-plan.html S01).
-- `geometry` is nullable so LGD names/codes can load first, but until polygons
-- are ingested by backend/scripts/02_load_boundaries.ts, resolve_jurisdiction()
-- will fall through to centroid/geocode matching for every request.

create table jurisdictions (
  id          bigserial primary key,
  lgd_code    text unique,                    -- joins data/departments/ulb_directory.csv
  name        text not null,
  name_local  text,
  level       jurisdiction_level not null,
  parent_id   bigint references jurisdictions(id) on delete restrict,

  state_code  int,                            -- LGD state code
  district_code int,
  body_type   text,                           -- 'Municipal Corporation', 'Town Panchayat', ...

  geometry    geometry(MultiPolygon, 4326),   -- null until D1 lands
  centroid    geometry(Point, 4326),

  source      text not null,                  -- provenance is mandatory
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column jurisdictions.geometry is
  'Null means this jurisdiction cannot be matched by point-in-polygon. Routing '
  'falls back to centroid distance, then geocode+name match, then UNMAPPED.';

create index jurisdictions_geom_idx     on jurisdictions using gist (geometry);
create index jurisdictions_centroid_idx on jurisdictions using gist (centroid);
create index jurisdictions_level_idx    on jurisdictions (level);
create index jurisdictions_parent_idx   on jurisdictions (parent_id);
create index jurisdictions_name_trgm    on jurisdictions using gin (name gin_trgm_ops);

-- Ancestors of a jurisdiction, nearest first. Used for scale escalation and
-- for "which state does this ward belong to".
create or replace function jurisdiction_ancestors(p_id bigint)
returns table (id bigint, name text, level jurisdiction_level, depth int)
language sql stable as $$
  with recursive up as (
    select j.id, j.name, j.level, j.parent_id, 0 as depth
      from jurisdictions j where j.id = p_id
    union all
    select j.id, j.name, j.level, j.parent_id, up.depth + 1
      from jurisdictions j join up on j.id = up.parent_id
  )
  select id, name, level, depth from up where depth > 0 order by depth;
$$;

-- Descendants, including self. This is what makes a supervisor's RLS policy
-- work: a zone-level officer sees every ward beneath them.
create or replace function jurisdiction_descendants(p_id bigint)
returns table (id bigint)
language sql stable as $$
  with recursive down as (
    select j.id from jurisdictions j where j.id = p_id
    union all
    select j.id from jurisdictions j join down on j.parent_id = down.id
  )
  select id from down;
$$;

-- Resolve a pin to the most specific jurisdiction available.
-- Returns the match method so callers can distinguish a real polygon hit from
-- a degraded guess. NEVER let a fallback masquerade as a polygon match.
create or replace function resolve_jurisdiction(
  p_lat double precision,
  p_lng double precision
) returns table (jurisdiction_id bigint, method jurisdiction_match_method)
language plpgsql stable as $$
declare
  v_pt  geometry := ST_SetSRID(ST_Point(p_lng, p_lat), 4326);
  v_id  bigint;
begin
  -- 1. most specific containing polygon
  select j.id into v_id
  from jurisdictions j
  where j.geometry is not null
    and ST_Contains(j.geometry, v_pt)
  order by case j.level
             when 'WARD' then 1 when 'ZONE' then 2 when 'ULB' then 3
             when 'DISTRICT' then 4 else 5 end
  limit 1;

  if v_id is not null then
    return query select v_id, 'POLYGON'::jurisdiction_match_method;
    return;
  end if;

  -- 2. nearest district centroid within 25 km
  select j.id into v_id
  from jurisdictions j
  where j.level = 'DISTRICT' and j.centroid is not null
    and ST_DWithin(j.centroid::geography, v_pt::geography, 25000)
  order by j.centroid <-> v_pt
  limit 1;

  if v_id is not null then
    return query select v_id, 'CENTROID_FALLBACK'::jurisdiction_match_method;
    return;
  end if;

  -- 3. caller may still attempt a reverse-geocode + name match (GEOCODE_FALLBACK)
  --    in application code; from SQL alone we are out of options.
  return query select null::bigint, 'NONE'::jurisdiction_match_method;
end $$;
