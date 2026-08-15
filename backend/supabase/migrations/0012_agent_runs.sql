-- 0012_agent_runs.sql
-- The AI audit trail (PRD S13 transparency, S20 safety logging).
--
-- Every model call writes a row here before its output is acted on. Three
-- consumers depend on it and none of them can be reconstructed after the fact:
--   * the citizen-facing AI trace ("Routed -> Roads - 94%"),
--   * the admin quality view, where OVERRIDE RATE -- not self-reported
--     confidence -- is the honest measure of whether an agent is useful,
--   * evaluation data, since every human overturn is a labelled example.
--
-- This table is append-only by convention and by policy (0016). A quality
-- metric computed from a table the system can edit is not a metric.

create table agent_runs (
  id          bigserial primary key,
  agent_name  text not null,          -- 'intake' | 'cluster' | 'verify' | 'safety'
  issue_id    uuid references issues(id) on delete set null,
  report_id   uuid references reports(id) on delete set null,

  -- The exact prompt payload and the exact structured response. Stored whole:
  -- a summarised input cannot reproduce a bad decision, and reproducing bad
  -- decisions is the entire point.
  input       jsonb not null,
  output      jsonb,
  error       text,                   -- populated when status = 'FAILED'

  -- Self-reported. A signal, never a guarantee, and never the quality metric.
  confidence  numeric(4,3) check (confidence between 0 and 1),
  model       text not null,          -- exact model id, for regression bisects
  prompt_version text,
  latency_ms  int check (latency_ms >= 0),

  status      text not null default 'SUCCESS'
              check (status in ('SUCCESS','FAILED','TIMEOUT','SKIPPED')),

  -- Set later, by the officer action that contradicted this run. This is the
  -- column the admin dashboard actually ranks on.
  was_overridden boolean not null default false,
  overridden_by  uuid references users(id),
  overridden_at  timestamptz,
  override_reason text,

  created_at  timestamptz not null default now()
);

comment on column agent_runs.was_overridden is
  'Written when a human changes what this run decided -- re-routing a category, '
  'splitting a merge, overturning a HOLD. Rising override rate per agent is a '
  'regression alarm; confidence is only a signal.';

comment on column agent_runs.status is
  'FAILED and TIMEOUT rows are kept. Report ingestion survives AI outages '
  '(PRD S19): the issue is created regardless, and the failed run is the '
  'evidence of why it landed in the unrouted triage queue.';

create index agent_runs_issue_idx  on agent_runs (issue_id);
create index agent_runs_report_idx on agent_runs (report_id);
-- Backs mv_agent_quality, which groups by agent and day.
create index agent_runs_agent_day_idx
  on agent_runs (agent_name, date_trunc('day', created_at at time zone 'UTC'));
-- The "AI unsure" saved view: intake confidence < 0.80, oldest first.
create index agent_runs_low_confidence_idx on agent_runs (created_at)
  where confidence < 0.80;
create index agent_runs_overridden_idx on agent_runs (agent_name, overridden_at)
  where was_overridden;
