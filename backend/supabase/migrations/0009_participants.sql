-- 0009_participants.sql
-- Many people work an issue; exactly one is answerable for it (PRD S10).
--
-- A single assigned_officer column cannot express a ward engineer, a road
-- contractor, a field crew, a supervisor watching the clock and a corporator on
-- the thread. A free-for-all cannot express accountability. So: issues.
-- owner_officer_id is the one Owner, and everyone else is a row here with a
-- declared role. The partial unique index below is what stops that from
-- degrading into a group chat.

create table issue_participants (
  id         bigserial primary key,
  issue_id   uuid not null references issues(id) on delete cascade,
  -- Exactly one of user_id / org_id. Contractors are engaged as firms; crews
  -- and officers are people.
  user_id    uuid   references users(id) on delete cascade,
  org_id     bigint references organisations(id) on delete cascade,
  role       participant_role not null,

  -- What the citizen sees on the issue page: "Roads Dept - Officer Kiran - with
  -- ABC Infra (contractor)". Enough to know who is accountable, not enough to
  -- harass anyone, so this defaults to hidden.
  is_public  boolean not null default false,
  -- Role-scoped notification opt-in (PRD S18). A contractor is not paged about
  -- every citizen comment.
  notify     boolean not null default true,

  -- Adding a participant is logged: who, and why. Surfaces in the activity tab.
  added_by   uuid references users(id),
  reason     text,
  -- Contractor engagements end. A scoped account that never expires becomes a
  -- permanent back door into the ward's data.
  expires_at timestamptz,
  added_at   timestamptz not null default now(),
  removed_at timestamptz,

  constraint issue_participants_subject_xor
    check (num_nonnulls(user_id, org_id) = 1),
  -- Only an organisation can hold the CONTRACTOR role; only a person can hold
  -- the operational ones. A firm cannot acknowledge an SLA.
  constraint issue_participants_org_role
    check (org_id is null or role = 'CONTRACTOR')
);

-- PRD S10's hard rule, in one line: ownership is transferable, never shared,
-- never plural. Partial on removed_at so a historical owner row stays readable
-- after a handover -- the audit trail must survive the transfer.
create unique index one_owner_per_issue on issue_participants (issue_id)
  where role = 'OWNER' and removed_at is null;

create index issue_participants_issue_idx on issue_participants (issue_id)
  where removed_at is null;
-- "Which issues am I attached to" -- the contractor's entire universe. They
-- never see the queue, so this is the only index their surface needs.
create index issue_participants_user_idx on issue_participants (user_id, role)
  where removed_at is null;
create index issue_participants_org_idx on issue_participants (org_id)
  where removed_at is null and org_id is not null;
-- Expiry sweep.
create index issue_participants_expiry_idx on issue_participants (expires_at)
  where removed_at is null and expires_at is not null;

-- The transfer chain, promoted from schema/ticket.schema.json to a first-class
-- table. A public log of every department hop makes buck-passing visible, which
-- is a better accountability primitive than anything in the PRD -- so it is
-- public by default rather than internal.
create table issue_transfers (
  id             bigserial primary key,
  issue_id       uuid not null references issues(id) on delete cascade,
  seq            int not null,          -- 0 = first receipt, oldest first
  from_authority bigint references authorities(id),
  to_authority   bigint references authorities(id),
  from_department bigint references departments(id),
  to_department   bigint references departments(id),
  action         transfer_action not null,
  reason         text,
  actor_id       uuid references users(id),
  -- False for a system re-route, true when a human moved it. Both are logged;
  -- the citizen is told which.
  is_manual      boolean not null default true,
  created_at     timestamptz not null default now(),

  unique (issue_id, seq)
);

comment on table issue_transfers is
  'Public accountability log. Rendered on the citizen issue page as the ladder '
  'of departments an issue passed through, oldest first. Append-only: a hop is '
  'never edited or deleted, because the point of the record is the hops nobody '
  'wants remembered.';

comment on column issue_transfers.action is
  'forwarded is the interesting one -- it is the moment a department declined '
  'ownership. A cross-department forward restarts the SLA clock (0015); an '
  'intra-department handover does not (PRD S10).';

create index issue_transfers_issue_idx on issue_transfers (issue_id, seq);
create index issue_transfers_to_authority_idx on issue_transfers (to_authority);
