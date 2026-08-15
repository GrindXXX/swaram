import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { ChevronLeftIcon } from '../components/ui/Icons';
import { getMyIssues, getSession, isSupabaseConfigured } from '../lib/queries';
import type { Issue } from '../lib/types';

export function MyIssues() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'created' | 'following'>('created');
  const [issues, setIssues] = useState<{ created: Issue[]; following: Issue[] }>({ created: [], following: [] });
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getSession()
      .then((session) => {
        if (!active) return;
        setSignedIn(Boolean(session));
        if (session || !isSupabaseConfigured) return getMyIssues();
        return null;
      })
      .then((loaded) => { if (active && loaded) setIssues(loaded); })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load your issues.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = issues[tab];
  return (
    <AppShell>
      <header className="flex items-center border-b border-border px-4 pb-3 pt-2">
        <button onClick={() => navigate(-1)} className="text-muted-strong"><ChevronLeftIcon size={22} /></button>
        <h1 className="flex-1 text-center font-display text-xl">My Issues</h1>
        <span className="w-[22px]" />
      </header>
      <div className="px-4 pb-8">
        {!isSupabaseConfigured && <p className="py-3 text-center font-mono text-[10px] font-bold text-rage">DEMO DATA · NOT YOUR ACCOUNT</p>}
        {isSupabaseConfigured && !signedIn ? (
          <div className="mx-auto mt-16 max-w-sm text-center">
            <h2 className="font-display text-2xl">Your civic record</h2>
            <p className="mt-2 text-sm text-muted">Sign in to see issues you created and follow.</p>
            <Button className="mt-5" onClick={() => navigate('/sign-in?next=/me/issues')}>Sign in</Button>
            {error && <p className="mt-3 text-sm text-rage">{error}</p>}
          </div>
        ) : (
          <>
            <div className="flex gap-6 border-b border-border pt-4">
              {(['created', 'following'] as const).map((value) => (
                <button key={value} onClick={() => setTab(value)} className={`pb-2.5 font-mono text-xs capitalize ${tab === value ? 'border-b-[3px] border-rage font-bold' : 'text-muted'}`}>{value}</button>
              ))}
            </div>
            {loading ? <p className="py-10 text-center font-mono text-xs text-muted">Loading your issues...</p> : visible.length === 0 ? <p className="py-10 text-center text-sm text-muted">No {tab} issues yet.</p> : visible.map((issue) => (
              <button key={issue.id} onClick={() => navigate(`/i/${issue.id}`)} className="flex w-full items-center justify-between border-b border-border-light py-4 text-left">
                <div className="min-w-0 pr-3"><div className="truncate text-sm font-bold">{issue.title}</div><div className="mt-1 font-mono text-[11px] text-muted">{issue.id} · {issue.status.replaceAll('_', ' ')}</div></div>
                <span className="font-mono text-xs font-bold text-rage">{issue.reportCount}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </AppShell>
  );
}
