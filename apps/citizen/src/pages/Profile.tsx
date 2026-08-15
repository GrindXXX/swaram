import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Avatar } from '../components/ui/Avatar';
import { StatTile } from '../components/ui/StatTile';
import { ShieldCheckIcon, FlameIcon } from '../components/ui/Icons';
import { currentUser, badges, issues } from '../lib/mock-data';

const BADGE_COLOR: Record<string, string> = {
  resolved: '#52613A',
  gov: '#304C50',
  rage: '#9E351B',
  locked: 'none',
};

const myThreads = [
  { issue: issues[0], status: 'Verifying · 347 with you', tag: null },
  { issue: issues[4], status: 'Officer assigned · 6 days', tag: null },
  { issue: issues[5], status: 'Waiting for your verdict', tag: 'VERIFY ME' as const },
  { issue: issues[2], status: 'Closed in 3 days · 91% satisfied', tag: 'BURNED' as const },
];

export function Profile() {
  const navigate = useNavigate();

  return (
    <AppShell>
      <div className="px-4 pb-8 pt-2">
        <div className="flex items-center gap-3.5">
          <Avatar initials={currentUser.initials} size={66} />
          <div className="flex-1">
            <div className="font-display text-xl">{currentUser.handle}</div>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-[11.5px] text-muted">
              <ShieldCheckIcon size={14} className="text-gov" />
              <span>
                Verified · {currentUser.ward} · since {currentUser.verifiedSince}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <StatTile value={9} label="posted" />
          <StatTile value={6} label="fixed" tone="resolved" />
          <StatTile value="2,140" label="helped" />
        </div>

        <div className="mb-2.5 mt-5 flex items-center justify-between">
          <span className="font-mono text-[11.5px] font-bold tracking-wide text-muted">MARKS OF SERVICE</span>
          <span className="font-mono text-[11px] text-rage">3 of 7 earned</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {badges.map((b) => (
            <div key={b.id} className={b.earned ? '' : 'opacity-45'}>
              <svg width="60" height="60" viewBox="0 0 48 48">
                <path
                  d="M24 5l4.4 8 9-1.1-1.1 9 8 4.4-8 4.4 1.1 9-9-1.1L24 45l-4.4-8-9 1.1 1.1-9-8-4.4 8-4.4-1.1-9 9 1.1z"
                  fill={b.earned ? BADGE_COLOR[b.color] : 'none'}
                  stroke={b.earned ? '#00000055' : '#6d6353'}
                  strokeWidth={1.3}
                  strokeDasharray={b.earned ? undefined : '3 2.4'}
                  strokeLinejoin="round"
                />
                <circle cx={24} cy={25} r={9} fill={b.earned ? '#F5EDDC' : 'none'} stroke={b.earned ? '#00000055' : '#6d6353'} />
              </svg>
              <div className="font-mono text-[9px] font-bold text-muted-strong">{b.name}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-center font-mono text-[10.5px] text-muted-soft">
          Pinned only when a repair is verified — never for posting.
        </div>

        <button
          onClick={() => navigate('/profile/leagues')}
          className="relative mt-4 flex w-full items-center gap-3 overflow-hidden rounded-card bg-ink-dark px-4 py-3.5 text-left text-paper"
        >
          <FlameIcon size={24} className="animate-sw-flick flex-none text-rage-glow" style={{ transformOrigin: '50% 100%' }} />
          <div className="flex-1">
            <div className="font-mono text-[15px] font-bold">{currentUser.smokePoints.toLocaleString()} smoke</div>
            <div className="mt-0.5 font-mono text-[11px] text-[#C0B49A]">
              {currentUser.league} · {currentUser.smokeToNextLeague} to BLAZE
            </div>
          </div>
          <span className="font-mono text-[11px] font-bold text-rage-glow">See →</span>
        </button>

        <button onClick={() => navigate('/me/issues')} className="mb-2 mt-5 flex w-full items-center justify-between font-mono text-[11.5px] font-bold tracking-wide text-muted">
          <span>YOUR ISSUES</span><span className="text-rage">Created &amp; following →</span>
        </button>
        {myThreads.map(({ issue, status, tag }) => (
          <button
            key={issue.id}
            onClick={() => navigate(`/i/${issue.id}`)}
            className="flex w-full items-center justify-between border-t border-border-light py-3 text-left"
          >
            <div>
              <div className="text-sm">{issue.title}</div>
              <div className="mt-0.5 font-mono text-[11px] text-muted">{status}</div>
            </div>
            {tag ? (
              <span
                className={`-rotate-6 rounded border-2 px-2 py-0.5 font-mono text-[9.5px] font-bold tracking-wide ${
                  tag === 'BURNED' ? 'border-rage-deep text-rage-deep' : 'border-resolved text-resolved'
                }`}
              >
                {tag}
              </span>
            ) : (
              <span className="font-mono text-sm font-bold text-muted">{issue.rage || '—'}</span>
            )}
          </button>
        ))}
      </div>
    </AppShell>
  );
}
