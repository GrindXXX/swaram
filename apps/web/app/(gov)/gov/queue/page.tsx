import Link from 'next/link';
import { getQueue } from '@/lib/queries/queue';
import { VIEWS, FIXTURE_NOW } from '@/components/gov/fixtures';
import type { QueueIssue, SavedView } from '@/components/gov/types';

export const metadata = { title: 'Queue — Swaram Gov' };

function relative(iso: string | null, now: Date): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - now.getTime();
  const abs = Math.abs(ms);
  const hours = abs / 3_600_000;
  const label = hours < 24 ? `${Math.round(hours)}h` : `${Math.round(hours / 24)}d`;
  return ms < 0 ? `${label} ago` : `in ${label}`;
}

export default async function QueuePage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const view = (VIEWS.find((v) => v.slug === searchParams.view)?.slug ?? 'all') as SavedView;
  const rows = await getQueue(view);
  const activeSpec = VIEWS.find((v) => v.slug === view)!;

  return (
    <>
      <div className="sw-head">
        <div>
          <h1>Queue</h1>
          <div className="sw-sub">{activeSpec.blurb}</div>
        </div>
        <span className="sw-count">{rows.length} issues</span>
      </div>

      <div className="sw-tabs" role="tablist">
        {VIEWS.map((v) => (
          <Link
            key={v.slug}
            href={v.slug === 'all' ? '/gov/queue' : `/gov/queue?view=${v.slug}`}
            className="sw-tab"
            role="tab"
            aria-selected={v.slug === view}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="sw-empty">
          <div className="sw-stamp">Nothing here</div>
          No issues match &ldquo;{activeSpec.label}&rdquo; right now.
        </div>
      ) : (
        <table className="sw-queue">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Reports</th>
              <th>Owner</th>
              <th style={{ textAlign: 'right' }}>SLA</th>
              <th style={{ textAlign: 'right' }}>Activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <QueueRow key={row.id} issue={row} />
            ))}
          </tbody>
        </table>
      )}
      <div className="sw-hint">Sorted {activeSpec.sort.replace('-', ' · ')} · RLS-scoped to your jurisdiction, not filtered client-side.</div>
    </>
  );
}

function QueueRow({ issue }: { issue: QueueIssue }) {
  const overdue = issue.sla_due_at !== null && new Date(issue.sla_due_at) < FIXTURE_NOW;
  return (
    <tr className="sw-row" data-overdue={overdue ? '1' : undefined}>
      <td className="id">{issue.public_id}</td>
      <td className="ttl">
        <Link href={`/gov/t/${issue.public_id}`} className="sw-linkrow">
          {issue.title}
        </Link>
      </td>
      <td>
        <span className="sw-pill" data-tone={statusTone(issue.status)}>{issue.status.replace(/_/g, ' ')}</span>
      </td>
      <td>
        <span className="sw-pill" data-tone={issue.priority === 'HIGH' || issue.priority === 'CRITICAL' ? 'rage' : 'muted'}>
          {issue.priority}
        </span>
      </td>
      <td className="sw-tnum">{issue.report_count}</td>
      <td>{issue.owner ?? <span className="sw-faded">unassigned</span>}</td>
      <td className="sla" data-breach={overdue ? '1' : undefined} data-none={issue.sla_due_at === null ? '1' : undefined}>
        {relative(issue.sla_due_at, FIXTURE_NOW)}
      </td>
      <td style={{ textAlign: 'right' }} className="sw-micro">{relative(issue.last_activity_at, FIXTURE_NOW)}</td>
    </tr>
  );
}

function statusTone(status: QueueIssue['status']): 'rage' | 'ok' | 'gov' | 'muted' | 'solid' {
  switch (status) {
    case 'OPEN':
    case 'REOPENED':
      return 'rage';
    case 'RESOLVED':
    case 'CLOSED':
      return 'ok';
    case 'ASSIGNED':
    case 'ACKNOWLEDGED':
      return 'gov';
    default:
      return 'muted';
  }
}
