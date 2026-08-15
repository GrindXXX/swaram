-- 0011_resolution.sql
-- Resolution is not a government declaration (PRD S03, S10).
--
-- There is no "mark resolved" verb anywhere in this schema. An authority files
-- a Resolution Submission -- what was done, with evidence -- and that moves the
-- issue to community verification, not to RESOLVED. The people who reported the
-- problem decide whether it is fixed, and the outcome is a distribution rather
-- than a boolean.
--
-- An authority may file more than one submission over an issue's life. A
-- rejected resolution is a record, not a deletion: the second attempt has to
-- live alongside the first one that citizens threw out.

create table resolution_submissions (
  id             uuid primary key default gen_random_uuid(),
  issue_id       uuid not null references issues(id) on delete cascade,
  attempt        int not null default 1,     -- 1, 2, 3... never reused

  submitted_by   uuid references users(id),
  -- Nullable on purpose: a Tier 2/3 issue can be community-verified with no
  -- officer involved at all (PRD S12) -- a citizen confirming a pothole was
  -- quietly filled is valuable even when nobody ever logged in.
  authority_id   bigint references authorities(id),
  department_id  bigint references departments(id),

  action_taken   text not null,              -- what was done
  intent         text,                       -- or what will be done, and when
  documents      jsonb,                      -- work orders, completion reports
  cost_incurred  numeric(14,2),

  -- The verifier agent's comparison of the resolution photo's GPS against the
  -- original report location (schema/ticket.schema.json). Large distances are
  -- the strongest single signal of a photographed-somewhere-else closure.
  -- Null means the resolution media carried no usable GPS, which is different
  -- from zero and must not be rendered as "0 m".
  resolution_gps_distance_m numeric(10,2),
  resolution_photo_url      text,

  -- Community verification window.
  submitted_at   timestamptz not null default now(),
  verification_opened_at timestamptz,
  verification_closed_at timestamptz,
  -- Quorum (PRD S03): whichever comes first -- 20% of reporters, at least 3
  -- people, or 7 days. Snapshotted per submission because report_count moves.
  quorum_target  int not null default 3,
  eligible_count int,                        -- reporters + followers asked

  outcome        text check (outcome in
                   ('ACCEPTED','REJECTED','INSUFFICIENT_VERIFICATION')),
  satisfaction_score numeric(5,2)
                 check (satisfaction_score between 0 and 100),
  created_at     timestamptz not null default now(),

  unique (issue_id, attempt)
);

comment on column resolution_submissions.outcome is
  'ACCEPTED at >= 50% completely-fixed. REJECTED below that -- the issue returns '
  'to active with civic_pressure RAISED, not reset (PRD S06). '
  'INSUFFICIENT_VERIFICATION records low turnout honestly rather than '
  'manufacturing consent from three responses.';

comment on column resolution_submissions.resolution_gps_distance_m is
  'Metres between the original issue pin and the resolution photo GPS. Feeds '
  'the disputed-closure check. Null = no GPS in the evidence, not 0 m.';

create index resolution_submissions_issue_idx
  on resolution_submissions (issue_id, attempt desc);
-- The "Awaiting verify" saved view, sorted by submitted ascending.
create index resolution_submissions_open_idx
  on resolution_submissions (verification_opened_at)
  where verification_closed_at is null;
create index resolution_submissions_dept_idx
  on resolution_submissions (department_id);

create table verification_responses (
  id            uuid primary key default gen_random_uuid(),
  resolution_submission_id uuid not null
                references resolution_submissions(id) on delete cascade,
  issue_id      uuid not null references issues(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,

  verdict       verification_verdict not null,
  comment       text,
  media_url     text,                        -- fresh evidence for STILL_EXISTS

  -- Only plausible witnesses are asked (PRD S03): reporters and followers whose
  -- location makes them credible. Stored so the aggregate can be recomputed and
  -- audited later, and so a down-weighted response is visible rather than
  -- silently dropped.
  is_reporter   boolean not null default false,
  distance_m    numeric(10,2),
  weight        numeric(4,3) not null default 1.000
                check (weight between 0 and 1),

  created_at    timestamptz not null default now(),

  -- One verdict per person per submission. A second attempt gets a fresh vote,
  -- which is why this is keyed on the submission and not on the issue.
  unique (resolution_submission_id, user_id)
);

comment on table verification_responses is
  'The public outcome is the breakdown itself -- 72% completely fixed, 19% '
  'partially, 7% still exists, 2% new problem -- never a single yes/no. '
  'Everyone can see the result; only plausible witnesses may respond.';

create index verification_responses_submission_idx
  on verification_responses (resolution_submission_id, verdict);
create index verification_responses_issue_idx on verification_responses (issue_id);
create index verification_responses_user_idx  on verification_responses (user_id);
