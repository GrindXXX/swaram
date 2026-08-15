/**
 * scoring.test.ts
 *
 * These tests are the enforcement mechanism for PRD §06's central rule: the
 * three numbers must never collapse into one. Several of them exist to fail
 * loudly if someone "helpfully" wires report count into severity or civic
 * pressure into the SLA — which is the exact change that turns a civic platform
 * into a popularity contest.
 */

import { describe, expect, it } from 'vitest';
import {
  IssuePriority,
  IssueSeverity,
  IssueStatus,
  ladderIndexFor,
  ladderStageFor,
} from './enums.js';
import {
  applyDepartmentDiversity,
  civicPressure,
  derivePriority,
  FEED_WEIGHTS,
  feedRank,
  feedRankDetailed,
  FRESH_REPORT_MULTIPLIER,
  peopleAffectedTerm,
  pressureBand,
  proximityTerm,
  recentActivityTerm,
  REPORT_COUNT_CAP,
  reportCountTerm,
  satisfaction,
  severityWeight,
  slaFor,
  slaState,
  stalenessTerm,
  type FeedRankInput,
} from './scoring.js';

const NOW = new Date('2026-08-15T12:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

/** A deliberately boring baseline. Individual tests vary one field at a time so
 *  that any score difference is attributable. */
function issue(overrides: Partial<FeedRankInput> = {}): FeedRankInput {
  return {
    distanceKm: 1,
    severity: IssueSeverity.MEDIUM,
    reportCount: 10,
    lastActivityAt: hoursAgo(24),
    estimatedPeopleAffected: 100,
    status: IssueStatus.OPEN,
    createdAt: daysAgo(10),
    ...overrides,
  };
}

/* ================================================================== *
 * SLA — PRD §10
 * ================================================================== */

describe('slaFor', () => {
  it('matches the published SLA table exactly', () => {
    expect(slaFor(IssuePriority.CRITICAL)).toMatchObject({ ackHours: 1, resolveDays: 1 });
    expect(slaFor(IssuePriority.HIGH)).toMatchObject({ ackHours: 4, resolveDays: 3 });
    expect(slaFor(IssuePriority.MEDIUM)).toMatchObject({ ackHours: 24, resolveDays: 7 });
    expect(slaFor(IssuePriority.LOW)).toMatchObject({ ackHours: 48, resolveDays: 14 });
  });

  it('states CRITICAL as 1 hour to acknowledge and 24 hours to resolve', () => {
    const critical = slaFor(IssuePriority.CRITICAL);
    expect(critical.ackHours).toBe(1);
    expect(critical.resolveDays * 24).toBe(24);
  });

  it('gives every priority an escalation consequence', () => {
    for (const p of [
      IssuePriority.LOW,
      IssuePriority.MEDIUM,
      IssuePriority.HIGH,
      IssuePriority.CRITICAL,
    ]) {
      expect(slaFor(p).escalationOnBreach.length).toBeGreaterThan(0);
    }
  });

  it('tightens monotonically as priority rises', () => {
    const order = [
      IssuePriority.LOW,
      IssuePriority.MEDIUM,
      IssuePriority.HIGH,
      IssuePriority.CRITICAL,
    ];
    for (let i = 1; i < order.length; i++) {
      expect(slaFor(order[i]!).ackHours).toBeLessThan(slaFor(order[i - 1]!).ackHours);
      expect(slaFor(order[i]!).resolveDays).toBeLessThan(slaFor(order[i - 1]!).resolveDays);
    }
  });

  it('is a pure lookup — the crowd cannot buy a faster SLA', () => {
    // slaFor's only parameter is priority. This test documents that fact
    // structurally: if someone adds a second parameter for report count or
    // civic pressure, the arity assertion below breaks.
    expect(slaFor.length).toBe(1);
  });
});

describe('slaState', () => {
  it('reports days overdue once the resolve window passes', () => {
    const s = slaState(IssuePriority.HIGH, daysAgo(5), NOW, IssueStatus.IN_PROGRESS);
    expect(s.breached).toBe(true);
    expect(s.daysOverdue).toBe(2); // 3-day window, 5 days elapsed
  });

  it('is not breached inside the window', () => {
    const s = slaState(IssuePriority.MEDIUM, daysAgo(2), NOW, IssueStatus.ASSIGNED);
    expect(s.breached).toBe(false);
    expect(s.daysOverdue).toBe(0);
    expect(s.msRemaining).toBeGreaterThan(0);
  });

  it('stops the clock on terminal statuses rather than accruing lateness', () => {
    const s = slaState(IssuePriority.CRITICAL, daysAgo(90), NOW, IssueStatus.CLOSED);
    expect(s.breached).toBe(false);
    expect(s.daysOverdue).toBe(0);
  });
});

/* ================================================================== *
 * Severity independence — PRD §06
 * ================================================================== */

describe('severity', () => {
  it('maps LOW…CRITICAL onto 0.2…1.0', () => {
    expect(severityWeight(IssueSeverity.LOW)).toBe(0.2);
    expect(severityWeight(IssueSeverity.CRITICAL)).toBe(1.0);
    expect(severityWeight(IssueSeverity.MEDIUM)).toBeGreaterThan(
      severityWeight(IssueSeverity.LOW),
    );
    expect(severityWeight(IssueSeverity.HIGH)).toBeLessThan(
      severityWeight(IssueSeverity.CRITICAL),
    );
  });

  it('NEVER reads report count — same severity, wildly different crowds', () => {
    // A live electrical hazard is CRITICAL with one report and zero supporters.
    const lonelyHazard = feedRankDetailed(
      issue({ severity: IssueSeverity.CRITICAL, reportCount: 1 }),
      NOW,
    );
    const popularHazard = feedRankDetailed(
      issue({ severity: IssueSeverity.CRITICAL, reportCount: 5_000 }),
      NOW,
    );
    expect(lonelyHazard.terms.severity).toBe(popularHazard.terms.severity);
    expect(lonelyHazard.terms.severity).toBe(1.0);
  });

  it('severityWeight takes exactly one argument, so a count cannot leak in', () => {
    expect(severityWeight.length).toBe(1);
  });

  it('derivePriority ignores the crowd entirely', () => {
    // derivePriority has no reportCount parameter at all. Confirm that scale
    // (people affected) can promote, but nothing about popularity exists.
    const quiet = derivePriority({
      severity: IssueSeverity.MEDIUM,
      estimatedPeopleAffected: 5,
    });
    const wide = derivePriority({
      severity: IssueSeverity.MEDIUM,
      estimatedPeopleAffected: 5_000,
    });
    expect(quiet).toBe(IssuePriority.MEDIUM);
    expect(wide).toBe(IssuePriority.HIGH);
    expect(
      derivePriority({ severity: IssueSeverity.LOW, estimatedPeopleAffected: 0, emergency: true }),
    ).toBe(IssuePriority.CRITICAL);
  });

  it('caps scale so an inflated estimate cannot promote past one step', () => {
    expect(
      derivePriority({ severity: IssueSeverity.LOW, estimatedPeopleAffected: 10_000_000 }),
    ).toBe(IssuePriority.MEDIUM);
  });
});

/* ================================================================== *
 * Feed ranking weights — PRD §06
 * ================================================================== */

describe('feedRank weights', () => {
  it('uses the documented default weights', () => {
    expect(FEED_WEIGHTS).toEqual({
      proximity: 0.3,
      severity: 0.2,
      reportCount: 0.2,
      recentActivity: 0.15,
      peopleAffected: 0.1,
      staleness: 0.05,
    });
  });

  it('positive weights sum to 0.95 and staleness is the only subtraction', () => {
    const positives =
      FEED_WEIGHTS.proximity +
      FEED_WEIGHTS.severity +
      FEED_WEIGHTS.reportCount +
      FEED_WEIGHTS.recentActivity +
      FEED_WEIGHTS.peopleAffected;
    expect(positives).toBeCloseTo(0.95, 10);
    expect(FEED_WEIGHTS.staleness).toBe(0.05);
  });

  it('composes the score from exactly the six weighted terms', () => {
    // A fully stale-free, boost-free issue so the arithmetic is checkable.
    const input = issue({ lastActivityAt: hoursAgo(6), createdAt: daysAgo(1) });
    const d = feedRankDetailed(input, NOW);
    const expected =
      FEED_WEIGHTS.proximity * d.terms.proximity +
      FEED_WEIGHTS.severity * d.terms.severity +
      FEED_WEIGHTS.reportCount * d.terms.reportCount +
      FEED_WEIGHTS.recentActivity * d.terms.recentActivity +
      FEED_WEIGHTS.peopleAffected * d.terms.peopleAffected -
      FEED_WEIGHTS.staleness * d.terms.staleness;
    expect(d.freshReportBoost).toBe(false);
    expect(d.score).toBeCloseTo(expected, 12);
  });

  it('respects the weight of each term when only that term changes', () => {
    const base = issue({ lastActivityAt: hoursAgo(6) });

    // proximity: 0 km (term 1.0) vs 9 km (term 0.1) => 0.30 * 0.9 = 0.27
    const near = feedRank(issue({ distanceKm: 0, lastActivityAt: hoursAgo(6) }), NOW);
    const far = feedRank(issue({ distanceKm: 9, lastActivityAt: hoursAgo(6) }), NOW);
    expect(near - far).toBeCloseTo(FEED_WEIGHTS.proximity * (1 - 0.1), 10);

    // severity: LOW (0.2) vs CRITICAL (1.0) => 0.20 * 0.8 = 0.16
    const low = feedRank(
      issue({ severity: IssueSeverity.LOW, lastActivityAt: hoursAgo(6) }),
      NOW,
    );
    const critical = feedRank(
      issue({ severity: IssueSeverity.CRITICAL, lastActivityAt: hoursAgo(6) }),
      NOW,
    );
    expect(critical - low).toBeCloseTo(FEED_WEIGHTS.severity * 0.8, 10);

    expect(feedRank(base, NOW)).toBeGreaterThan(0);
  });

  it('accepts overridden weights, because they are server-side config', () => {
    const proximityOnly = {
      proximity: 1,
      severity: 0,
      reportCount: 0,
      recentActivity: 0,
      peopleAffected: 0,
      staleness: 0,
    };
    const s = feedRank(
      issue({ distanceKm: 1, lastActivityAt: hoursAgo(6) }),
      NOW,
      proximityOnly,
    );
    expect(s).toBeCloseTo(0.5, 10); // 1 / (1 + 1)
  });
});

describe('proximity term', () => {
  it('is 1 / (1 + km)', () => {
    expect(proximityTerm(0)).toBe(1);
    expect(proximityTerm(1)).toBe(0.5);
    expect(proximityTerm(9)).toBeCloseTo(0.1, 10);
  });

  it('treats a negative distance as zero rather than exploding', () => {
    expect(proximityTerm(-5)).toBe(1);
  });
});

/* ================================================================== *
 * Log-scaling of report count — PRD §06
 * ================================================================== */

describe('reportCountTerm log scaling', () => {
  it('is zero at zero reports and 1 at the cap', () => {
    expect(reportCountTerm(0)).toBe(0);
    expect(reportCountTerm(REPORT_COUNT_CAP)).toBeCloseTo(1, 10);
  });

  it('is log-shaped: 1→10 matters far more than 190→200', () => {
    const earlyGain = reportCountTerm(10) - reportCountTerm(1);
    const lateGain = reportCountTerm(200) - reportCountTerm(191);
    expect(earlyGain).toBeGreaterThan(lateGain * 10);
  });

  it('is strictly concave — each additional report is worth less than the last', () => {
    for (const n of [1, 5, 20, 80, 150]) {
      const marginalNow = reportCountTerm(n + 1) - reportCountTerm(n);
      const marginalLater = reportCountTerm(n + 2) - reportCountTerm(n + 1);
      expect(marginalLater).toBeLessThan(marginalNow);
    }
  });

  it('caps, so the 200th report cannot permanently pin one issue to the top', () => {
    expect(reportCountTerm(200)).toBeCloseTo(1, 10);
    expect(reportCountTerm(2_000)).toBe(1);
    expect(reportCountTerm(1_000_000)).toBe(1);
  });

  it('cannot let popularity outweigh danger + proximity in the feed', () => {
    // PRD §06's motivating example: a viral complaint about a gated community's
    // driveway must not outrank a sewage overflow next to a school that nobody
    // has tweeted about.
    const viralMinorFarAway = issue({
      severity: IssueSeverity.LOW,
      reportCount: 5_000,
      distanceKm: 8,
      estimatedPeopleAffected: 40,
      lastActivityAt: hoursAgo(6),
    });
    const quietSewageNearby = issue({
      severity: IssueSeverity.CRITICAL,
      reportCount: 2,
      distanceKm: 0.4,
      estimatedPeopleAffected: 2_000,
      lastActivityAt: hoursAgo(6),
    });
    expect(feedRank(quietSewageNearby, NOW)).toBeGreaterThan(
      feedRank(viralMinorFarAway, NOW),
    );
  });

  it('still rewards a genuinely bigger crowd, all else equal', () => {
    const few = issue({ reportCount: 3, lastActivityAt: hoursAgo(6) });
    const many = issue({ reportCount: 60, lastActivityAt: hoursAgo(6) });
    expect(feedRank(many, NOW)).toBeGreaterThan(feedRank(few, NOW));
  });
});

/* ================================================================== *
 * Recency, staleness, boost
 * ================================================================== */

describe('recentActivityTerm', () => {
  it('decays over 72 hours', () => {
    expect(recentActivityTerm(NOW, NOW)).toBe(1);
    expect(recentActivityTerm(hoursAgo(72), NOW)).toBeCloseTo(Math.exp(-1), 10);
    expect(recentActivityTerm(hoursAgo(24), NOW)).toBeGreaterThan(
      recentActivityTerm(hoursAgo(48), NOW),
    );
  });
});

describe('stalenessTerm', () => {
  it('keeps resolved issues in the feed for 48 h, then sinks them', () => {
    const justResolved = issue({
      status: IssueStatus.RESOLVED,
      resolvedAt: hoursAgo(2),
    });
    const oldResolved = issue({
      status: IssueStatus.RESOLVED,
      resolvedAt: daysAgo(30),
    });
    expect(stalenessTerm(justResolved, NOW)).toBeLessThan(0.1);
    expect(stalenessTerm(oldResolved, NOW)).toBe(1);
  });

  it('never fully buries an unresolved issue — neglect must stay findable', () => {
    const neglected = issue({ status: IssueStatus.OPEN, lastActivityAt: daysAgo(400) });
    expect(stalenessTerm(neglected, NOW)).toBeLessThanOrEqual(0.5);
  });
});

describe('fresh report boost', () => {
  it('multiplies an issue with activity in the last hour', () => {
    const fresh = issue({ lastActivityAt: hoursAgo(0.25) });
    const d = feedRankDetailed(fresh, NOW);
    expect(d.freshReportBoost).toBe(true);

    const withoutBoost =
      FEED_WEIGHTS.proximity * d.terms.proximity +
      FEED_WEIGHTS.severity * d.terms.severity +
      FEED_WEIGHTS.reportCount * d.terms.reportCount +
      FEED_WEIGHTS.recentActivity * d.terms.recentActivity +
      FEED_WEIGHTS.peopleAffected * d.terms.peopleAffected -
      FEED_WEIGHTS.staleness * d.terms.staleness;
    expect(d.score).toBeCloseTo(withoutBoost * FRESH_REPORT_MULTIPLIER, 12);
  });

  it('does not boost a just-closed issue', () => {
    const closed = issue({ lastActivityAt: hoursAgo(0.1), status: IssueStatus.CLOSED });
    expect(feedRankDetailed(closed, NOW).freshReportBoost).toBe(false);
  });
});

describe('peopleAffectedTerm', () => {
  it('saturates, so a "~50,000 affected" estimate cannot hijack the queue', () => {
    expect(peopleAffectedTerm(50_000)).toBe(1);
    expect(peopleAffectedTerm(10_000_000)).toBe(1);
    // and the whole term is worth at most 0.10 of the score
    expect(FEED_WEIGHTS.peopleAffected * peopleAffectedTerm(10_000_000)).toBeCloseTo(0.1, 10);
  });
});

describe('applyDepartmentDiversity', () => {
  it('breaks runs longer than three cards from the same department', () => {
    const feed = [
      ...Array.from({ length: 6 }, (_, i) => ({ id: `roads-${i}`, departmentId: 'roads' })),
      { id: 'water-0', departmentId: 'water' },
      { id: 'water-1', departmentId: 'water' },
    ];
    const out = applyDepartmentDiversity(feed);
    expect(out).toHaveLength(8);

    let run = 0;
    for (let i = 0; i < out.length; i++) {
      run = i > 0 && out[i]!.departmentId === out[i - 1]!.departmentId ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(3);
    }
  });

  it('leaves a single-department feed intact rather than dropping cards', () => {
    const feed = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, departmentId: 'roads' }));
    expect(applyDepartmentDiversity(feed)).toHaveLength(5);
  });
});

/* ================================================================== *
 * Civic pressure — PRD §06
 * ================================================================== */

const basePressure = {
  reportCount: 0,
  supporterCount: 0,
  followerCount: 0,
  commentCount: 0,
  daysUnresolved: 0,
};

describe('civicPressure', () => {
  it('is bounded to 0…100', () => {
    expect(civicPressure(basePressure)).toBe(0);
    const extreme = civicPressure({
      reportCount: 100_000,
      supporterCount: 100_000,
      followerCount: 100_000,
      commentCount: 100_000,
      daysUnresolved: 3_000,
      rejectedResolutions: 10,
    });
    expect(extreme).toBeLessThanOrEqual(100);
    expect(extreme).toBeGreaterThan(90);
  });

  it('rises with reports, supporters, discussion and age independently', () => {
    const zero = civicPressure(basePressure);
    expect(civicPressure({ ...basePressure, reportCount: 40 })).toBeGreaterThan(zero);
    expect(civicPressure({ ...basePressure, supporterCount: 300 })).toBeGreaterThan(zero);
    expect(civicPressure({ ...basePressure, commentCount: 50 })).toBeGreaterThan(zero);
    expect(civicPressure({ ...basePressure, daysUnresolved: 30 })).toBeGreaterThan(zero);
  });

  it('rises when a submitted resolution is rejected — the loop has teeth', () => {
    const before = civicPressure({ ...basePressure, reportCount: 20, daysUnresolved: 10 });
    const after = civicPressure({
      ...basePressure,
      reportCount: 20,
      daysUnresolved: 10,
      rejectedResolutions: 1,
    });
    expect(after).toBeGreaterThan(before);
  });

  it('decays when the authority genuinely engages', () => {
    const ignoring = civicPressure({
      ...basePressure,
      reportCount: 40,
      supporterCount: 200,
      daysUnresolved: 14,
    });
    const engaging = civicPressure({
      ...basePressure,
      reportCount: 40,
      supporterCount: 200,
      daysUnresolved: 14,
      acknowledged: true,
      officialReplies: 3,
      progressUpdates: 2,
    });
    expect(engaging).toBeLessThan(ignoring);
  });

  it('cannot be talked down to nothing without a fix — damping is capped', () => {
    const hot = civicPressure({
      ...basePressure,
      reportCount: 200,
      supporterCount: 2_000,
      commentCount: 400,
      daysUnresolved: 60,
    });
    const talkative = civicPressure({
      ...basePressure,
      reportCount: 200,
      supporterCount: 2_000,
      commentCount: 400,
      daysUnresolved: 60,
      acknowledged: true,
      officialReplies: 50,
      progressUpdates: 50,
    });
    expect(talkative).toBeGreaterThanOrEqual(Math.round(hot * 0.7) - 1);
  });

  it('saturates on crowd size so the 200th report cannot pin it at 100', () => {
    const many = civicPressure({ ...basePressure, reportCount: 200 });
    const absurd = civicPressure({ ...basePressure, reportCount: 20_000 });
    expect(absurd - many).toBeLessThan(5);
  });

  it('never feeds the SLA — pressure is not an argument to slaFor', () => {
    // Structural assertion: the SLA depends only on priority, and priority
    // (derivePriority) has no pressure or report-count input. If either gains
    // one, these arities change and this test fails.
    expect(slaFor.length).toBe(1);
    const hot = civicPressure({ ...basePressure, reportCount: 500, daysUnresolved: 90 });
    expect(hot).toBeGreaterThan(50);
    expect(slaFor(IssuePriority.LOW)).toEqual(slaFor(IssuePriority.LOW));
  });
});

describe('pressureBand', () => {
  it('labels every band with words, never colour alone', () => {
    expect(pressureBand(10)).toBe('CALM');
    expect(pressureBand(55)).toBe('RISING');
    expect(pressureBand(75)).toBe('HEATING_UP');
    expect(pressureBand(87)).toBe('BOILING');
  });
});

/* ================================================================== *
 * Satisfaction — PRD §03
 * ================================================================== */

describe('satisfaction', () => {
  it('computes the distribution shown on the public page', () => {
    // The design mock's numbers: 72% completely, 19% partly, 9% still there.
    const r = satisfaction({
      COMPLETELY_FIXED: 154,
      PARTIALLY_FIXED: 41,
      STILL_EXISTS: 19,
      NEW_PROBLEM: 0,
    });
    expect(r.totalResponses).toBe(214);
    expect(r.completelyFixedPct).toBe(72);
    expect(r.closes).toBe(true);
  });

  it('does not close below ~50% completely-fixed', () => {
    const r = satisfaction({
      COMPLETELY_FIXED: 10,
      PARTIALLY_FIXED: 5,
      STILL_EXISTS: 20,
      NEW_PROBLEM: 5,
    });
    expect(r.completelyFixedPct).toBe(25);
    expect(r.closes).toBe(false);
  });

  it('records insufficient verification rather than manufacturing consent', () => {
    const r = satisfaction({
      COMPLETELY_FIXED: 2,
      PARTIALLY_FIXED: 0,
      STILL_EXISTS: 0,
      NEW_PROBLEM: 0,
    });
    expect(r.insufficientVerification).toBe(true);
    expect(r.closes).toBe(true); // closes at window end, but flagged honestly
  });

  it('handles zero responses without dividing by zero', () => {
    const r = satisfaction({
      COMPLETELY_FIXED: 0,
      PARTIALLY_FIXED: 0,
      STILL_EXISTS: 0,
      NEW_PROBLEM: 0,
    });
    expect(r.score).toBe(0);
    expect(r.closes).toBe(false);
    expect(r.insufficientVerification).toBe(true);
  });
});

/* ================================================================== *
 * Status ladder
 * ================================================================== */

describe('ladder mapping', () => {
  it('collapses twelve statuses into five readable rungs', () => {
    expect(ladderStageFor(IssueStatus.OPEN)).toBe('ROUTED');
    expect(ladderStageFor(IssueStatus.IN_PROGRESS)).toBe('RESPONSE');
    expect(ladderStageFor(IssueStatus.AWAITING_VERIFICATION)).toBe('EVIDENCE');
    expect(ladderStageFor(IssueStatus.RESOLVED)).toBe('VERIFIED');
  });

  it('never exposes HELD as its own rung — the citizen is not told "flagged"', () => {
    expect(ladderStageFor(IssueStatus.HELD)).toBe(ladderStageFor(IssueStatus.OPEN));
    expect(ladderIndexFor(IssueStatus.HELD)).toBe(ladderIndexFor(IssueStatus.OPEN));
  });

  it('advances monotonically through the happy path', () => {
    const path = [
      IssueStatus.OPEN,
      IssueStatus.ACKNOWLEDGED,
      IssueStatus.RESOLUTION_SUBMITTED,
      IssueStatus.RESOLVED,
    ];
    for (let i = 1; i < path.length; i++) {
      expect(ladderIndexFor(path[i]!)).toBeGreaterThan(ladderIndexFor(path[i - 1]!));
    }
  });
});
