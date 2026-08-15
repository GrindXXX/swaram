-- 0007_issues.sql
-- The core table. One row per real-world problem (PRD S03), never per report.
--
-- Two things in here are load-bearing and easy to get wrong later:
--   1. `published_at` is the ONLY publication gate (PRD S20). Creation, routing
--      and the SLA all happen regardless of the safety verdict; the gate decides
--      whether the row reaches the feed, nothing else.
--   2. `sla_due_at` is constrained to Tier 1. A department that never onboarded
--      cannot breach a promise it never made (PRD S12), and a fabricated
--      countdown is the fastest way to lose the citizen.

-- Human-facing identifier. CIV-10000 upwards -- five digits from day one so the
-- id never changes width, which matters because it is printed, shared on
-- WhatsApp and read aloud over the phone.
create sequence issue_public_id_seq start 10000;

create table issues (
  id            uuid primary key default gen_random_uuid(),
  -- No default here: generate_public_id() is defined in 0014 (it is grouped
  -- with the other domain functions) and the default is attached there.
  public_id     text not null unique,

  title         text,                 -- AI-generated, officer-editable (PRD S06)
  description   text,
  category_id   text references categories(id),
  subcategory   text,                 -- free text from intake; not a routing key

  -- Location is mandatory. Without it there is no jurisdiction, so no
  -- department, no officer and no accountability (PRD S03). What varies is
  -- precision and publicity, which are independent axes.
  location            geography(Point, 4326) not null,
  address             text,           -- reverse-geocoded, for display only
  location_precision  location_precision  not null default 'POINT',
  location_visibility location_visibility not null default 'EXACT',

  visibility    issue_visibility not null default 'PUBLIC',

  -- The three numbers PRD S06 forbids collapsing into one.
  severity      issue_severity not null default 'MEDIUM',   -- objective
  priority      issue_priority not null default 'MEDIUM',   -- drives SLA
  civic_pressure numeric(5,2) not null default 0
                 check (civic_pressure between 0 and 100),  -- social, 0-100
  estimated_people_affected int check (estimated_people_affected >= 0),

  escalation_level escalation_level not null default 'LOCAL',

  -- Routing. Tier is a fact about coverage, not about the issue's quality.
  routing_tier  routing_tier not null default 'UNMAPPED',
  jurisdiction_id bigint references jurisdictions(id),
  jurisdiction_match_method jurisdiction_match_method not null default 'NONE',
  authority_id  bigint references authorities(id),
  department_id bigint references departments(id),
  -- The single accountable person (PRD S10). Everyone else lives in
  -- issue_participants. Points at government_officers, not users: a person can
  -- hold several officer records and the accountable one is a specific posting.
  owner_officer_id bigint references government_officers(id),

  status        issue_status not null default 'OPEN',

  -- Safety gate (PRD S20). A null verdict means intake has not run yet.
  moderation_verdict    moderation_verdict,
  moderation_reviewed_by uuid references users(id),
  moderation_reviewed_at timestamptz,
  -- Null while HELD. This column, and only this column, decides feed presence.
  published_at  timestamptz,

  sla_due_at    timestamptz,
  acknowledged_at timestamptz,        -- SLA measures ack separately from resolve
  resolved_at   timestamptz,
  closed_at     timestamptz,

  -- Percentage answering "completely fixed" (PRD S03). Null until a
  -- verification window closes; 0 is a real and different answer.
  satisfaction_score numeric(5,2) check (satisfaction_score between 0 and 100),

  merged_into_id uuid references issues(id),
  rejection_reason text,

  -- Denormalised counters, maintained by trigger in 0015. Reading them is on
  -- every feed card; counting them live is not affordable.
  report_count   int not null default 0,
  follower_count int not null default 0,

  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- An issue cannot be its own duplicate.
  constraint issues_not_self_merged check (merged_into_id is distinct from id),
  -- MERGED without a survivor is a dangling redirect.
  constraint issues_merged_has_target
    check (status <> 'MERGED' or merged_into_id is not null),
  -- REJECTED always carries a reason the citizen can read (PRD S03).
  constraint issues_rejected_has_reason
    check (status <> 'REJECTED' or rejection_reason is not null),
  -- HELD means unpublished, by definition. Enforced here rather than trusted to
  -- the app, because the feed policy in 0016 tests both and they must agree.
  constraint issues_held_is_unpublished
    check (status <> 'HELD' or published_at is null),
  -- CONFIDENTIAL issues have no public URL at all (PRD S03).
  constraint issues_confidential_unpublished
    check (visibility <> 'CONFIDENTIAL' or published_at is null),
  -- PRD S12 / technical-plan S11 rule 2: only Tier 1 carries an SLA clock.
  constraint issues_sla_only_when_onboarded
    check (sla_due_at is null or routing_tier = 'ONBOARDED')
);

comment on column issues.published_at is
  'Null means not on the public feed. Set by the safety gate (CLEAR/REDACT) or '
  'by a human reviewer clearing a HOLD, or by the 24h auto-publish sweep in '
  '0019 -- an unreviewed hold must publish, not silently disappear.';

comment on column issues.civic_pressure is
  'Social demand, 0-100 (PRD S06). Never feeds the SLA and never feeds priority; '
  'it drives feed ranking and escalation candidacy only. Recomputed by cron.';

comment on column issues.routing_tier is
  'UNMAPPED is a valid, common outcome -- jurisdiction known, nobody to send it '
  'to. The UI must say so honestly rather than invent an assignee.';

-- Feed distance filter and the clustering candidate query.
create index issues_location_idx on issues using gist (location);
-- Backs gov_kpis() and every saved queue view: five counts, one scan.
create index issues_status_juris_idx on issues (status, jurisdiction_id);
create index issues_routing_tier_idx on issues (routing_tier);
create index issues_public_id_idx    on issues (public_id);
create index issues_category_idx     on issues (category_id);
create index issues_department_idx   on issues (department_id);
create index issues_owner_idx        on issues (owner_officer_id);
create index issues_created_by_idx   on issues (created_by);
create index issues_merged_into_idx  on issues (merged_into_id)
  where merged_into_id is not null;

-- The feed's hot path: published, public, still live. Partial so the index stays
-- small as CLOSED rows accumulate forever.
create index issues_feed_idx on issues (published_at desc)
  where visibility = 'PUBLIC'
    and published_at is not null
    and status not in ('HELD', 'MERGED', 'CLOSED');

-- The SLA sweep in 0019 scans this every few minutes. Partial index because
-- only Tier 1, still-open issues can ever breach.
create index issues_sla_due_idx on issues (sla_due_at)
  where sla_due_at is not null
    and status not in ('RESOLVED', 'CLOSED', 'MERGED', 'REJECTED');

-- Moderation queue (PRD S20): held items reviewed on a clock, oldest first.
create index issues_held_idx on issues (created_at)
  where status = 'HELD';
