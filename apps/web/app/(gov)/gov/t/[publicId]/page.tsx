import Link from 'next/link';
import { notFound } from 'next/navigation';
import { displayDate, getGovIssue, slaLabel } from '@/lib/gov';
import { postReply, startIssue, submitResolution } from '../../actions';

type Props = { params: { publicId: string }; searchParams: { success?: string; error?: string } };

export default async function GovernmentTicketPage({ params, searchParams }: Props) {
  const { data: issue, error } = await getGovIssue(params.publicId);
  if (!issue && !error) notFound();
  if (!issue) return <main className="sw-sect"><Link className="sw-btn" href="/gov">Back to queue</Link><div className="sw-note sw-alarm" style={{ marginTop: 20 }}><strong>Live record unavailable</strong>{error}</div></main>;
  const canStart = issue.routing_tier === 'ONBOARDED' && ['OPEN', 'ASSIGNED', 'ACKNOWLEDGED', 'REOPENED'].includes(issue.status);
  const canResolve = ['IN_PROGRESS', 'ACKNOWLEDGED', 'REOPENED'].includes(issue.status);
  return <main className="sw-scroll">
    <header className="sw-head"><div><Link className="sw-sub" href="/gov">← Operational queue</Link><h1>{issue.public_id}</h1></div><span className="sw-pill" data-tone={issue.status === 'IN_PROGRESS' ? 'gov' : 'muted'}>{issue.status.replaceAll('_', ' ')}</span></header>
    {(searchParams.success || searchParams.error) && <div className="sw-sect"><div className={`sw-note ${searchParams.error ? 'sw-alarm' : ''}`}><strong>{searchParams.error ? 'Action not completed' : 'Record updated'}</strong>{searchParams.error ?? searchParams.success}</div></div>}
    <section className="sw-sect"><div className="sw-sub">{issue.department ?? 'Unrouted'} · {issue.jurisdiction ?? 'Jurisdiction pending'}</div><h2 className="sw-stamp" style={{ fontSize: 26, margin: '10px 0' }}>{issue.title}</h2><p>{issue.description ?? 'No operational summary has been recorded.'}</p></section>
    <div className="sw-split">
      <div>
        <section className="sw-sect"><h2 className="sw-stamp">Public response</h2><p className="sw-micro" style={{ margin: '6px 0 12px' }}>Published with the official government badge. This cannot be converted to an internal note.</p>
          <form className="sw-composer" data-vis="PUBLIC" action={postReply}><input type="hidden" name="publicId" value={issue.public_id} /><div className="sw-visbanner">Public · official reply</div><div style={{ padding: 12 }}><textarea className="sw-textarea" name="content" minLength={2} required placeholder="State what has happened, what happens next, and when citizens should expect an update." /><button className="sw-btn" data-variant="primary" type="submit">Publish official reply</button></div></form>
          <div style={{ marginTop: 18 }}>{issue.comments.map((comment) => <article className="sw-msg" data-vis={comment.visibility} key={comment.id}><div className="sw-msg-meta">{comment.is_official ? 'Official · ' : ''}{comment.author}<span>{displayDate(comment.created_at)}</span></div><div className="sw-msg-body">{comment.content}</div></article>)}</div>
        </section>
        <section className="sw-sect"><h2 className="sw-stamp">Activity record</h2><ol className="sw-time" style={{ marginTop: 16 }}>{issue.history.map((entry) => <li data-actor={entry.actor_type.toLowerCase()} key={entry.id}><div className="when">{displayDate(entry.created_at)} · {entry.actor_type}</div><div className="what">{entry.action.replaceAll('_', ' ')}{entry.new_value ? ` → ${entry.new_value.replaceAll('_', ' ')}` : ''}</div></li>)}</ol></section>
      </div>
      <aside>
        <section className="sw-sect"><dl className="sw-dl"><dt>Priority</dt><dd>{issue.priority}</dd><dt>Reports</dt><dd>{issue.report_count}</dd><dt>Owner</dt><dd>{issue.owner ?? 'No named owner'}</dd><dt>Routing</dt><dd>{issue.routing_tier}</dd><dt>SLA</dt><dd>{slaLabel(issue)}</dd><dt>Pressure</dt><dd>{issue.civic_pressure}/100</dd><dt>Address</dt><dd>{issue.address ?? 'Not recorded'}</dd></dl>
          {issue.routing_tier !== 'ONBOARDED' && <div className="sw-note" style={{ marginTop: 12 }}><strong>No fabricated accountability</strong>This tier has no Swaram SLA or assigned owner.</div>}
          <form action={startIssue} style={{ marginTop: 12 }}><input type="hidden" name="publicId" value={issue.public_id} /><button className="sw-btn" data-variant="primary" disabled={!canStart} type="submit">Start work · in progress</button></form>
        </section>
        <section className="sw-sect"><h2 className="sw-stamp">Submit resolution</h2><p className="sw-micro" style={{ margin: '6px 0 12px' }}>This opens community verification. It does not mark the issue resolved.</p>
          <form action={submitResolution}><input type="hidden" name="publicId" value={issue.public_id} /><label className="sw-field"><span>Action taken</span><textarea className="sw-textarea" name="actionTaken" minLength={5} required disabled={!canResolve} /></label><label className="sw-field"><span>Citizen inspection note</span><textarea className="sw-textarea" name="intent" disabled={!canResolve} /></label><label className="sw-field"><span>Resolution photo URL</span><input className="sw-input" name="photoUrl" type="url" disabled={!canResolve} /></label><button className="sw-btn" data-variant="primary" disabled={!canResolve} type="submit">Open verification</button></form>
          {issue.resolutions.map((resolution) => <div className="sw-box" style={{ marginTop: 12 }} key={resolution.id}><div className="sw-label">Attempt {resolution.attempt} · {displayDate(resolution.submitted_at)}</div><p style={{ marginTop: 6 }}>{resolution.action_taken}</p></div>)}
        </section>
      </aside>
    </div>
  </main>;
}
