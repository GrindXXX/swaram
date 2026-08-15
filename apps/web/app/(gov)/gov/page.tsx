import Link from 'next/link';
import { getGovQueue, slaLabel } from '@/lib/gov';
import { signOut } from './actions';

const active = (status: string) => ['OPEN', 'ASSIGNED', 'ACKNOWLEDGED', 'REOPENED'].includes(status);

export default async function GovernmentQueuePage() {
  const { data: issues, error } = await getGovQueue();
  const overdue = issues.filter((issue) => issue.routing_tier === 'ONBOARDED' && issue.sla_due_at && new Date(issue.sla_due_at) < new Date()).length;
  const awaiting = issues.filter((issue) => issue.status === 'AWAITING_VERIFICATION').length;
  return (
    <div className="sw-shell" data-panes="2">
      <aside className="sw-pane sw-nav">
        <div className="sw-masthead"><div className="t">SWARAM</div><div className="s">GOVERNMENT OPERATIONS</div><div className="d">LIVE CIVIC RECORD</div></div>
        <div className="sw-navgroup">
          <Link className="sw-navitem" aria-current="page" href="/gov">Operational queue <span className="sw-count">{issues.length}</span></Link>
        </div>
        <div className="sw-colophon">Scope is enforced by active officer posting, department, jurisdiction, and database policy.<form action={signOut}><button className="sw-btn" style={{ marginTop: 12 }} type="submit">Sign out</button></form></div>
      </aside>
      <main className="sw-pane sw-scroll">
        <header className="sw-head"><div><div className="sw-sub">Phase 0 · live queue</div><h1>Government desk</h1></div><span className="sw-pill" data-tone="gov">RLS scoped</span></header>
        <section className="sw-kpis" aria-label="Queue summary">
          <div><div className="n">{issues.filter((i) => active(i.status)).length}</div><div className="k">Open work</div></div>
          <div><div className="n">{issues.filter((i) => i.status === 'IN_PROGRESS').length}</div><div className="k">In progress</div></div>
          <div><div className="n sw-rage">{overdue}</div><div className="k">Overdue</div></div>
          <div><div className="n">{awaiting}</div><div className="k">Awaiting verify</div></div>
          <div><div className="n">{issues.reduce((n, i) => n + i.report_count, 0)}</div><div className="k">Citizen reports</div></div>
        </section>
        {error && <div className="sw-sect"><div className="sw-note sw-alarm"><strong>Live data unavailable</strong>{error} No sample records are shown.</div></div>}
        {!error && issues.length === 0 && <div className="sw-empty"><div className="sw-stamp">Queue clear</div><p>No issues are visible in your active posting.</p></div>}
        {issues.length > 0 && <div style={{ overflowX: 'auto' }}><table className="sw-queue">
          <thead><tr><th>ID / issue</th><th>Status</th><th>Priority</th><th>Reports</th><th>Owner</th><th>SLA</th><th>Department</th></tr></thead>
          <tbody>{issues.map((issue) => {
            const breached = issue.routing_tier === 'ONBOARDED' && issue.sla_due_at && new Date(issue.sla_due_at) < new Date();
            return <tr className="sw-row" data-overdue={breached ? '1' : undefined} key={issue.id}>
              <td><Link className="sw-linkrow" href={`/gov/t/${issue.public_id}`}><span className="id">{issue.public_id}</span><div className="ttl">{issue.title}</div><span className="sw-micro">{issue.jurisdiction ?? 'Jurisdiction pending'}</span></Link></td>
              <td><span className="sw-pill" data-tone={issue.status === 'IN_PROGRESS' ? 'gov' : 'muted'}>{issue.status.replaceAll('_', ' ')}</span></td>
              <td><span className="sw-pill" data-tone={issue.priority === 'CRITICAL' ? 'rage' : 'muted'}>{issue.priority}</span></td>
              <td>{issue.report_count}</td><td>{issue.owner ?? 'Unassigned'}</td>
              <td className="sla" data-breach={breached ? '1' : undefined} data-none={issue.routing_tier !== 'ONBOARDED' ? '1' : undefined}>{slaLabel(issue)}</td>
              <td>{issue.department ?? 'Unrouted'}</td>
            </tr>;
          })}</tbody>
        </table></div>}
      </main>
    </div>
  );
}
