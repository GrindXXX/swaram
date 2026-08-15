-- 0016_rls.sql
-- THE SECURITY MODEL. All of it, in one reviewable file, on purpose.
--
-- The client talks directly to Postgres. There is no application tier in front
-- of the database that every query must pass through, so an RLS policy is not
-- defence in depth -- it is the only defence. Get one of these wrong and a
-- CONFIDENTIAL harassment report reaches the public feed, which is the one
-- failure in this product that cannot be undone by fixing the bug.
--
-- Three rules for editing this file:
--   1. Default deny. A table with RLS enabled and no policy returns zero rows.
--      Enable RLS first, add policies second, and never the other way round.
--   2. No policy may depend on a client-supplied value other than the JWT.
--   3. Every change here must be accompanied by a case in the RLS matrix test:
--      {anon, citizen, reporter, officer-in-scope, officer-out-of-scope, admin}
--      x {PUBLIC, RESTRICTED, CONFIDENTIAL, HELD} = 24 assertions, run as a
--      merge gate. That test is the highest-value test in the codebase.
--
-- The service_role key bypasses RLS entirely and is how the workers write. It
-- must never reach a browser.

-- ===========================================================================
-- 1. Claim readers
-- ===========================================================================
--
-- Read scope from the JWT, not from a subquery. Without these, every policy
-- runs a lookup against government_officers on every row of every query and the
-- feed's p95 budget (400 ms) is gone. The claims are minted in 0017.
--
-- These are `stable`, not `immutable`: the claim is constant within a
-- statement, which is all the planner needs to hoist the call out of the loop.

create or replace function auth.app_role() returns text
language sql stable as $$
  select coalesce(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role',
           'ANON');
$$;

create or replace function auth.juris_id() returns bigint
language sql stable as $$
  select nullif(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'juris_id',
         '')::bigint;
$$;

create or replace function auth.juris_level() returns jurisdiction_level
language sql stable as $$
  select nullif(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'juris_lvl',
         '')::jurisdiction_level;
$$;

create or replace function auth.dept_id() returns bigint
language sql stable as $$
  select nullif(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'dept_id',
         '')::bigint;
$$;

create or replace function auth.is_admin() returns boolean
language sql stable as $$ select auth.app_role() = 'ADMIN'; $$;

create or replace function auth.is_gov() returns boolean
language sql stable as $$ select auth.app_role() in ('GOVERNMENT', 'ADMIN'); $$;

comment on function auth.app_role is
  'Claims go stale: a JWT minted before a role change carries the old claims '
  'until it refreshes. Read paths tolerate up to one token lifetime of lag; '
  'WRITE paths must not, so write policies also re-check government_officers '
  'via gov_scope_covers() below, and provisioning forces a session refresh.';

-- ===========================================================================
-- 2. Scope helpers
-- ===========================================================================

-- A government user sees their own jurisdiction and everything beneath it.
-- A ward officer's subtree is just their ward; a zone or district supervisor
-- gets the whole subtree for free. This is why there is no supervisor role --
-- scope is data (PRD S18).
create or replace function auth.in_gov_scope(p_juris bigint) returns boolean
language sql stable as $$
  select p_juris is not null
     and auth.juris_id() is not null
     and exists (select 1 from jurisdiction_descendants(auth.juris_id()) d
                  where d.id = p_juris);
$$;

-- The authoritative version, ignoring the token. Used on write paths where a
-- stale claim would be a privilege escalation rather than a stale read.
create or replace function public.gov_scope_covers(p_juris bigint)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from government_officers o
      join jurisdiction_descendants(o.jurisdiction_id) d on d.id = p_juris
     where o.user_id = auth.uid()
       and o.is_active
  );
$$;

-- ---------------------------------------------------------------------------
-- Recursion breakers.
--
-- issues' read policy needs "am I a reporter", which lives in reports.
-- reports' read policy needs "can I see the issue", which lives in issues.
-- Expressed as plain subqueries that is a policy cycle and Postgres raises
-- "infinite recursion detected in policy for relation". These security definer
-- functions cut the cycle by evaluating the predicate with RLS bypassed --
-- which is safe precisely because each one answers a single boolean about the
-- calling user and returns no rows.
-- ---------------------------------------------------------------------------

create or replace function public.is_issue_reporter(p_issue uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from reports r
     where r.issue_id = p_issue and r.user_id = auth.uid()
    union all
    select 1 from issues i
     where i.id = p_issue and i.created_by = auth.uid()
  );
$$;

create or replace function public.is_issue_participant(p_issue uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from issue_participants p
     where p.issue_id = p_issue
       and p.user_id = auth.uid()
       and p.removed_at is null
       and (p.expires_at is null or p.expires_at > now())
  );
$$;

create or replace function public.is_issue_follower(p_issue uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from issue_followers f
     where f.issue_id = p_issue and f.user_id = auth.uid()
  );
$$;

-- The single definition of "may this caller see this issue at all". Every child
-- table (reports, evidence, comments, transfers, history, verification) defers
-- to it, so there is exactly one place where the visibility rules live and
-- exactly one place to get them wrong.
create or replace function public.can_view_issue(p_issue uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from issues i
     where i.id = p_issue
       and (
         -- public feed
         (i.visibility = 'PUBLIC' and i.published_at is not null
                                  and i.status <> 'HELD')
         -- RESTRICTED: title and status are public, and the child tables that
         -- carry media, exact location and discussion check this function --
         -- so a RESTRICTED issue is listable but its evidence is not.
         or (i.visibility = 'RESTRICTED' and i.published_at is not null)
         -- reporter, participant, owning department, admin
         or public.is_issue_reporter(p_issue)
         or public.is_issue_participant(p_issue)
         or (auth.is_gov() and auth.in_gov_scope(i.jurisdiction_id))
         or auth.is_admin()
       )
  );
$$;

-- Whether the caller may see the private half of an issue: media, exact
-- location, internal discussion. Deliberately stricter than can_view_issue.
create or replace function public.can_view_issue_detail(p_issue uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from issues i
     where i.id = p_issue
       and (
         (i.visibility = 'PUBLIC' and i.published_at is not null
                                  and i.status <> 'HELD')
         or public.is_issue_reporter(p_issue)
         or public.is_issue_participant(p_issue)
         or (auth.is_gov() and auth.in_gov_scope(i.jurisdiction_id))
         or auth.is_admin()
       )
  );
$$;

create or replace function public.gov_owns_issue(p_issue uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from issues i
     where i.id = p_issue
       and auth.is_gov()
       and public.gov_scope_covers(i.jurisdiction_id)
  );
$$;

-- ===========================================================================
-- 3. Reference data -- readable by everyone, writable by admins
-- ===========================================================================
--
-- Jurisdictions, the taxonomy and the authority registry are published
-- government facts. Hiding them would break the logged-out issue page, which is
-- the most important URL in the product, and there is nothing here that is not
-- already on a .gov.in site.

alter table jurisdictions             enable row level security;
alter table authority_types           enable row level security;
alter table categories                enable row level security;
alter table category_authority_rules  enable row level security;
alter table departments               enable row level security;
alter table authorities               enable row level security;
alter table organisations             enable row level security;

create policy jurisdictions_read on jurisdictions
  for select to anon, authenticated using (true);
create policy jurisdictions_admin on jurisdictions
  for all to authenticated using (auth.is_admin()) with check (auth.is_admin());

create policy authority_types_read on authority_types
  for select to anon, authenticated using (true);
create policy authority_types_admin on authority_types
  for all to authenticated using (auth.is_admin()) with check (auth.is_admin());

create policy categories_read on categories
  for select to anon, authenticated using (true);
create policy categories_admin on categories
  for all to authenticated using (auth.is_admin()) with check (auth.is_admin());

create policy category_rules_read on category_authority_rules
  for select to anon, authenticated using (true);
create policy category_rules_admin on category_authority_rules
  for all to authenticated using (auth.is_admin()) with check (auth.is_admin());

create policy departments_read on departments
  for select to anon, authenticated using (true);
create policy departments_admin on departments
  for all to authenticated using (auth.is_admin()) with check (auth.is_admin());

create policy authorities_read on authorities
  for select to anon, authenticated using (true);
-- Only an admin edits the registry. bounce_count is written by the dispatch
-- worker under the service role, which bypasses RLS.
create policy authorities_admin on authorities
  for all to authenticated using (auth.is_admin()) with check (auth.is_admin());

create policy organisations_read on organisations
  for select to anon, authenticated using (true);
create policy organisations_admin on organisations
  for all to authenticated using (auth.is_admin()) with check (auth.is_admin());

-- ===========================================================================
-- 4. Identity
-- ===========================================================================

alter table users                   enable row level security;
alter table government_officers     enable row level security;
alter table officer_roster_records  enable row level security;
alter table role_grants_log         enable row level security;

-- A user row carries email and phone, so it is never publicly readable. The
-- feed and issue pages need display names, which come from the view below --
-- RLS has no column granularity, so the narrow projection IS the mechanism.
create policy users_self_read on users
  for select to authenticated using (id = auth.uid());
create policy users_self_update on users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy users_admin_all on users
  for all to authenticated using (auth.is_admin()) with check (auth.is_admin());

-- No insert policy: rows appear only via handle_new_user() (0006), which is
-- security definer and fires on auth.users. There is no self-signup path that
-- writes here, which is what keeps `role` out of a client's reach.

create view public_profiles as
  select id, display_name, avatar_url from users;

comment on view public_profiles is
  'Owned by the migration role and NOT security_invoker, so it reads users with '
  'RLS bypassed and exposes exactly three non-sensitive columns. This is the '
  'only sanctioned way for a client to resolve a display name.';

grant select on public_profiles to anon, authenticated;

create policy gov_officers_self_read on government_officers
  for select to authenticated using (user_id = auth.uid());
-- Colleagues in scope: needed for the assignment picker and the team view.
create policy gov_officers_scope_read on government_officers
  for select to authenticated
  using (auth.is_gov() and auth.in_gov_scope(jurisdiction_id));
create policy gov_officers_admin on government_officers
  for all to authenticated using (auth.is_admin()) with check (auth.is_admin());

comment on table government_officers is
  'No INSERT policy for GOVERNMENT. An officer cannot provision an officer; the '
  'claim flow runs through a security definer function that checks the roster, '
  'and admin approval is a separate, logged grant (0006).';

-- The roster is a government-supplied file containing names, designations,
-- emails and phone numbers of people who have no Swaram account. Admin only.
-- Individual users reach their own candidate row through
-- officer_claim_candidate(), which is security definer and returns at most two
-- rows so ambiguity can be detected and refused.
create policy roster_admin_all on officer_roster_records
  for all to authenticated using (auth.is_admin()) with check (auth.is_admin());

-- Read-only even for admins: role grants are the most security-sensitive event
-- in the system, and an audit trail its operator can rewrite is not one.
create policy role_grants_admin_read on role_grants_log
  for select to authenticated using (auth.is_admin());

-- ===========================================================================
-- 5. Issues
-- ===========================================================================

alter table issues enable row level security;

-- The public feed. Three conditions, all required:
--   visibility PUBLIC      -- RESTRICTED and CONFIDENTIAL are excluded here and
--                             surfaced (partially, or not at all) by the
--                             policies below
--   published_at not null  -- the safety gate has cleared it (PRD S20)
--   status <> 'HELD'       -- belt and braces; 0007 constrains these to agree,
--                             and a policy that depends on a CHECK constraint
--                             holding is a policy waiting for a migration to
--                             break it
create policy issues_public_read on issues
  for select to anon, authenticated
  using (visibility = 'PUBLIC' and published_at is not null and status <> 'HELD');

-- RESTRICTED: title and status are public, media and discussion are not. This
-- policy exposes the row; the child-table policies withhold the contents.
create policy issues_restricted_read on issues
  for select to anon, authenticated
  using (visibility = 'RESTRICTED' and published_at is not null);

-- Reporters always see their own, whatever the class and whatever the gate
-- decided. A citizen whose report is HELD must be able to watch it, or a hold
-- is indistinguishable from silent deletion.
create policy issues_own_read on issues
  for select to authenticated
  using (public.is_issue_reporter(id));

create policy issues_participant_read on issues
  for select to authenticated
  using (public.is_issue_participant(id));

-- Government sees its jurisdiction subtree INCLUDING CONFIDENTIAL. Confidential
-- issues lose the audience, not the accountability (PRD S03).
create policy issues_gov_read on issues
  for select to authenticated
  using (auth.is_gov() and auth.in_gov_scope(jurisdiction_id));

create policy issues_admin_read on issues
  for select to authenticated using (auth.is_admin());

-- Anyone signed in may create an issue, always. A submission is never blocked,
-- diverted or converted at submit time (PRD S03 hard rule). The columns a
-- citizen must not control are clamped by the guard trigger below, because RLS
-- cannot express column-level write rules.
create policy issues_insert on issues
  for insert to authenticated
  with check (created_by = auth.uid());

create policy issues_gov_update on issues
  for update to authenticated
  using (auth.app_role() = 'GOVERNMENT' and public.gov_scope_covers(jurisdiction_id))
  with check (auth.app_role() = 'GOVERNMENT' and public.gov_scope_covers(jurisdiction_id));

create policy issues_reporter_update on issues
  for update to authenticated
  using (public.is_issue_reporter(id))
  with check (public.is_issue_reporter(id));

create policy issues_admin_update on issues
  for all to authenticated
  using (auth.is_admin()) with check (auth.is_admin());

comment on table issues is
  'No DELETE policy for any role. Issues are never destroyed: account deletion '
  'anonymises reports rather than erasing the civic record (PRD S19), and a '
  'rejected or merged issue stays as a row so the redirect and the reason '
  'survive. Hard deletion is a service_role operation with a human behind it.';

-- RLS grants access to a ROW; it cannot restrict which COLUMNS of that row a
-- caller may change. So the column-level rules land here.
create or replace function guard_issue_write()
returns trigger language plpgsql as $$
declare
  v_role text := auth.app_role();
begin
  if tg_op = 'INSERT' then
    if v_role in ('GOVERNMENT', 'ADMIN') then
      return new;             -- officers may pre-set priority and assign (S10)
    end if;

    -- A citizen submitting a report decides none of this. Routing, priority
    -- and publication are the pipeline's job; letting the client propose them
    -- would let anyone file a CRITICAL, pre-published, self-assigned issue.
    new.status             := 'OPEN';
    new.priority           := 'MEDIUM';
    new.severity           := coalesce(new.severity, 'MEDIUM');
    new.published_at       := null;
    new.moderation_verdict := null;
    new.moderation_reviewed_by := null;
    new.owner_officer_id   := null;
    new.sla_due_at         := null;
    new.civic_pressure     := 0;
    new.satisfaction_score := null;
    new.report_count       := 0;
    new.follower_count     := 0;
    return new;
  end if;

  -- UPDATE.
  if v_role = 'ADMIN' then
    return new;
  end if;

  if v_role = 'GOVERNMENT' then
    -- Lowering a visibility class is a supervisor action (PRD S18). A ward
    -- officer may raise it but never lower it, and either way it is logged.
    if new.visibility < old.visibility
       and auth.juris_level() in ('WARD') then
      raise exception 'only a supervisor may lower an issue visibility class';
    end if;
    return new;
  end if;

  -- Citizen path: the reporter may raise the visibility class in one tap, and
  -- edit their own title/description. Nothing else, ever.
  if new.visibility < old.visibility then
    raise exception 'a reporter may raise an issue visibility class, never lower it';
  end if;

  new.status             := old.status;
  new.priority           := old.priority;
  new.severity           := old.severity;
  new.routing_tier       := old.routing_tier;
  new.jurisdiction_id    := old.jurisdiction_id;
  new.authority_id       := old.authority_id;
  new.department_id      := old.department_id;
  new.owner_officer_id   := old.owner_officer_id;
  new.published_at       := old.published_at;
  new.moderation_verdict := old.moderation_verdict;
  new.sla_due_at         := old.sla_due_at;
  new.civic_pressure     := old.civic_pressure;
  new.satisfaction_score := old.satisfaction_score;
  new.report_count       := old.report_count;
  new.follower_count     := old.follower_count;
  new.merged_into_id     := old.merged_into_id;
  new.created_by         := old.created_by;
  return new;
end $$;

comment on function guard_issue_write is
  'The column-level half of the issues security model. Note the enum ordering '
  'trick: issue_visibility is declared PUBLIC < RESTRICTED < CONFIDENTIAL in '
  '0002, so `new.visibility < old.visibility` is exactly "made it more public".';

create trigger issues_guard_write
  before insert or update on issues
  for each row execute function guard_issue_write();

-- ===========================================================================
-- 6. Reports and evidence
-- ===========================================================================

alter table reports        enable row level security;
alter table issue_evidence enable row level security;

-- Media and precise location are the private half of a RESTRICTED issue, so
-- reports use can_view_issue_detail rather than can_view_issue.
create policy reports_read on reports
  for select to anon, authenticated
  using (public.can_view_issue_detail(issue_id));

create policy reports_own_read on reports
  for select to authenticated using (user_id = auth.uid());

create policy reports_insert on reports
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_issue(issue_id));

-- Editable by the author only, and only their own row. Reports are evidence:
-- there is no policy allowing anyone to alter someone else's account of what
-- they saw.
create policy reports_own_update on reports
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reports_admin_all on reports
  for all to authenticated using (auth.is_admin()) with check (auth.is_admin());

create policy issue_evidence_read on issue_evidence
  for select to anon, authenticated
  using (public.can_view_issue_detail(issue_id));

-- Reporters upload INITIAL_REPORT evidence; participants (contractors, field
-- crew) upload PROGRESS and RESOLUTION. A contractor uploading evidence is the
-- whole point of scoped participation.
create policy issue_evidence_insert on issue_evidence
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (public.is_issue_reporter(issue_id)
         or public.is_issue_participant(issue_id)
         or public.gov_owns_issue(issue_id))
  );

create policy issue_evidence_admin on issue_evidence
  for all to authenticated using (auth.is_admin()) with check (auth.is_admin());

-- ===========================================================================
-- 7. Participants and transfers
-- ===========================================================================

alter table issue_participants enable row level security;
alter table issue_transfers    enable row level security;

-- The citizen sees a roster, not a list of strangers: only rows explicitly
-- marked public, on an issue they can see.
create policy issue_participants_public_read on issue_participants
  for select to anon, authenticated
  using (is_public and removed_at is null and public.can_view_issue(issue_id));

create policy issue_participants_self_read on issue_participants
  for select to authenticated using (user_id = auth.uid());

create policy issue_participants_gov_read on issue_participants
  for select to authenticated using (public.gov_owns_issue(issue_id));

-- Only government adds participants, and only on issues in its own scope. A
-- contractor cannot add another contractor.
create policy issue_participants_gov_write on issue_participants
  for insert to authenticated
  with check (public.gov_owns_issue(issue_id) and added_by = auth.uid());

create policy issue_participants_gov_update on issue_participants
  for update to authenticated
  using (public.gov_owns_issue(issue_id))
  with check (public.gov_owns_issue(issue_id));

create policy issue_participants_admin on issue_participants
  for all to authenticated using (auth.is_admin()) with check (auth.is_admin());

-- The transfer chain is a PUBLIC accountability log. That is its entire
-- purpose: a citizen must be able to see that their report was passed between
-- four departments in six weeks.
create policy issue_transfers_read on issue_transfers
  for select to anon, authenticated using (public.can_view_issue(issue_id));

create policy issue_transfers_gov_write on issue_transfers
  for insert to authenticated
  with check (public.gov_owns_issue(issue_id) and actor_id = auth.uid());

-- No update, no delete, for anyone. An accountability log that can be tidied up
-- is worth nothing.
create policy issue_transfers_admin_read on issue_transfers
  for select to authenticated using (auth.is_admin());

-- ===========================================================================
-- 8. Discussion
-- ===========================================================================

alter table comments        enable row level security;
alter table issue_followers enable row level security;
alter table issue_reactions enable row level security;
alter table flags           enable row level security;

-- PUBLIC comments on an issue the caller can see, minus the auto-hidden ones.
create policy comments_public_read on comments
  for select to anon, authenticated
  using (visibility = 'PUBLIC'
         and deleted_at is null
         and not is_hidden
         and public.can_view_issue_detail(issue_id));

-- INTERNAL comments are invisible to citizens AT THE POLICY LEVEL. This is the
-- requirement that made RLS non-negotiable: an officer writing "the contractor
-- is stalling, hold the payment" is writing to a table the citizen queries
-- directly. There is no client-side filter to forget, because there is no row
-- to filter.
create policy comments_internal_read on comments
  for select to authenticated
  using (visibility = 'INTERNAL'
         and deleted_at is null
         and (auth.is_admin() or public.gov_owns_issue(issue_id)));

create policy comments_own_read on comments
  for select to authenticated using (user_id = auth.uid());

-- Citizens may only post PUBLIC. An INTERNAL comment from a citizen would be
-- invisible to them the instant it was written, and would sit in the
-- department's private thread.
create policy comments_citizen_insert on comments
  for insert to authenticated
  with check (user_id = auth.uid()
              and visibility = 'PUBLIC'
              and not is_official
              and public.can_view_issue_detail(issue_id));

create policy comments_gov_insert on comments
  for insert to authenticated
  with check (user_id = auth.uid()
              and auth.is_gov()
              and public.gov_owns_issue(issue_id));

create policy comments_own_update on comments
  for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

create policy comments_moderator_update on comments
  for update to authenticated
  using (auth.is_admin() or public.gov_owns_issue(issue_id))
  with check (auth.is_admin() or public.gov_owns_issue(issue_id));

-- Who follows what is nobody else's business; the public number is
-- issues.follower_count.
create policy issue_followers_self on issue_followers
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy issue_followers_gov_read on issue_followers
  for select to authenticated using (public.gov_owns_issue(issue_id));

-- Support is a public signal -- "27 people are facing this" is the emotional
-- payload of the feed card, and it has to be countable by an anonymous reader.
create policy issue_reactions_read on issue_reactions
  for select to anon, authenticated using (public.can_view_issue(issue_id));

create policy issue_reactions_self_write on issue_reactions
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_issue(issue_id));

create policy issue_reactions_self_delete on issue_reactions
  for delete to authenticated using (user_id = auth.uid());

-- Anyone signed in may flag; nobody sees anyone else's flags. Visible flag
-- counts turn moderation into a brigading scoreboard.
create policy flags_insert on flags
  for insert to authenticated with check (reporter_id = auth.uid());

create policy flags_own_read on flags
  for select to authenticated using (reporter_id = auth.uid());

-- The moderation queue. Supervisors and admins only (PRD S18: officers can
-- flag, they cannot review).
create policy flags_moderator_all on flags
  for all to authenticated
  using (auth.is_admin()
         or (auth.app_role() = 'GOVERNMENT'
             and auth.juris_level() in ('ZONE','DISTRICT','STATE')))
  with check (auth.is_admin()
         or (auth.app_role() = 'GOVERNMENT'
             and auth.juris_level() in ('ZONE','DISTRICT','STATE')));

-- ===========================================================================
-- 9. Resolution and verification
-- ===========================================================================

alter table resolution_submissions enable row level security;
alter table verification_responses enable row level security;

-- What the authority claims it did is public. It is the record citizens are
-- being asked to judge.
create policy resolution_read on resolution_submissions
  for select to anon, authenticated using (public.can_view_issue(issue_id));

-- Only government files a resolution. A contractor uploads evidence
-- (issue_evidence) and the Owner accepts or rejects it -- the party paid to do
-- the work never certifies its own completion (PRD S10).
create policy resolution_gov_insert on resolution_submissions
  for insert to authenticated
  with check (public.gov_owns_issue(issue_id) and submitted_by = auth.uid());

create policy resolution_gov_update on resolution_submissions
  for update to authenticated
  using (public.gov_owns_issue(issue_id))
  with check (public.gov_owns_issue(issue_id));

create policy resolution_admin on resolution_submissions
  for all to authenticated using (auth.is_admin()) with check (auth.is_admin());

-- Everyone can see the result. That is the accountability output.
create policy verification_read on verification_responses
  for select to anon, authenticated using (public.can_view_issue(issue_id));

-- Only plausible witnesses may respond: reporters and followers of that issue
-- (PRD S03). Everyone else reads the breakdown and does not vote.
create policy verification_insert on verification_responses
  for insert to authenticated
  with check (user_id = auth.uid()
              and (public.is_issue_reporter(issue_id)
                   or public.is_issue_follower(issue_id))
              and exists (select 1 from resolution_submissions s
                           where s.id = resolution_submission_id
                             and s.verification_closed_at is null));

-- A verdict may be corrected while the window is open, never after it closes.
create policy verification_own_update on verification_responses
  for update to authenticated
  using (user_id = auth.uid()
         and exists (select 1 from resolution_submissions s
                      where s.id = resolution_submission_id
                        and s.verification_closed_at is null))
  with check (user_id = auth.uid());

create policy verification_admin on verification_responses
  for all to authenticated using (auth.is_admin()) with check (auth.is_admin());

-- ===========================================================================
-- 10. Audit, AI and operational tables
-- ===========================================================================

alter table issue_history  enable row level security;
alter table agent_runs     enable row level security;
alter table notifications  enable row level security;
alter table rate_limits    enable row level security;

-- The citizen status ladder. Readable with the issue, and by nobody else.
create policy issue_history_read on issue_history
  for select to anon, authenticated using (public.can_view_issue(issue_id));

-- No INSERT, UPDATE or DELETE policy for ANY role, admin included. Rows arrive
-- solely through log_issue_event(), which is security definer and only ever
-- called from a trigger. Append-only means append-only.

-- agent_runs.input holds the raw submission -- including the phone number the
-- REDACT verdict stripped from the published version. Exposing it to the
-- reporter would hand back the thing the safety gate just removed, and
-- exposing it to the public would undo the gate entirely. Government in scope
-- and admins only; the citizen-facing "AI trace" renders from the curated
-- output fields via a server-rendered page under the service role.
create policy agent_runs_gov_read on agent_runs
  for select to authenticated
  using (auth.is_admin()
         or (auth.is_gov() and issue_id is not null
             and public.gov_owns_issue(issue_id)));

-- Officers mark a run as overridden when they contradict it. Nothing else on
-- the row may change -- the input, output and confidence are the evidence.
create policy agent_runs_override on agent_runs
  for update to authenticated
  using (auth.is_gov() and issue_id is not null and public.gov_owns_issue(issue_id))
  with check (auth.is_gov() and was_overridden and overridden_by = auth.uid());

create policy notifications_self on notifications
  for select to authenticated using (user_id = auth.uid());
create policy notifications_self_update on notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- rate_limits gets RLS enabled and NO policies at all: default deny for every
-- client role. It is written exclusively by check_rate_limit(), which is
-- security definer. A rate limit a client can read is a rate limit a client can
-- plan around; one it can write is not a rate limit.

comment on table rate_limits is
  'RLS enabled, zero policies -- intentional. Only check_rate_limit() touches '
  'this table.';
