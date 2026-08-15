-- 0024_fix_notifications_grant.sql
-- notifications got RLS policies in 0016 (notifications_self for select,
-- notifications_self_update for update) but no table-level GRANT, unlike
-- every other RLS-policied table in this schema. RLS restricts which rows a
-- grant already allows; it does not grant on its own, so `authenticated`
-- got "permission denied for table notifications" even for a legitimately
-- signed-in citizen reading their own rows. Found by testing the citizen
-- app's Alerts screen against a real local instance, not by inspection.
grant select, update on notifications to authenticated;
