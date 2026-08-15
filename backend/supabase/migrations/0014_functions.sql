-- 0014_functions.sql
-- The scoring layer. Three numbers, computed differently, used for different
-- decisions, and deliberately never allowed to collapse into one (PRD S06):
--
--   severity        objective  -> priority, SLA, emergency interception
--   civic_pressure  social     -> feed ranking, escalation candidacy, digest
--   people affected estimated  -> priority weighting, scale escalation
--
-- Everything here is a pure function of table state. That is what makes the
-- numbers explainable to a citizen, debuggable by an officer and re-runnable
-- after a weight change -- and it is why a learned ranker is deferred past V1.

-- ---------------------------------------------------------------------------
-- Public identifier
-- ---------------------------------------------------------------------------

create or replace function generate_public_id()
returns text language sql volatile as $$
  select 'CIV-' || lpad(nextval('issue_public_id_seq')::text, 5, '0');
$$;

comment on function generate_public_id is
  'CIV-##### from a sequence, never from a hash of the row. Gaps are fine and '
  'expected (a rolled-back insert burns an id); what is not fine is two issues '
  'sharing a number that citizens have already shared on WhatsApp.';

-- Attached here rather than in 0007 because the function lives with the other
-- domain logic. The column has been NOT NULL UNIQUE since 0007 either way.
alter table issues alter column public_id set default generate_public_id();

-- ---------------------------------------------------------------------------
-- Civic pressure (PRD S06) -- 0..100
-- ---------------------------------------------------------------------------

create or replace function compute_civic_pressure(p_issue_id uuid)
returns numeric
language plpgsql stable as $$
declare
  v_issue        issues%rowtype;
  v_supporters   int;
  v_discussion   int;
  v_rejected     int;
  v_days         numeric;
  v_reports_c    numeric;
  v_support_c    numeric;
  v_follow_c     numeric;
  v_discuss_c    numeric;
  v_age_c        numeric;
  v_raw          numeric;
  v_damping      numeric := 1.0;
  v_boost        numeric := 0;
begin
  select * into v_issue from issues where id = p_issue_id;
  if not found then
    return 0;
  end if;

  select count(*) into v_supporters
    from issue_reactions where issue_id = p_issue_id;

  select count(*) into v_discussion
    from comments
   where issue_id = p_issue_id
     and visibility = 'PUBLIC'
     and deleted_at is null
     and not is_hidden;

  select count(*) into v_rejected
    from resolution_submissions
   where issue_id = p_issue_id and outcome = 'REJECTED';

  -- Every component is log-compressed and capped, so the 200th report cannot
  -- pin one issue to the top of the feed forever (PRD S06).
  v_reports_c := least(1, ln(1 + v_issue.report_count)   / ln(51));    -- ~50 saturates
  v_support_c := least(1, ln(1 + v_supporters)           / ln(101));   -- ~100 saturates
  v_follow_c  := least(1, ln(1 + v_issue.follower_count) / ln(101));
  v_discuss_c := least(1, ln(1 + v_discussion)           / ln(31));    -- ~30 saturates

  -- Age counts only while the problem is unresolved. Pressure measures unmet
  -- demand, so a resolved issue accrues none however old it is.
  if v_issue.resolved_at is not null
     or v_issue.status in ('RESOLVED','CLOSED','MERGED','REJECTED') then
    v_age_c := 0;
  else
    v_days  := extract(epoch from (now() - v_issue.created_at)) / 86400;
    v_age_c := least(1, v_days / 30);      -- a month unanswered saturates
  end if;

  v_raw := 0.30 * v_reports_c
         + 0.20 * v_support_c
         + 0.10 * v_follow_c
         + 0.15 * v_discuss_c
         + 0.25 * v_age_c;

  -- Decay when the authority is genuinely engaging. Pressure measures unmet
  -- demand, not hostility -- an officer who acknowledges, replies and posts
  -- progress evidence should watch the number fall.
  if v_issue.acknowledged_at is not null then
    v_damping := v_damping - 0.15;
  end if;

  if exists (select 1 from comments c
              where c.issue_id = p_issue_id
                and c.is_official
                and c.visibility = 'PUBLIC'
                and c.created_at > now() - interval '14 days') then
    v_damping := v_damping - 0.10;
  end if;

  if exists (select 1 from issue_evidence e
              where e.issue_id = p_issue_id
                and e.evidence_type = 'PROGRESS') then
    v_damping := v_damping - 0.10;
  end if;

  -- Never below half: engagement dampens pressure, it does not silence it.
  -- An officer who acknowledges and then does nothing for six weeks must still
  -- climb the feed.
  v_damping := greatest(0.50, v_damping);

  -- The accountability loop's teeth (PRD S06). If citizens reject the
  -- government's resolution, pressure RISES rather than resetting -- the issue
  -- comes back with more force than it had before.
  v_boost := least(0.30, 0.15 * v_rejected);

  return round(100 * least(1, greatest(0, v_raw * v_damping + v_boost)), 2);
end $$;

comment on function compute_civic_pressure is
  'Never feeds the SLA and never feeds priority (PRD S06). Never shown to an '
  'officer as a leaderboard either: officers who feel publicly ranked start '
  'rejecting issues instead of fixing them.';

-- ---------------------------------------------------------------------------
-- Feed ranking (PRD S06) -- the transparent V1 formula
-- ---------------------------------------------------------------------------

-- Severity as a number. LOW..CRITICAL -> 0.2..1.0, exactly as specified.
create or replace function severity_weight(p_sev issue_severity)
returns numeric language sql immutable as $$
  select case p_sev
           when 'LOW' then 0.2 when 'MEDIUM' then 0.5
           when 'HIGH' then 0.8 when 'CRITICAL' then 1.0 end::numeric;
$$;

-- Takes the issue row so a feed query passes `i` and pays for no extra lookup:
--   select i.*, feed_rank(i, $lat, $lng) as score from issues i ...
-- Weights are parameters with the PRD defaults rather than constants, because
-- they are server-side config that must be tunable without a client release and
-- logged per feed request for debugging.
create or replace function feed_rank(
  i     issues,
  p_lat double precision,
  p_lng double precision,
  w1 numeric default 0.30,   -- proximity
  w2 numeric default 0.20,   -- severity
  w3 numeric default 0.20,   -- report count, log scale
  w4 numeric default 0.15,   -- recent activity
  w5 numeric default 0.10,   -- people affected
  w6 numeric default 0.05    -- staleness (subtracted)
) returns numeric
language plpgsql stable as $$
declare
  v_km          numeric;
  v_proximity   numeric;
  v_reports     numeric;
  v_activity    numeric;
  v_people      numeric;
  v_stale       numeric := 0;
  v_last_report timestamptz;
  v_hours       numeric;
  v_score       numeric;
begin
  -- Proximity: the single strongest relevance cue on a feed card. Null user
  -- location (logged out, permission denied) scores neutral rather than zero,
  -- so a logged-out feed degrades to severity + crowd rather than to noise.
  if p_lat is null or p_lng is null then
    v_proximity := 0.5;
  else
    v_km := ST_Distance(i.location,
                        ST_SetSRID(ST_Point(p_lng, p_lat), 4326)::geography) / 1000.0;
    v_proximity := 1 / (1 + v_km);
  end if;

  v_reports := least(1, ln(1 + i.report_count) / ln(101));

  -- Recent activity, decaying over 72h. updated_at is touched by every status,
  -- assignment and comment trigger in 0015, so it is a real activity clock.
  v_hours := extract(epoch from (now() - greatest(i.updated_at, i.created_at))) / 3600;
  v_activity := exp(-v_hours / 72.0);

  -- Capped influence (PRD S06): an AI estimate of "~50,000 affected" must not
  -- be able to hijack a department's whole queue. 10k saturates.
  v_people := least(1, ln(1 + coalesce(i.estimated_people_affected, 0)) / ln(10001));

  -- Resolved issues stay in the feed for 48h with before/after media -- visible
  -- wins are what keep people reporting -- and then sink.
  if i.resolved_at is not null then
    v_stale := least(1, extract(epoch from (now() - i.resolved_at)) / (48 * 3600));
  end if;

  v_score := w1 * v_proximity
           + w2 * severity_weight(i.severity)
           + w3 * v_reports
           + w4 * v_activity
           + w5 * v_people
           - w6 * v_stale;

  -- Fresh-report boost: an issue someone reported in the last hour is a live
  -- problem and should surface now, not after the next recompute.
  select max(r.created_at) into v_last_report
    from reports r where r.issue_id = i.id;
  if v_last_report is not null and v_last_report > now() - interval '1 hour' then
    v_score := v_score * 1.15;
  end if;

  return round(greatest(0, v_score), 6);
end $$;

comment on function feed_rank is
  'Transparent scoring beats a learned model at V1: it is explainable to a '
  'citizen, debuggable by an officer and demo-able. Department diversity (no '
  'more than 3 consecutive cards from one department) is a post-sort pass in '
  'the query layer, not part of the score.';

-- ---------------------------------------------------------------------------
-- Satisfaction (PRD S03) -- the community's verdict, not the government's
-- ---------------------------------------------------------------------------

create or replace function compute_satisfaction(p_issue_id uuid)
returns numeric
language plpgsql stable as $$
declare
  v_sub_id  uuid;
  v_total   numeric;
  v_fixed   numeric;
begin
  -- The current attempt only. A rejected earlier submission stays on the record
  -- but its votes do not dilute the judgement of the work done since.
  select id into v_sub_id
    from resolution_submissions
   where issue_id = p_issue_id
   order by attempt desc
   limit 1;

  if v_sub_id is null then
    return null;
  end if;

  -- Weighted: responses from implausible witnesses are down-weighted rather
  -- than discarded, so the record still shows they answered.
  select coalesce(sum(weight), 0),
         coalesce(sum(weight) filter (where verdict = 'COMPLETELY_FIXED'), 0)
    into v_total, v_fixed
    from verification_responses
   where resolution_submission_id = v_sub_id;

  -- Null, not zero. No responses means we do not know, and manufacturing a 0%
  -- would punish a department for citizen silence.
  if v_total = 0 then
    return null;
  end if;

  return round(100 * v_fixed / v_total, 2);
end $$;

comment on function compute_satisfaction is
  'Percentage answering COMPLETELY_FIXED. Below ~50% the issue does not close: '
  'it returns to active with pressure raised and the owner notified (0019). '
  'Satisfaction, not closure count, is the department metric.';

-- The public outcome is the breakdown itself, not a single verdict.
create or replace function verification_breakdown(p_issue_id uuid)
returns table (verdict verification_verdict, responses int, pct numeric)
language sql stable as $$
  with sub as (
    select id from resolution_submissions
     where issue_id = p_issue_id order by attempt desc limit 1
  ),
  v as (
    select r.verdict, sum(r.weight) as w
      from verification_responses r join sub on r.resolution_submission_id = sub.id
     group by r.verdict
  )
  select v.verdict,
         v.w::int,
         round(100 * v.w / nullif(sum(v.w) over (), 0), 1)
    from v
   order by v.w desc;
$$;
