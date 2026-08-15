import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Avatar } from '../components/ui/Avatar';
import { StatTile } from '../components/ui/StatTile';
import { ShieldCheckIcon, FlameIcon } from '../components/ui/Icons';
import { currentUser, badges } from '../lib/mock-data';
import { getMyIssues, isSupabaseConfigured } from '../lib/queries';
import type { Issue } from '../lib/types';

const BADGE_COLOR: Record<string, string> = {
  resolved: '#52613A',
  gov: '#304C50',
  rage: '#9E351B',
  locked: 'none',
};

export function Profile() {
  const navigate = useNavigate();
  const [myIssues, setMyIssues] = useState<{ created: Issue[]; following: Issue[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMyIssues()
      .then((loaded) => { if (active) setMyIssues(loaded); })
      .catch((loadError: unknown) => {
        // Not signed in is the expected state for most visitors, not a bug —
        // no "your issues" preview to show, not an error banner.
        if (active) setError(loadError instanceof Error ? loadError.message : null);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const threads = myIssues ? [...myIssues.created, ...myIssues.following] : [];
  const postedCount = myIssues?.created.length ?? 0;
  const fixedCount = myIssues?.created.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').length ?? 0;
  const helpedCount = threads.reduce((sum, i) => sum + i.standingWithCount, 0);

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
          <StatTile value={loading ? '—' : postedCount} label="posted" />
          <StatTile value={loading ? '—' : fixedCount} label="fixed" tone="resolved" />
          <StatTile value={loading ? '—' : helpedCount.toLocaleString()} label="helped" />
        </div>

        <div className="mb-2.5 mt-5 flex items-center justify-between">
          <span className="font-mono text-[11.5px] font-bold tracking-wide text-muted">MARKS OF SERVICE</span>
          <span className="font-mono text-[11px] text-muted-soft">not live yet</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 text-center opacity-60">
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
          Preview only — there's no badge or points system behind this yet.
        </div>

        <button
          onClick={() => navigate('/profile/leagues')}
          className="relative mt-4 flex w-full items-center gap-3 overflow-hidden rounded-card bg-ink-dark px-4 py-3.5 text-left text-paper opacity-75"
        >
          <FlameIcon size={24} className="animate-sw-flick flex-none text-rage-glow" style={{ transformOrigin: '50% 100%' }} />
          <div className="flex-1">
            <div className="font-mono text-[15px] font-bold">Smoke points — preview</div>
            <div className="mt-0.5 font-mono text-[11px] text-[#C0B49A]">No live points system yet</div>
          </div>
          <span className="font-mono text-[11px] font-bold text-rage-glow">See →</span>
        </button>

        <button onClick={() => navigate('/me/issues')} className="mb-2 mt-5 flex w-full items-center justify-between font-mono text-[11.5px] font-bold tracking-wide text-muted">
          <span>YOUR ISSUES</span><span className="text-rage">Created &amp; following →</span>
        </button>

        {!isSupabaseConfigured && <p className="py-3 text-center font-mono text-[10px] font-bold text-rage">DEMO DATA · SUPABASE NOT CONFIGURED</p>}
        {isSupabaseConfigured && loading && <p className="py-6 text-center font-mono text-xs text-muted">Loading your issues…</p>}
        {isSupabaseConfigured && !loading && error && (
          <p className="py-6 text-center text-sm text-muted">Sign in from &ldquo;Your issues&rdquo; to see what you've reported.</p>
        )}
        {isSupabaseConfigured && !loading && !error && threads.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">Nothing reported or followed yet.</p>
        )}
        {threads.slice(0, 4).map((issue) => (
          <button
            key={issue.id}
            onClick={() => navigate(`/i/${issue.id}`)}
            className="flex w-full items-center justify-between border-t border-border-light py-3 text-left"
          >
            <div>
              <div className="text-sm">{issue.title}</div>
              <div className="mt-0.5 font-mono text-[11px] text-muted">{issue.status.replaceAll('_', ' ')}</div>
            </div>
            <span className="font-mono text-sm font-bold text-muted">{issue.rage || '—'}</span>
          </button>
        ))}
      </div>
    </AppShell>
  );
}
