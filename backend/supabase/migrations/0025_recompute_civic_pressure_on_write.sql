-- 0025_recompute_civic_pressure_on_write.sql
-- compute_civic_pressure(p_issue_id) (0014_functions.sql) was defined but never
-- called anywhere — not by a trigger, not by any RPC. report_count updates live
-- via sync_report_count (0015_triggers.sql), but civic_pressure stayed frozen
-- at whatever the intake worker set once at creation. Confirmed live: calling
-- add_citizen_issue_report ("I'm facing this too") bumped report_count 3->4
-- and left civic_pressure completely unchanged.
--
-- This wires the existing, already-correct, pure-SQL scoring function to run
-- after every write that feeds it: a report ("facing too" or otherwise),
-- a follow/unfollow, a public comment, a reaction. It does not cover the
-- time-based age component's continuous growth (that needs a scheduled job —
-- pg_cron is installed with zero jobs, a separate, already-known gap) or
-- resolution_submissions rejection (0011_resolution.sql presumably has its own
-- trigger path; not touched here to keep this fix to exactly the tables a
-- citizen action writes to).

-- SECURITY DEFINER is required, not stylistic: guard_issue_write() (also
-- 0019) skips its citizen/gov column lock-down only when current_user isn't
-- 'authenticated'. A SECURITY INVOKER trigger here keeps current_user as
-- 'authenticated' for a citizen-originated write (e.g. set_citizen_issue_
-- following, which is itself SECURITY INVOKER), so guard_issue_write() sees
-- the nested "UPDATE issues SET civic_pressure" as an ordinary citizen edit
-- and force-resets civic_pressure back to old.civic_pressure — silently
-- undoing this trigger. Confirmed live: this exact silent-revert happened on
-- a follow action before this was SECURITY DEFINER (report_count/follower_
-- count bumped correctly, civic_pressure did not move). It worked by
-- accident for add_citizen_issue_report only because that RPC happens to be
-- SECURITY DEFINER itself. Matches the security definer + search_path
-- pattern already used for every other privileged function in 0019.
create or replace function recompute_civic_pressure()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_issue_id uuid := coalesce(new.issue_id, old.issue_id);
begin
  update issues set civic_pressure = compute_civic_pressure(v_issue_id) where id = v_issue_id;
  return null;
end $$;

comment on function recompute_civic_pressure is
  'AFTER-trigger wrapper around compute_civic_pressure() (0014_functions.sql). '
  'Fires on reports/issue_followers/comments/issue_reactions writes so pressure '
  'moves the moment a citizen acts, not never.';

-- Named reports_sync_pressure (not reports_recompute_pressure) on purpose:
-- Postgres fires same-timing triggers on a table in NAME order, and this one
-- must run after reports_sync_count (0015_triggers.sql) or it reads
-- report_count before that trigger's increment lands. "sync_c..." < "sync_p..."
-- keeps that order; "recompute_..." would have sorted before it and silently
-- computed pressure off the stale count.
drop trigger if exists reports_sync_pressure on reports;
create trigger reports_sync_pressure
  after insert or delete on reports
  for each row execute function recompute_civic_pressure();

-- Same reasoning against issue_followers_sync_count.
drop trigger if exists issue_followers_sync_pressure on issue_followers;
create trigger issue_followers_sync_pressure
  after insert or delete on issue_followers
  for each row execute function recompute_civic_pressure();

drop trigger if exists comments_recompute_pressure on comments;
create trigger comments_recompute_pressure
  after insert or update or delete on comments
  for each row execute function recompute_civic_pressure();

drop trigger if exists reactions_recompute_pressure on issue_reactions;
create trigger reactions_recompute_pressure
  after insert or delete on issue_reactions
  for each row execute function recompute_civic_pressure();

-- One-off backfill so existing seeded/demo issues aren't stuck at a stale
-- number until their next write.
update issues set civic_pressure = compute_civic_pressure(id);
