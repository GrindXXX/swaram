/* ============================================================================
   ███  FIXTURE DATA — NOT REAL.  ███
   ---------------------------------------------------------------------------
   Everything in this file is hand-authored sample data so the government
   surface renders and is demoable before the DB lands. It is consumed ONLY by
   lib/queries/{queue,dashboard}.ts, and only as a fallback when the Supabase
   query throws or returns nothing. Nothing here should ever be imported by a
   page directly.

   Shapes are taken from technical-plan.html §11 and product-requirements.html
   §10 / §18 / §03, and the vocabularies from 0002_enums.sql.

   TIME: every timestamp is relative to FIXTURE_NOW, a FIXED instant, so the
   server and client render identical SLA strings (no hydration drift) and the
   demo looks the same every run.
   ========================================================================== */
import type {
  QueueIssue,
  TicketDetail,
  GovKpis,
  ViewSpec,
  SavedView,
} from './types';

/** Fixed "now" for the demo: 15 Aug 2026, 09:00 IST. */
export const FIXTURE_NOW = new Date('2026-08-15T09:00:00+05:30');

const h = (n: number) => new Date(FIXTURE_NOW.getTime() + n * 3_600_000).toISOString();
const d = (n: number) => h(n * 24);

export const OFFICER = {
  id: 'off-kiran',
  name: 'Officer Kiran M.',
  designation: 'Assistant Engineer',
  department: 'Roads',
  department_id: 4,
  jurisdiction: 'Ward 42 · Whitefield',
  jurisdiction_id: 4212,
  jurisdiction_level: 'WARD',
  /** field-mode origin */
  lat: 12.9698,
  lng: 77.7499,
};

/* -------------------------------------------------------------------------- */
/* Saved views — filters over ONE table, never folders (§10, tech §11.1)      */
/* -------------------------------------------------------------------------- */
export const VIEWS: ViewSpec[] = [
  { slug: 'my-work',          label: 'My work',         blurb: 'owner is me',                              sort: 'sla-asc' },
  { slug: 'unassigned',       label: 'Unassigned',      blurb: 'no named owner yet',                       sort: 'pressure-desc' },
  { slug: 'overdue',          label: 'Overdue',         blurb: 'SLA breached · Tier 1 only',               sort: 'most-overdue' },
  { slug: 'awaiting-verify',  label: 'Awaiting verify', blurb: 'citizens are judging the resolution',      sort: 'submitted-asc' },
  { slug: 'suggested-merges', label: 'Suggested merges',blurb: 'cluster confidence 0.75–0.90',             sort: 'confidence-desc' },
  { slug: 'ai-unsure',        label: 'AI unsure',       blurb: 'intake confidence below 0.80',             sort: 'created-asc' },
  { slug: 'all',              label: 'All open',        blurb: 'everything in this jurisdiction',          sort: 'sla-asc' },
];

/* -------------------------------------------------------------------------- */
/* The queue                                                                  */
/* -------------------------------------------------------------------------- */
type Seed = Partial<QueueIssue> & Pick<QueueIssue, 'public_id' | 'title' | 'status' | 'priority'>;

const seed = (s: Seed, i: number): QueueIssue => ({
  id: `iss-${s.public_id}`,
  severity: 'MEDIUM',
  department: 'Roads',
  jurisdiction: 'Ward 42 · Whitefield',
  routing_tier: 'ONBOARDED',
  owner: OFFICER.name,
  owner_id: OFFICER.id,
  report_count: 1,
  follower_count: 0,
  civic_pressure: 40,
  sla_due_at: h(48),
  created_at: d(-4),
  last_activity_at: h(-6),
  lat: 12.9698 + (i % 7) * 0.004 - 0.012,
  lng: 77.7499 + (i % 5) * 0.005 - 0.010,
  intake_confidence: 0.94,
  cluster_confidence: null,
  cluster_parent_public_id: null,
  ...s,
} as QueueIssue);

const SEEDS: Seed[] = [
  /* --- breached, Tier 1. These are the top of the default sort. --- */
  { public_id: 'CIV-10291', title: 'Road caved in near the culvert, 3rd Cross', status: 'IN_PROGRESS', priority: 'CRITICAL',
    severity: 'CRITICAL', sla_due_at: h(-53), report_count: 9, follower_count: 22, civic_pressure: 88,
    created_at: d(-6), last_activity_at: h(-31), intake_confidence: 0.97 },
  { public_id: 'CIV-10188', title: 'Live wire hanging over the footpath outside the school', status: 'ASSIGNED', priority: 'CRITICAL',
    severity: 'CRITICAL', department: 'Electricity', sla_due_at: h(-19), report_count: 3, follower_count: 41, civic_pressure: 94,
    created_at: d(-2), last_activity_at: h(-14), intake_confidence: 0.99 },
  { public_id: 'CIV-10342', title: 'Sewage overflow beside the anganwadi', status: 'ACKNOWLEDGED', priority: 'HIGH',
    severity: 'HIGH', department: 'Water', sla_due_at: h(-8), report_count: 14, follower_count: 30, civic_pressure: 79,
    created_at: d(-5), last_activity_at: h(-9) },
  { public_id: 'CIV-10360', title: 'Manhole cover missing, Whitefield Main Rd', status: 'OPEN', priority: 'HIGH',
    severity: 'HIGH', owner: null, owner_id: null, sla_due_at: h(-3), report_count: 6, follower_count: 11, civic_pressure: 71,
    created_at: d(-3), last_activity_at: h(-3) },

  /* --- live Tier 1 clock --- */
  { public_id: 'CIV-10234', title: 'Large pothole, Whitefield Main Rd', status: 'IN_PROGRESS', priority: 'HIGH',
    severity: 'HIGH', sla_due_at: h(71), report_count: 27, follower_count: 41, civic_pressure: 76,
    created_at: d(-7), last_activity_at: h(-4), intake_confidence: 0.96 },
  { public_id: 'CIV-10402', title: 'Construction debris blocking the service lane', status: 'OPEN', priority: 'MEDIUM',
    owner: null, owner_id: null, sla_due_at: h(26), report_count: 4, follower_count: 6, civic_pressure: 44,
    created_at: d(-1), last_activity_at: h(-1) },
  { public_id: 'CIV-10321', title: 'Speed breaker damaged near the bus stop', status: 'ASSIGNED', priority: 'MEDIUM',
    sla_due_at: h(140), report_count: 2, follower_count: 3, civic_pressure: 28, created_at: d(-2), last_activity_at: h(-20) },
  { public_id: 'CIV-10377', title: 'Streetlight out for eleven nights, 8th Main', status: 'ASSIGNED', priority: 'MEDIUM',
    department: 'Electricity', sla_due_at: h(96), report_count: 11, follower_count: 18, civic_pressure: 63,
    created_at: d(-11), last_activity_at: h(-27) },
  { public_id: 'CIV-10415', title: 'Footpath slabs broken outside the clinic', status: 'ASSIGNED', priority: 'LOW',
    sla_due_at: h(230), report_count: 2, follower_count: 1, civic_pressure: 19, created_at: d(-2), last_activity_at: h(-40) },

  /* --- unassigned, no named owner yet --- */
  { public_id: 'CIV-10433', title: 'Storm drain choked with silt, Kundalahalli junction', status: 'OPEN', priority: 'HIGH',
    owner: null, owner_id: null, sla_due_at: h(38), report_count: 8, follower_count: 12, civic_pressure: 67,
    created_at: h(-30), last_activity_at: h(-2) },
  { public_id: 'CIV-10441', title: 'Illegal garbage dump beside the lake bund', status: 'OPEN', priority: 'MEDIUM',
    department: 'Sanitation', owner: null, owner_id: null, sla_due_at: h(59), report_count: 19, follower_count: 26,
    civic_pressure: 72, created_at: h(-40), last_activity_at: h(-5) },
  { public_id: 'CIV-10448', title: 'Traffic signal stuck on red at ITPL gate', status: 'OPEN', priority: 'HIGH',
    department: 'Transport', owner: null, owner_id: null, sla_due_at: h(11), report_count: 5, follower_count: 9,
    civic_pressure: 58, created_at: h(-14), last_activity_at: h(-1) },

  /* --- awaiting community verification (§03) --- */
  { public_id: 'CIV-10344', title: 'Water stagnating outside 12th Cross for a fortnight', status: 'AWAITING_VERIFICATION',
    priority: 'HIGH', department: 'Water', sla_due_at: null, report_count: 16, follower_count: 21, civic_pressure: 55,
    created_at: d(-19), last_activity_at: h(-56) },
  { public_id: 'CIV-10298', title: 'Broken railing on the pedestrian overbridge', status: 'AWAITING_VERIFICATION',
    priority: 'MEDIUM', sla_due_at: null, report_count: 7, follower_count: 8, civic_pressure: 39,
    created_at: d(-24), last_activity_at: h(-88) },
  { public_id: 'CIV-10250', title: 'Open transformer box at the park entrance', status: 'RESOLUTION_SUBMITTED',
    priority: 'CRITICAL', department: 'Electricity', sla_due_at: null, report_count: 12, follower_count: 17,
    civic_pressure: 68, created_at: d(-21), last_activity_at: h(-12) },

  /* --- suggested merges: cluster confidence in the 0.75–0.90 band --- */
  { public_id: 'CIV-10451', title: 'Pothole at Whitefield Main Rd, near the petrol pump', status: 'OPEN', priority: 'MEDIUM',
    owner: null, owner_id: null, sla_due_at: h(64), report_count: 3, follower_count: 2, civic_pressure: 33,
    cluster_confidence: 0.88, cluster_parent_public_id: 'CIV-10234', created_at: h(-20), last_activity_at: h(-4) },
  { public_id: 'CIV-10456', title: 'Bad road surface opposite the Main Rd bakery', status: 'OPEN', priority: 'LOW',
    owner: null, owner_id: null, sla_due_at: h(180), report_count: 1, follower_count: 0, civic_pressure: 14,
    cluster_confidence: 0.79, cluster_parent_public_id: 'CIV-10234', created_at: h(-9), last_activity_at: h(-9) },
  { public_id: 'CIV-10459', title: 'Drain overflow near the anganwadi lane', status: 'OPEN', priority: 'HIGH',
    department: 'Water', owner: null, owner_id: null, sla_due_at: h(30), report_count: 2, follower_count: 4,
    civic_pressure: 47, cluster_confidence: 0.81, cluster_parent_public_id: 'CIV-10342',
    created_at: h(-16), last_activity_at: h(-3) },

  /* --- AI unsure: intake confidence < 0.80 --- */
  { public_id: 'CIV-10462', title: 'Something leaking from the ground near the temple wall', status: 'OPEN',
    priority: 'MEDIUM', owner: null, owner_id: null, sla_due_at: h(52), report_count: 1, follower_count: 1,
    civic_pressure: 21, intake_confidence: 0.61, created_at: h(-11), last_activity_at: h(-11) },
  { public_id: 'CIV-10465', title: 'Noise and dust from a site — unclear which department', status: 'OPEN',
    priority: 'LOW', department: 'Unrouted', owner: null, owner_id: null, sla_due_at: h(200), report_count: 2,
    follower_count: 0, civic_pressure: 17, intake_confidence: 0.48, created_at: h(-6), last_activity_at: h(-6) },
  { public_id: 'CIV-10468', title: 'Voice report, Kannada — transcript partly inaudible', status: 'OPEN',
    priority: 'MEDIUM', owner: null, owner_id: null, sla_due_at: h(44), report_count: 1, follower_count: 0,
    civic_pressure: 12, intake_confidence: 0.72, created_at: h(-4), last_activity_at: h(-4) },

  /* --- TIER 2 / TIER 3: NO SLA. Never a countdown, never a breach. (§12) --- */
  { public_id: 'CIV-10470', title: 'Village road washed out after the rain, Hoskote taluk', status: 'OPEN',
    priority: 'HIGH', department: 'PWD (State)', jurisdiction: 'Hoskote · District', routing_tier: 'CONTACTABLE',
    owner: null, owner_id: null, sla_due_at: null, report_count: 6, follower_count: 4, civic_pressure: 52,
    created_at: d(-8), last_activity_at: h(-50) },
  { public_id: 'CIV-10474', title: 'Water supply failed for four days, Panchayat ward 3', status: 'OPEN',
    priority: 'CRITICAL', department: 'State water board', jurisdiction: 'Devanahalli · District',
    routing_tier: 'CONTACTABLE', owner: null, owner_id: null, sla_due_at: null, report_count: 23,
    follower_count: 15, civic_pressure: 85, created_at: d(-4), last_activity_at: h(-70) },
  { public_id: 'CIV-10477', title: 'Bridge approach eroding, no authority mapped', status: 'OPEN',
    priority: 'HIGH', department: 'Unmapped', jurisdiction: 'Anekal · District', routing_tier: 'UNMAPPED',
    owner: null, owner_id: null, sla_due_at: null, report_count: 4, follower_count: 3, civic_pressure: 49,
    created_at: d(-13), last_activity_at: d(-13) },

  /* --- closed-ish tail --- */
  { public_id: 'CIV-10120', title: 'Pothole cluster on 5th Main resurfaced', status: 'RESOLVED', priority: 'MEDIUM',
    sla_due_at: null, report_count: 31, follower_count: 12, civic_pressure: 22, created_at: d(-38), last_activity_at: d(-9) },
  { public_id: 'CIV-10101', title: 'Streetlight pole leaning after the storm', status: 'CLOSED', priority: 'HIGH',
    department: 'Electricity', sla_due_at: null, report_count: 5, follower_count: 2, civic_pressure: 10,
    created_at: d(-52), last_activity_at: d(-20) },
  { public_id: 'CIV-10199', title: 'Garbage not collected — recurring, reopened by residents', status: 'REOPENED',
    priority: 'HIGH', department: 'Sanitation', sla_due_at: h(20), report_count: 18, follower_count: 24,
    civic_pressure: 74, created_at: d(-30), last_activity_at: h(-16) },
  { public_id: 'CIV-10480', title: 'Complaint naming a private resident — withheld from the feed', status: 'HELD',
    priority: 'LOW', owner: null, owner_id: null, sla_due_at: h(120), report_count: 1, follower_count: 0,
    civic_pressure: 8, intake_confidence: 0.91, created_at: h(-5), last_activity_at: h(-5) },
];

export const QUEUE: QueueIssue[] = SEEDS.map(seed);

/* -------------------------------------------------------------------------- */
/* KPI strip — the shape gov_kpis() returns, precomputed from QUEUE           */
/* -------------------------------------------------------------------------- */
export const GOV_KPIS: GovKpis = {
  open:            QUEUE.filter((i) => i.status === 'OPEN' || i.status === 'ASSIGNED').length,
  in_progress:     QUEUE.filter((i) => i.status === 'IN_PROGRESS').length,
  // Tier 2/3 excluded by construction: their sla_due_at is null.
  overdue:         QUEUE.filter((i) => i.sla_due_at !== null && new Date(i.sla_due_at) < FIXTURE_NOW
                      && i.status !== 'RESOLVED' && i.status !== 'CLOSED').length,
  awaiting_verify: QUEUE.filter((i) => i.status === 'AWAITING_VERIFICATION').length,
  resolved_30d:    120,
};

/* -------------------------------------------------------------------------- */
/* Ticket detail                                                              */
/* -------------------------------------------------------------------------- */
const REPORTS_10234 = [
  { id: 'r1', reporter: 'Anonymous', description: 'Huge pothole right where the buses pull in. Two scooters went down this week.', transcript: null, media_type: 'PHOTO' as const, lat: 12.9701, lng: 77.7502, created_at: d(-7), source: 'CITIZEN_APP' as const },
  { id: 'r2', reporter: 'Anonymous', description: 'Same pit. It has doubled since the rain on Tuesday.', transcript: null, media_type: 'PHOTO' as const, lat: 12.9700, lng: 77.7503, created_at: d(-5), source: 'CITIZEN_APP' as const },
  { id: 'r3', reporter: 'R. Devi', description: 'Voice note in Kannada, transcribed.', transcript: 'The road in front of the bakery has broken completely. My mother fell here yesterday evening.', media_type: 'AUDIO' as const, lat: 12.9699, lng: 77.7500, created_at: d(-4), source: 'CITIZEN_APP' as const },
  { id: 'r4', reporter: 'Anonymous', description: 'Water collects in it and you cannot see how deep it is at night.', transcript: null, media_type: 'PHOTO' as const, lat: 12.9702, lng: 77.7499, created_at: d(-2), source: 'CITIZEN_APP' as const },
  { id: 'r5', reporter: 'Officer Kiran M.', description: 'Site inspection. Measured 1.8 m across, 22 cm deep. Base layer has failed, not a surface patch job.', transcript: null, media_type: 'PHOTO' as const, lat: 12.9700, lng: 77.7501, created_at: d(-1), source: 'OFFICER' as const },
];

export const TICKETS: Record<string, TicketDetail> = {
  'CIV-10234': {
    ...QUEUE.find((i) => i.public_id === 'CIV-10234')!,
    description:
      'Failure of the base layer across roughly two metres of the northbound carriageway outside 214 Whitefield Main Road, immediately at the bus pull-in. Standing water after rain conceals the depth. 27 separate reports over seven days.',
    address: '214 Whitefield Main Rd, opposite Sri Bakery, Ward 42',
    escalation_level: 'WARD',
    sla_ack_due_at: d(-7),
    acknowledged_at: d(-6),
    satisfaction_score: null,
    reports: REPORTS_10234,
    participants: [
      { id: 'p1', name: 'Officer Kiran M.', org: null, designation: 'Assistant Engineer, Roads', role: 'OWNER',       is_public: true,  added_by: 'System (routing)',   added_reason: 'Ward 42 Roads duty roster', added_at: d(-6) },
      { id: 'p2', name: 'S. Ramesh',        org: null, designation: 'Junior Engineer',          role: 'ASSIGNEE',    is_public: true,  added_by: 'Officer Kiran M.',   added_reason: 'Site supervision',          added_at: d(-5) },
      { id: 'p3', name: 'ABC Infra Pvt Ltd',org: 'ABC Infra Pvt Ltd', designation: null,        role: 'CONTRACTOR',  is_public: true,  added_by: 'Officer Kiran M.',   added_reason: 'Annual resurfacing contract WD/42/26', added_at: d(-3) },
      { id: 'p4', name: 'Crew 7',           org: 'ABC Infra Pvt Ltd', designation: null,        role: 'FIELD_CREW',  is_public: false, added_by: 'ABC Infra Pvt Ltd',  added_reason: 'Assigned crew',             added_at: d(-3) },
      { id: 'p5', name: 'Smt. L. Prakash',  org: null, designation: 'Corporator, Ward 42',      role: 'REPRESENTATIVE', is_public: true, added_by: 'Officer Kiran M.', added_reason: 'Constituency issue, requested updates', added_at: d(-2) },
      { id: 'p6', name: 'Zone Engineer (East)', org: null, designation: 'Executive Engineer',   role: 'SUPERVISOR',  is_public: false, added_by: 'System (SLA watch)', added_reason: 'Priority HIGH escalation path', added_at: d(-6) },
    ],
    comments: [
      { id: 'c1', author: 'Officer Kiran M.', author_kind: 'OFFICIAL', visibility: 'PUBLIC',
        content: 'Inspected on site this morning. This is a base-layer failure, not a surface patch — it needs a cut-and-fill. Work order raised with the ward contractor; expect machinery on site within two working days.', created_at: d(-5) },
      { id: 'c2', author: 'Officer Kiran M.', author_kind: 'OFFICIAL', visibility: 'INTERNAL',
        content: 'Bitumen allocation for August is nearly exhausted. If the zone office does not release the balance by Friday we will slip the SLA. Flagging early rather than at breach.', created_at: d(-5) },
      { id: 'c3', author: 'ABC Infra Pvt Ltd', author_kind: 'CONTRACTOR', visibility: 'INTERNAL',
        content: 'Crew 7 can start Thursday 06:00. We need the lane closed on the northbound side for four hours — traffic police intimation needed from the department.', created_at: d(-3) },
      { id: 'c4', author: 'Smt. L. Prakash', author_kind: 'REPRESENTATIVE', visibility: 'PUBLIC',
        content: 'Residents have raised this with me repeatedly. Requesting the department to treat it on priority.', created_at: d(-2) },
      { id: 'c5', author: 'Officer Kiran M.', author_kind: 'OFFICIAL', visibility: 'PUBLIC',
        content: 'Update: lane closure cleared with traffic police for Thursday morning. Barricades go up Wednesday night.', created_at: h(-4) },
    ],
    evidence: [
      { id: 'e1', type: 'INITIAL_REPORT', caption: 'Citizen photo — pothole at the bus pull-in',       uploaded_by: 'Anonymous',          lat: 12.9701, lng: 77.7502, captured_at: d(-7) },
      { id: 'e2', type: 'INITIAL_REPORT', caption: 'Citizen photo — standing water after rain',        uploaded_by: 'Anonymous',          lat: 12.9700, lng: 77.7503, captured_at: d(-5) },
      { id: 'e3', type: 'INITIAL_REPORT', caption: 'Officer site photo with measuring staff',          uploaded_by: 'Officer Kiran M.',   lat: 12.9700, lng: 77.7501, captured_at: d(-1) },
      { id: 'e4', type: 'PROGRESS',       caption: 'Barricades in place, northbound lane',             uploaded_by: 'Crew 7',             lat: 12.9700, lng: 77.7501, captured_at: h(-6) },
    ],
    activity: [
      { id: 'a1', actor: 'System',           actor_type: 'SYSTEM',  action: 'Issue created from citizen report',            detail: 'Report r1', created_at: d(-7) },
      { id: 'a2', actor: 'Intake agent',     actor_type: 'AI',      action: 'Classified · Roads › Pothole',                 detail: 'Surface defect, arterial road', agent_name: 'intake', confidence: 0.96, was_overridden: false, created_at: d(-7) },
      { id: 'a3', actor: 'Router',           actor_type: 'SYSTEM',  action: 'Jurisdiction · Ward 42 (POLYGON match)',        detail: 'Routing tier ONBOARDED', created_at: d(-7) },
      { id: 'a4', actor: 'Intake agent',     actor_type: 'AI',      action: 'Priority · HIGH',                              detail: 'Arterial road, injury reported', agent_name: 'intake', confidence: 0.88, was_overridden: false, created_at: d(-7) },
      { id: 'a5', actor: 'Clustering agent', actor_type: 'AI',      action: 'Merged 3 duplicate issues',                    detail: 'CIV-10240, CIV-10247, CIV-10255', agent_name: 'cluster', confidence: 0.93, was_overridden: false, created_at: d(-6) },
      { id: 'a6', actor: 'Officer Kiran M.', actor_type: 'OFFICER', action: 'Acknowledged · owner accepted',                detail: 'SLA acknowledgement stop at 21h', created_at: d(-6) },
      { id: 'a7', actor: 'Officer Kiran M.', actor_type: 'OFFICER', action: 'Status → IN_PROGRESS',                         detail: null, created_at: d(-5) },
      { id: 'a8', actor: 'Officer Kiran M.', actor_type: 'OFFICER', action: 'Added participant · ABC Infra (CONTRACTOR)',   detail: 'Reason: annual resurfacing contract WD/42/26', created_at: d(-3) },
      { id: 'a9', actor: 'Clustering agent', actor_type: 'AI',      action: 'Suggested merge · CIV-10451 at 0.88',          detail: 'Awaiting officer approval', agent_name: 'cluster', confidence: 0.88, was_overridden: false, created_at: h(-20) },
      { id: 'a10', actor: '41 citizens',     actor_type: 'CITIZEN', action: 'Following · 27 reports on record',             detail: null, created_at: h(-4) },
    ],
    transfers: [
      { id: 't1', from_authority: null,                     to_authority: 'BBMP Ward 42 · Roads',      action: 'received',  reason: null,                                                     actor: 'System (routing)',   created_at: d(-7) },
      { id: 't2', from_authority: 'BBMP Ward 42 · Roads',   to_authority: 'BBMP East Zone · Roads',    action: 'forwarded', reason: 'Base-layer failure exceeds ward works ceiling',           actor: 'Officer Kiran M.',   created_at: d(-6) },
      { id: 't3', from_authority: 'BBMP East Zone · Roads', to_authority: 'BBMP Ward 42 · Roads',      action: 'received',  reason: 'Returned with sanction; execution stays with the ward',    actor: 'Zone Engineer (East)', created_at: d(-5) },
    ],
    ai_runs: [
      { agent_name: 'intake',  output: 'Roads › Pothole',      confidence: 0.96, was_overridden: false },
      { agent_name: 'intake',  output: 'Priority HIGH',        confidence: 0.88, was_overridden: false },
      { agent_name: 'cluster', output: 'Merged 3 duplicates',  confidence: 0.93, was_overridden: false },
      { agent_name: 'intake',  output: 'Safety verdict CLEAR', confidence: 0.99, was_overridden: false },
    ],
  },
};

/** Any public_id not hand-authored gets a serviceable detail record built from
 *  its queue row, so every /gov/t/[publicId] link in the demo resolves. */
export function synthesiseTicket(row: QueueIssue): TicketDetail {
  const base = TICKETS['CIV-10234'];
  return {
    ...row,
    description:
      `${row.title}. ${row.report_count} report${row.report_count === 1 ? '' : 's'} on record from ${row.jurisdiction}. ` +
      (row.routing_tier === 'ONBOARDED'
        ? 'Routed to an onboarded officer; the SLA clock is running.'
        : row.routing_tier === 'CONTACTABLE'
          ? 'No officer account exists for this authority. A formatted grievance was emailed to the registry contact — there is no SLA clock and none is shown.'
          : 'No authority contact exists for this jurisdiction. The issue is published, clustered and counted; its function is public pressure and evidence.'),
    address: `${row.jurisdiction}, near ${row.lat.toFixed(4)}, ${row.lng.toFixed(4)}`,
    escalation_level: 'WARD',
    sla_ack_due_at: row.sla_due_at,
    acknowledged_at: row.status === 'OPEN' ? null : row.created_at,
    satisfaction_score: row.status === 'RESOLVED' ? 72 : null,
    participants: row.owner
      ? [base.participants[0], base.participants[5]]
      : [],
    reports: REPORTS_10234.slice(0, Math.max(1, Math.min(row.report_count, 4))).map((r, i) => ({
      ...r, id: `${row.public_id}-r${i}`, description: i === 0 ? row.title : r.description,
    })),
    comments: base.comments.slice(0, 2),
    evidence: base.evidence.slice(0, 2),
    activity: [
      { id: 'x1', actor: 'System',       actor_type: 'SYSTEM', action: 'Issue created from citizen report', detail: null, created_at: row.created_at },
      { id: 'x2', actor: 'Intake agent', actor_type: 'AI',     action: `Classified · ${row.department}`,
        detail: row.intake_confidence < 0.8 ? 'Low confidence — queued to the AI-unsure view for a human decision' : null,
        agent_name: 'intake', confidence: row.intake_confidence, was_overridden: false, created_at: row.created_at },
      { id: 'x3', actor: 'Router', actor_type: 'SYSTEM', action: `Routing tier · ${row.routing_tier}`,
        detail: row.routing_tier === 'ONBOARDED' ? null : 'No SLA clock started', created_at: row.created_at },
      ...(row.cluster_confidence
        ? [{ id: 'x4', actor: 'Clustering agent', actor_type: 'AI' as const,
             action: `Suggested merge into ${row.cluster_parent_public_id}`,
             detail: 'Confidence in the review band (0.75–0.90) — needs an officer decision',
             agent_name: 'cluster', confidence: row.cluster_confidence, was_overridden: false, created_at: row.last_activity_at }]
        : []),
    ],
    transfers: [
      { id: 'y1', from_authority: null, to_authority: `${row.jurisdiction} · ${row.department}`,
        action: 'received', reason: null, actor: 'System (routing)', created_at: row.created_at },
    ],
    ai_runs: [
      { agent_name: 'intake', output: row.department, confidence: row.intake_confidence, was_overridden: false },
      ...(row.cluster_confidence
        ? [{ agent_name: 'cluster', output: `Merge → ${row.cluster_parent_public_id}`, confidence: row.cluster_confidence, was_overridden: false }]
        : []),
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* Saved-view predicates — the ONE table, filtered. Used by lib/queries/queue  */
/* -------------------------------------------------------------------------- */
export const TERMINAL: string[] = ['RESOLVED', 'CLOSED', 'REJECTED', 'MERGED'];

export function applyView(rows: QueueIssue[], view: SavedView, meId = OFFICER.id, now = FIXTURE_NOW): QueueIssue[] {
  switch (view) {
    case 'my-work':
      return rows.filter((r) => r.owner_id === meId && !TERMINAL.includes(r.status));
    case 'unassigned':
      return rows.filter((r) => r.owner_id === null && !TERMINAL.includes(r.status));
    case 'overdue':
      // Tier 2/3 carry sla_due_at === null and are therefore structurally excluded.
      return rows.filter((r) => r.sla_due_at !== null && new Date(r.sla_due_at) < now && !TERMINAL.includes(r.status));
    case 'awaiting-verify':
      return rows.filter((r) => r.status === 'AWAITING_VERIFICATION' || r.status === 'RESOLUTION_SUBMITTED');
    case 'suggested-merges':
      return rows.filter((r) => r.cluster_confidence !== null && r.cluster_confidence >= 0.75 && r.cluster_confidence <= 0.90);
    case 'ai-unsure':
      return rows.filter((r) => r.intake_confidence < 0.80);
    default:
      return rows.filter((r) => !TERMINAL.includes(r.status));
  }
}
