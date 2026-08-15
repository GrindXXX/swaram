-- 0008_reports.sql
-- One row per person's experience of a problem (PRD S03). Many per issue.
--
-- The split exists so both numbers stay honest: "27 people affected" is a
-- report count, "how many problems exist" is an issue count. Reports are never
-- folded into the issue row, even when clustering merges two issues -- the
-- reports move, the evidence survives, and the crowd count is a sum of real
-- submissions rather than a manually incremented integer.

create table reports (
  id          uuid primary key default gen_random_uuid(),
  issue_id    uuid not null references issues(id) on delete cascade,
  user_id     uuid references users(id) on delete set null,

  description text,
  transcript  text,               -- ASR output for voice reports (C1)
  audio_url   text,               -- original audio retained as evidence
  media_url   text,
  media_type  media_type not null default 'NONE',

  -- The report's own pin, which is not the issue's pin: the issue location is
  -- canonical, each report records where that person actually stood. Feeds the
  -- location-plausibility check in PRD S20.
  location    geography(Point, 4326),

  -- Display only. Identity is always known internally (PRD S19 privacy) so
  -- abuse stays traceable; anonymity is a presentation choice.
  is_anonymous boolean not null default false,

  source      report_source not null default 'CITIZEN_APP',

  -- C4 clustering retrieval. 1536 dims = OpenAI text-embedding-3-small.
  embedding   vector(1536),

  created_at  timestamptz not null default now()
);

comment on column reports.is_anonymous is
  'Hides the display name on the public page only. user_id is still stored; a '
  'platform that cannot attribute abuse cannot moderate it.';

create index reports_issue_idx    on reports (issue_id);
create index reports_user_idx     on reports (user_id);
create index reports_created_idx  on reports (created_at desc);
create index reports_location_idx on reports using gist (location);

-- Approximate nearest neighbour over report text. lists=100 suits the tens of
-- thousands of rows V1 will hold; rebuild with lists ~= sqrt(rows) as it grows.
-- Cosine because the embeddings are normalised.
create index reports_embedding_idx on reports
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

comment on index reports_embedding_idx is
  'Retrieval only. SQL narrows candidates cheaply; the clustering agent judges '
  'location + image + text together. A vector hit is never a merge decision.';

-- PRD S20 anti-gaming: one report per issue per user per 24h. A plain unique
-- index cannot express a rolling window, so the window is enforced by
-- rate_limits (0013); this index makes the "has this user already reported
-- here" lookup a single probe.
create index reports_issue_user_idx on reports (issue_id, user_id, created_at desc);

-- Before / progress / after media (PRD S17). Separate from reports because
-- evidence is also uploaded by officers, contractors and field crew, who are
-- not reporting the problem -- they are documenting work on it.
create table issue_evidence (
  id          bigserial primary key,
  issue_id    uuid not null references issues(id) on delete cascade,
  report_id   uuid references reports(id) on delete set null,
  uploaded_by uuid references users(id),
  evidence_type evidence_type not null,

  media_url   text not null,
  media_type  media_type not null default 'PHOTO',
  caption     text,

  -- EXIF is stripped from stored media (PRD S19), so the coordinates are read
  -- at upload and kept here instead. Null means the photo carried no GPS --
  -- which is itself a signal the verifier agent uses.
  location    geography(Point, 4326),
  geotagged   boolean not null default false,
  captured_at timestamptz,          -- from EXIF, may predate created_at
  created_at  timestamptz not null default now(),

  -- geotagged is a claim about `location`; the two cannot disagree.
  constraint issue_evidence_geotag_consistent
    check (geotagged = (location is not null))
);

create index issue_evidence_issue_idx on issue_evidence (issue_id, evidence_type);
create index issue_evidence_location_idx on issue_evidence using gist (location);
