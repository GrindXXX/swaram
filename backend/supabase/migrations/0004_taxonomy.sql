-- 0004_taxonomy.sql
-- Loaded from data/departments/taxonomy.json by backend/scripts/03_load_taxonomy.ts.
--
-- The key design property, which came from the data team and is correct:
-- the intake agent emits a CATEGORY, never a department. Category x
-- jurisdiction resolves to a concrete authority through these tables, so a
-- municipal reorganisation is a row change, not a prompt change.

-- The 15 jurisdiction-generic authority types from taxonomy.json._meta.
create table authority_types (
  id          text primary key,     -- 'ULB_ENGINEERING', 'STATE_DISCOM', ...
  description text not null,
  level       jurisdiction_level    -- the level this type normally sits at
);

create table categories (
  id            text primary key,   -- 'pothole_road_damage'
  label         text not null,
  -- Categories that must never be published to the public feed. The intake
  -- agent forces CONFIDENTIAL for these; a supervisor must actively downgrade.
  is_sensitive  boolean not null default false,
  -- Cluster candidate radius. A pothole is metres; a water outage is a street.
  -- This is a RETRIEVAL width, not a merge decision -- generous is safe.
  cluster_radius_m int not null default 100,
  default_severity issue_severity not null default 'MEDIUM',
  sort_order    int not null default 0,
  is_active     boolean not null default true
);

-- taxonomy.json resolution_order[], flattened. seq 0 is tried first.
-- Five categories carry multi-step chains (pothole -> ULB, then PWD, then NHAI).
create table category_authority_rules (
  category_id     text not null references categories(id) on delete cascade,
  seq             int  not null,
  authority_type  text not null references authority_types(id),
  condition       text,             -- 'on a national highway' (human-readable)
  primary key (category_id, seq)
);

create index category_authority_rules_type_idx
  on category_authority_rules (authority_type);

comment on column category_authority_rules.condition is
  'Documented but not machine-evaluated at V1. The resolver walks seq order and '
  'takes the first authority that actually exists for the jurisdiction. Encoding '
  'these conditions (is this point on a national highway?) needs road-network '
  'data we do not have.';
