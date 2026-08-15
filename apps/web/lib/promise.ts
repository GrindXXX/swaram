import type { IssueSummary } from './types';
import { slaLabel, shortAge } from './format';

/**
 * What we may honestly promise the citizen about this issue.
 *
 * ── THE HARD RULE (PRD §12) ────────────────────────────────────────────────
 * "Never fabricate an assignee or an SLA. A countdown against a department
 *  that has never heard of Swaram is a lie to the citizen and the fastest way
 *  to lose them."
 *
 * There are roughly 129 named officer contacts for the whole country. An SLA
 * countdown is only truthful for tier ONBOARDED. Everything else says what
 * actually happened: sent, or published and waiting.
 *
 * Every surface that wants to render a deadline MUST go through this function.
 * There is no other path to an SLA string in the citizen app.
 */

export type PromiseLine = {
  /** Short line for the feed card / list row. */
  short: string;
  /** Longer line for the issue page's status ladder. */
  long: string;
  /** True only when a real clock is running and has been blown. */
  breached: boolean;
  /** True only when a real countdown is being shown. */
  hasClock: boolean;
  tone: 'rage' | 'ember' | 'resolved' | 'gov' | 'neutral' | 'ink';
};

export function promiseFor(issue: IssueSummary, now: Date = new Date()): PromiseLine {
  const terminal =
    issue.status === 'RESOLVED' || issue.status === 'CLOSED' || issue.status === 'MERGED';

  if (terminal) {
    return {
      short: issue.status === 'MERGED' ? 'Combined with a larger issue' : 'Closed',
      long:
        issue.status === 'MERGED'
          ? 'This report was combined with others into one issue.'
          : 'This issue is closed.',
      breached: false,
      hasClock: false,
      tone: issue.status === 'MERGED' ? 'neutral' : 'resolved',
    };
  }

  switch (issue.routingTier) {
    /* Tier 1 — a real officer account exists. A real clock may run. */
    case 'ONBOARDED': {
      if (!issue.slaDueAt) {
        return {
          short: 'Routing',
          long: 'Being routed to the right officer.',
          breached: false,
          hasClock: false,
          tone: 'ink',
        };
      }
      const { text, breached } = slaLabel(issue.slaDueAt, now);
      return {
        short: breached ? `SLA ${text}` : `SLA ${text}`,
        long: breached
          ? `Past the promised date by ${text.replace(' overdue', '')}. The supervisor has been notified.`
          : `The department has committed to a response ${text}.`,
        breached,
        hasClock: true,
        tone: breached ? 'rage' : 'gov',
      };
    }

    /* Tier 2 — we have a grievance contact, but nobody is logged in.
       No countdown. No assignee. Just what we did and when. */
    case 'CONTACTABLE': {
      const to = issue.authorityName ?? 'the listed authority';
      if (!issue.dispatchedAt) {
        return {
          short: 'Sending · no reply yet',
          long: `Being sent to ${to}. No one from that office is on Swaram yet, so there is no response deadline to show you.`,
          breached: false,
          hasClock: false,
          tone: 'neutral',
        };
      }
      return {
        short: 'Sent · awaiting response',
        long: `Sent to ${to} ${shortAge(issue.dispatchedAt, now)} ago. No one from that office is on Swaram yet, so we cannot promise you a date — we will show their reply here the moment it arrives.`,
        breached: false,
        hasClock: false,
        tone: 'neutral',
      };
    }

    /* Tier 3 — jurisdiction known, no contact at all. Not a failure: this is
       the evidence pile that argues for onboarding that body. */
    case 'UNMAPPED':
    default:
      return {
        short: 'Published · no authority contact yet',
        long: `We know this belongs to ${issue.jurisdiction}, but we do not yet have a working contact there. Your report is public, counted and building the case — it is not sitting in a queue that does not exist.`,
        breached: false,
        hasClock: false,
        tone: 'neutral',
      };
  }
}

/** Plain-language promise shown at *report* time (PRD §12: coverage is a
 *  first-class product surface — "we'll notify the Ward 42 Roads officer" and
 *  "we'll email the state grievance cell" are different promises). */
export function coveragePromise(tier: 'ONBOARDED' | 'CONTACTABLE' | 'UNMAPPED', authority: string) {
  switch (tier) {
    case 'ONBOARDED':
      return {
        title: 'An officer will see this',
        body: `${authority} is on Swaram. Your report lands in their queue with a response deadline attached.`,
        tone: 'gov' as const,
      };
    case 'CONTACTABLE':
      return {
        title: "We'll email the grievance cell",
        body: `Nobody from ${authority} is on Swaram yet, so we send a formatted grievance to their registered contact and show you what comes back. We will not invent a deadline for them.`,
        tone: 'neutral' as const,
      };
    case 'UNMAPPED':
      return {
        title: 'This goes on the public record',
        body: `We have no working contact for ${authority} yet. Your report is published, counted and clustered with others — that record is what gets an authority onboarded.`,
        tone: 'neutral' as const,
      };
  }
}
