-- 0013_notifications.sql
-- Notifications, and the rate limiting that replaces a security property we
-- lost when auth moved to Google.
--
-- Phone OTP was the anti-spam anchor: Indian SIMs are KYC'd at issuance, so one
-- number meant one traceable person and one account. Google accounts are free
-- and unlimited, so that property is simply gone. Report count drives priority
-- and the crowd counter is the emotional payload of the whole product, which
-- means it WILL be gamed. rate_limits is the compensating control and it is not
-- optional -- see PRD S20 "the gaming risk to design against".

create table notifications (
  id         bigserial primary key,
  user_id    uuid not null references users(id) on delete cascade,
  issue_id   uuid references issues(id) on delete cascade,

  type       text not null,           -- 'REPORT_JOINED', 'SLA_BREACHED', ...
  title      text not null,
  body       text,
  -- Deep link target; kept denormalised so a notification survives the issue
  -- being merged into another one.
  url        text,

  -- SMS is a fallback for critical status changes only: it costs money and it
  -- annoys (PRD S18).
  channel    text not null default 'PUSH'
             check (channel in ('PUSH','IN_APP','EMAIL','SMS','DIGEST')),

  -- Bundling: never more than 3 pushes per user per day for a single issue.
  -- Anything past that is written with channel='DIGEST' and collected by the
  -- daily job rather than sent.
  is_read    boolean not null default false,
  read_at    timestamptz,
  sent_at    timestamptz,
  failed_at  timestamptz,
  error      text,
  created_at timestamptz not null default now()
);

comment on table notifications is
  'Confidential issues never fan out (PRD S18): no follower notifications, no '
  '"new issue near you", no digest inclusion. Only the reporter and the owning '
  'department are ever notified, which is enforced at the fan-out query, and '
  'again by the RLS read policy in 0016.';

create index notifications_user_idx on notifications (user_id, created_at desc);
-- The unread badge, which is read on every page load.
create index notifications_unread_idx on notifications (user_id)
  where not is_read;
-- Bundling check: how many pushes has this user had about this issue today.
create index notifications_bundle_idx
  on notifications (user_id, issue_id, created_at desc)
  where channel = 'PUSH';
-- The outbound worker's queue.
create index notifications_pending_idx on notifications (created_at)
  where sent_at is null and failed_at is null;

-- Fixed-window counters. Chosen over a sliding log because the limits are
-- coarse (10 reports/day) and a counter is one upsert instead of a growing
-- table of every action anyone ever took.
create table rate_limits (
  user_id      uuid not null references users(id) on delete cascade,
  action       text not null,      -- 'REPORT' | 'COMMENT' | 'ISSUE' | 'FLAG' | 'SUPPORT'
  -- Truncated start of the window. Composite PK means concurrent requests
  -- serialise on one row rather than racing.
  window_start timestamptz not null,
  count        int not null default 0,
  -- Optional narrowing, e.g. "5 comments per ISSUE per hour" keys on the issue.
  scope        text not null default '',
  primary key (user_id, action, scope, window_start)
);

comment on table rate_limits is
  'Keyed on user id. Also rate limit on IP at the edge -- a user-keyed limit '
  'alone is defeated by creating more free Google accounts, which is exactly '
  'the attack the SIM-KYC anchor used to prevent.';

-- Old windows are dead weight; the sweep in 0019 deletes them.
create index rate_limits_window_idx on rate_limits (window_start);

-- Atomic check-and-increment. Returns true when the action is allowed.
-- security definer because the caller must not be able to UPDATE this table
-- directly -- a rate limit a client can reset is decoration.
create or replace function check_rate_limit(
  p_user   uuid,
  p_action text,
  p_limit  int,
  p_window interval default interval '1 day',
  p_scope  text default ''
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_start timestamptz;
  v_count int;
begin
  if p_user is null then
    return false;             -- anonymous callers have no budget at all
  end if;

  -- Align the window to its own length so every user shares the same
  -- boundaries; per-user drifting windows are far harder to reason about.
  v_start := to_timestamp(
               floor(extract(epoch from now()) / extract(epoch from p_window))
               * extract(epoch from p_window));

  insert into rate_limits (user_id, action, scope, window_start, count)
  values (p_user, p_action, p_scope, v_start, 1)
  on conflict (user_id, action, scope, window_start)
    do update set count = rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end $$;

comment on function check_rate_limit is
  'PRD S20 budgets: 10 reports/user/day, 5 comments/issue/hour, 1 support per '
  'issue (that one is the primary key on issue_reactions, not this function). '
  'Increments even when it returns false, so a client hammering the endpoint '
  'digs its own hole deeper rather than probing for the boundary for free.';

-- Burst detection input: accounts younger than this cannot perform high-trust
-- actions (verification quorum membership, mass reporting). Minimum account
-- age is the cheapest available substitute for KYC.
create or replace function account_age_days(p_user uuid)
returns int language sql stable as $$
  select greatest(0, (extract(epoch from now() - u.created_at) / 86400)::int)
  from users u where u.id = p_user;
$$;
