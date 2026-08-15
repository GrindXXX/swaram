-- 0002_enums.sql
-- Every closed vocabulary in the system, in one file.
--
-- These are Postgres enums rather than text+check so that `supabase gen types
-- typescript` emits real union types. The cost is that adding a value needs
-- ALTER TYPE ... ADD VALUE (which cannot run inside a transaction block in
-- older PG); the benefit is that the app and the workers cannot drift.

-- Account-level role. Exactly three (PRD S18). Officer vs supervisor is a
-- *scope* difference expressed by government_officers.jurisdiction_level,
-- not a separate role.
create type app_role as enum ('CITIZEN', 'GOVERNMENT', 'ADMIN');

-- Issue lifecycle. Reconciled from PRD S03 and schema/ticket.schema.json:
--   ticket.schema 'acknowledged'      -> adopted (SLA measures ack separately)
--   ticket.schema 'disputed_closure'  -> mapped to REOPENED
--   ticket.schema 'escalated'         -> not a status; see escalation_level
create type issue_status as enum (
  'OPEN',                   -- created and routed, no named owner yet
  'ASSIGNED',               -- owned, not started
  'ACKNOWLEDGED',           -- owner has seen it (SLA ack stop)
  'IN_PROGRESS',
  'HELD',                   -- safety gate withheld from the feed, still routed
  'RESOLUTION_SUBMITTED',   -- authority filed evidence
  'AWAITING_VERIFICATION',  -- citizens judging
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'REJECTED',
  'MERGED'
);

create type issue_severity as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
create type issue_priority as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- PRD S03: what the public may see. Fails safe -- the intake agent defaults
-- safety-related categories to CONFIDENTIAL and a human must downgrade.
create type issue_visibility as enum ('PUBLIC', 'RESTRICTED', 'CONFIDENTIAL');

-- PRD S03: precision and publicity of location are independent axes.
create type location_precision as enum ('POINT', 'AREA', 'JURISDICTION');
create type location_visibility as enum ('EXACT', 'APPROXIMATE', 'PRIVATE');

-- PRD S12: the product must work in all three. UNMAPPED is a valid outcome,
-- never an error.
create type routing_tier as enum ('ONBOARDED', 'CONTACTABLE', 'UNMAPPED');

-- PRD S12: scale escalation, a separate ladder from SLA escalation.
create type escalation_level as enum
  ('LOCAL', 'WARD', 'CITY', 'DISTRICT', 'STATE', 'NATIONAL');

create type jurisdiction_level as enum
  ('STATE', 'DISTRICT', 'ULB', 'ZONE', 'WARD');

-- PRD S10/S18: many participants, exactly one OWNER (enforced in 0009).
create type participant_role as enum (
  'OWNER', 'ASSIGNEE', 'CONTRACTOR', 'FIELD_CREW',
  'SUPERVISOR', 'REPRESENTATIVE', 'OBSERVER'
);

create type comment_visibility as enum ('PUBLIC', 'INTERNAL');

create type evidence_type as enum ('INITIAL_REPORT', 'PROGRESS', 'RESOLUTION');

-- PRD S03: the community verdict is a distribution, not a boolean.
create type verification_verdict as enum
  ('COMPLETELY_FIXED', 'PARTIALLY_FIXED', 'STILL_EXISTS', 'NEW_PROBLEM');

-- PRD S20: five verdicts from the pre-publication safety gate.
create type moderation_verdict as enum
  ('CLEAR', 'REDACT', 'HOLD', 'EMERGENCY', 'REJECT');

-- D4: only VERIFIED authorities may be contacted automatically.
create type verification_status as enum
  ('VERIFIED', 'SCRAPED_UNVERIFIED', 'DRAFT');

-- How a pin became a jurisdiction. Anything other than POLYGON is a
-- degraded match and must be surfaced, never silently trusted.
create type jurisdiction_match_method as enum
  ('POLYGON', 'CENTROID_FALLBACK', 'GEOCODE_FALLBACK', 'MANUAL', 'NONE');

create type media_type as enum ('PHOTO', 'VIDEO', 'AUDIO', 'NONE');

create type report_source as enum ('CITIZEN_APP', 'OFFICER', 'IMPORT');

create type transfer_action as enum
  ('received', 'forwarded', 'resolved', 'reopened');
