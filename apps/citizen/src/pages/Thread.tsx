import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Avatar } from '../components/ui/Avatar';
import { RageMeter } from '../components/ui/RageMeter';
import { StatTile } from '../components/ui/StatTile';
import { PhotoPlaceholder } from '../components/ui/PhotoPlaceholder';
import { GovBuildingIcon, ShieldCheckIcon, ChevronLeftIcon, ShareIcon } from '../components/ui/Icons';
import { issues } from '../lib/mock-data';

export function Thread() {
  const { id } = useParams();
  const navigate = useNavigate();
  const issue = issues.find((i) => i.id === id) ?? issues[0];
  const initials = issue.authorHandle.replace('Citizen #', '');

  const composer = (
    <div className="safe-bottom flex items-center gap-2.5 border-t border-border-strong bg-paper-chip px-4 pb-4 pt-3">
      <div className="flex-1 rounded-full border border-border-strong bg-paper px-4 py-3 font-mono text-[12.5px] text-muted-soft">
        Add to this thread…
      </div>
      <button className="min-h-[48px] rounded-full bg-ink px-5 font-mono text-[12.5px] font-bold text-paper">Me too</button>
    </div>
  );

  return (
    <AppShell nav={false} footer={composer}>
      <header className="flex items-center justify-between border-b border-border px-4 pb-3 pt-2">
        <button onClick={() => navigate(-1)} className="text-muted-strong">
          <ChevronLeftIcon size={22} />
        </button>
        <span className="font-mono text-[13px] font-bold">Thread</span>
        <ShareIcon size={22} className="text-muted-strong" />
      </header>

      <div className="px-4 pb-4 pt-4">
        <div className="flex items-center gap-3">
          <Avatar initials={initials} size={46} />
          <div>
            <div className="font-mono text-[13px] font-bold">{issue.authorHandle}</div>
            <div className="mt-0.5 font-mono text-[11px] text-muted">
              {issue.city} · {issue.ward} · {issue.filedOn}
            </div>
          </div>
        </div>

        <h2 className="mt-3.5 font-display text-2xl leading-tight">{issue.title}</h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-muted-strong">{issue.body}</p>

        <PhotoPlaceholder height={104} className="mt-3" />

        {issue.rage > 0 && (
          <div className="mt-3.5">
            <RageMeter value={issue.rage} size="lg" />
            <div className="mt-2 flex justify-between font-mono text-[11px] text-muted">
              <span>Severity: high</span>
              {issue.rageDelta7d && <span className="font-bold text-rage">+{issue.rageDelta7d} this week</span>}
            </div>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <StatTile value={issue.affected.toLocaleString()} label="affected" />
          <StatTile value={issue.reportCount} label="reports" />
          <StatTile value={issue.standingWithCount} label="with you" />
        </div>

        <div className="mb-1 mt-4 font-mono text-[11.5px] font-bold tracking-wide text-muted">
          {issue.replies.length || issue.reportCount} REPLIES
        </div>

        {issue.replies.map((r) =>
          r.authorKind === 'citizen' ? (
            <div key={r.id} className="flex gap-2.5 border-t border-border-light py-2.5">
              <Avatar initials={r.authorLabel.replace('#', '')} size={36} />
              <div>
                <div className="font-mono text-[11.5px] text-muted">
                  <span className="font-bold text-ink">{r.authorLabel}</span> · {r.timeAgo}
                </div>
                <p className="mt-1 text-sm leading-relaxed">{r.body}</p>
              </div>
            </div>
          ) : (
            <div key={r.id} className="mt-1.5 flex gap-2.5 rounded-xl border border-gov-border bg-gov-bg p-3">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-gov bg-[#DDE6E4] text-gov">
                <GovBuildingIcon size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1 font-mono text-[11.5px] text-muted">
                  <span className="font-bold text-gov">{r.authorLabel}</span>
                  <ShieldCheckIcon size={13} className="text-gov" />
                  <span>· {r.timeAgo}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-gov-text">{r.body}</p>
              </div>
            </div>
          ),
        )}
      </div>
    </AppShell>
  );
}
