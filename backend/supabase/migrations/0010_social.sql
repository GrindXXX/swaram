-- 0010_social.sql
-- The civic loop's social surface: discussion, following, support, and the
-- flags that keep it habitable.
--
-- The one rule that must not be implemented in the client: an INTERNAL comment
-- is department-only. It is filtered by an RLS policy in 0016, not by a WHERE
-- clause in a query someone will forget to write. An officer typing "the
-- contractor is stalling, escalate quietly" must be structurally incapable of
-- publishing it by mis-clicking a toggle.

create table comments (
  id         uuid primary key default gen_random_uuid(),
  issue_id   uuid not null references issues(id) on delete cascade,
  user_id    uuid references users(id) on delete set null,
  -- One level of threading. Deeper nesting turns a status thread into a forum.
  parent_id  uuid references comments(id) on delete cascade,

  content    text not null check (length(btrim(content)) > 0),
  visibility comment_visibility not null default 'PUBLIC',

  -- The highest-trust object in the product (PRD S18). Only settable when the
  -- author is a GOVERNMENT account acting on an issue in their scope; enforced
  -- by policy in 0016, not by the client.
  is_official boolean not null default false,
  -- Distinct from is_official: a corporator or MLA speaking has no operational
  -- authority and must not look like the department (PRD S10).
  is_representative boolean not null default false,

  -- Flag -> auto-hide at 3 -> human review (PRD S20). Maintained by trigger.
  flag_count int not null default 0,
  is_hidden  boolean not null default false,
  hidden_at  timestamptz,

  edited_at  timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column comments.visibility is
  'INTERNAL is invisible to citizens at the POLICY level (0016). Never rely on '
  'a client-side filter: the client talks to Postgres directly, so a filter is '
  'a suggestion, not a boundary.';

comment on column comments.is_official is
  'The government speaking to a citizen about their problem. If this badge can '
  'be obtained by anyone who passes an identity check it is worthless.';

create index comments_issue_idx on comments (issue_id, created_at)
  where deleted_at is null;
create index comments_parent_idx on comments (parent_id)
  where parent_id is not null;
create index comments_user_idx on comments (user_id);
-- Moderation queue: comments auto-hidden and awaiting review.
create index comments_hidden_idx on comments (hidden_at)
  where is_hidden;

-- Follow without reporting. Drives the notification fan-out, and is the reason
-- follower_count is a separate number from report_count.
create table issue_followers (
  issue_id   uuid not null references issues(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  -- A reporter is auto-followed but may mute without un-reporting.
  muted      boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (issue_id, user_id)
);

create index issue_followers_user_idx on issue_followers (user_id);

-- "I'm facing this too" as a signal, not as a report. MVP has one type.
-- A reaction feeds civic_pressure; it never feeds report_count, because a tap
-- is not evidence.
create table issue_reactions (
  issue_id      uuid not null references issues(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  reaction_type text not null default 'SUPPORT'
                check (reaction_type in ('SUPPORT')),
  created_at    timestamptz not null default now(),
  -- One support per issue per person (PRD S20 rate limits). The primary key is
  -- the rate limit.
  primary key (issue_id, user_id, reaction_type)
);

create index issue_reactions_user_idx on issue_reactions (user_id);

-- Polymorphic because the four flaggable things share one review workflow and
-- one queue. A per-target table would mean four moderation UIs that drift.
create table flags (
  id          bigserial primary key,
  target_type text not null check (target_type in ('ISSUE','REPORT','COMMENT','USER')),
  -- Deliberately text, not uuid: targets have mixed key types (comments and
  -- issues are uuid, reports uuid, users uuid, but future targets may not be).
  -- No FK is possible across a polymorphic reference; resolution is done by the
  -- moderation queue, which knows the type.
  target_id   text not null,
  reporter_id uuid references users(id) on delete set null,

  reason      text not null check (reason in (
                'SPAM','ABUSE','PERSONAL_INFO','OFF_TOPIC',
                'MISINFORMATION','NOT_A_CIVIC_ISSUE','OTHER')),
  detail      text,

  status      text not null default 'PENDING'
              check (status in ('PENDING','UPHELD','OVERTURNED','DUPLICATE')),
  resolved_by uuid references users(id),
  resolved_at timestamptz,
  resolution_note text,

  created_at  timestamptz not null default now(),

  -- One flag per person per target. Brigading should not be able to inflate
  -- flag_count past the auto-hide threshold with a single account.
  unique (target_type, target_id, reporter_id)
);

comment on table flags is
  'Reactive layer. Pre-publication screening (S20) catches irreversible harms; '
  'flagging catches everything else because the community has context the model '
  'does not. Neither replaces the other.';

create index flags_target_idx on flags (target_type, target_id);
-- The moderation queue itself: oldest unreviewed first, reviewed within 24h.
create index flags_pending_idx on flags (created_at)
  where status = 'PENDING';
