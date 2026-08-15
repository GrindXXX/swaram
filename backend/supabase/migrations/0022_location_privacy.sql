-- Browser roles can read issue metadata through RLS, but never the stored exact
-- point or reverse-geocoded address. Government RPCs and service workers use
-- SECURITY DEFINER/service-role paths when precise coordinates are required.

revoke select on public.issues from anon, authenticated;

grant select (
  id, public_id, title, category_id, subcategory,
  location_precision, location_visibility, visibility,
  severity, priority, civic_pressure, estimated_people_affected,
  escalation_level, routing_tier, jurisdiction_id,
  jurisdiction_match_method, authority_id, department_id, owner_officer_id,
  status, moderation_verdict, moderation_reviewed_by,
  moderation_reviewed_at, published_at, sla_due_at, acknowledged_at,
  resolved_at, closed_at, satisfaction_score, merged_into_id,
  rejection_reason, report_count, follower_count,
  created_at, updated_at
) on public.issues to anon, authenticated;

comment on column public.issues.location is
  'Exact routing point. Never granted to browser roles; expose only through a role-aware redacted RPC.';
comment on column public.issues.address is
  'Potentially identifying reverse-geocoded address. Never granted to browser roles.';

create or replace function public.citizen_issue_descriptions(p_issue_ids uuid[])
returns table (issue_id uuid, description text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if coalesce(cardinality(p_issue_ids), 0) > 100 then
    raise exception 'at most 100 issue descriptions may be requested' using errcode = '22023';
  end if;

  return query
  select i.id,
         case
           when i.visibility = 'PUBLIC' then i.description
           when public.is_issue_reporter(i.id)
             or public.is_issue_participant(i.id)
             or (public.is_gov() and public.in_gov_scope(i.jurisdiction_id))
             or public.is_admin()
           then i.description
           else null
         end
    from issues i
   where i.id = any(coalesce(p_issue_ids, '{}'::uuid[]))
     and public.can_view_issue(i.id);
end $$;

revoke all on function public.citizen_issue_descriptions(uuid[]) from public;
grant execute on function public.citizen_issue_descriptions(uuid[]) to anon, authenticated;

-- Precise report/evidence data remains available to trusted server paths, not
-- direct browser queries. A visibility-aware media RPC can expose derivatives.
revoke select on public.reports from anon, authenticated;
grant select (
  id, issue_id, media_type, is_anonymous, source,
  is_facing_too, created_at
) on public.reports to anon, authenticated;

revoke select on public.issue_evidence from anon, authenticated;
grant select (
  id, issue_id, report_id, evidence_type, media_type,
  caption, geotagged, captured_at, created_at
) on public.issue_evidence to anon, authenticated;

-- The intake RPC performs internal whole-row reads after inserting an issue.
-- Keep that implementation detail behind its existing authenticated-only,
-- auth.uid()-bound contract instead of granting private columns to browsers.
alter function public.submit_citizen_report(
  uuid, text, double precision, double precision, text, text,
  location_precision, location_visibility, boolean
) security definer;

comment on function public.submit_citizen_report(
  uuid, text, double precision, double precision, text, text,
  location_precision, location_visibility, boolean
) is 'Authenticated, idempotent report intake. SECURITY DEFINER is required only so internal reads can access private location columns; caller identity remains bound to auth.uid().';
