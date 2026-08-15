import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { FAB } from '../components/layout/FAB';
import { IssueCard } from '../components/feed/IssueCard';
import { Avatar } from '../components/ui/Avatar';
import { FlameIcon, SearchIcon, TrendUpIcon, ClockIcon } from '../components/ui/Icons';
import { getIssues, isSupabaseConfigured, trendingHeatingUp, trendingMomentum, trendingWaitingLongest, currentUser } from '../lib/queries';
import type { Issue } from '../lib/types';

const TABS = ['For you', 'Near you', 'Trending', 'Following'] as const;
type Tab = (typeof TABS)[number];

export function Feed() {
  const [tab, setTab] = useState<Tab>('For you');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setLoading(true);
    getIssues()
      .then((loaded) => {
        if (active) setIssues(loaded);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load the civic feed.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell>
      <header className="flex items-center justify-between px-4 pb-3 pt-2">
        <span className="font-display text-2xl tracking-wide">SWARAM</span>
        <div className="flex items-center gap-3.5">
          <SearchIcon size={22} className="text-muted-strong" />
          <Avatar initials={currentUser.initials} size={32} />
        </div>
      </header>

      <div className="flex gap-6 border-b border-border px-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2.5 font-mono text-[12.5px] ${
              tab === t ? 'border-b-[3px] border-rage font-bold text-ink' : 'text-muted'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="px-3.5 pb-28">
        {tab === 'Trending' ? (
          <TrendingContent onOpen={(id) => navigate(`/i/${id}`)} />
        ) : (
          <>
            {!isSupabaseConfigured && <p className="pt-3 text-center font-mono text-[10px] font-bold text-rage">DEMO DATA · LIVE ACTIONS DISABLED</p>}
            <FeedIssues issues={issues} loading={loading} error={error} />
          </>
        )}
      </div>

      <FAB />
    </AppShell>
  );
}

function FeedIssues({ issues, loading, error }: { issues: Issue[]; loading: boolean; error: string | null }) {
  if (loading) return <p className="py-10 text-center font-mono text-xs text-muted">Loading civic record…</p>;
  if (error) return <p className="py-10 text-center text-sm text-rage">{error}</p>;
  if (issues.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">No issues are visible in this feed yet.</p>;
  }
  return <>{issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}</>;
}

function TrendingContent({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="pt-3.5">
      <SectionLabel icon={<FlameIcon size={17} className="animate-sw-flick text-rage" />} label="Heating up" />
      {trendingHeatingUp.map((t) => (
        <button key={t.id} onClick={() => onOpen(t.id)} className="mb-3 block w-full rounded-card bg-paper-card2 p-3.5 text-left">
          <div className="flex items-baseline justify-between font-mono text-[11px] text-muted">
            <span>
              {t.rank} · {t.place} · {t.category}
            </span>
            <span className="font-mono text-xl font-bold text-rage">{t.rage}</span>
          </div>
          <div className="mt-1 font-display text-lg leading-tight">{t.title}</div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-rage/15">
            <div className="h-full animate-sw-heat rounded-full" style={{ width: `${t.rage}%`, background: 'linear-gradient(90deg,#7c2915,#C4703A)' }} />
          </div>
          <div className="mt-2 font-mono text-[11.5px] text-muted">
            {t.affected.toLocaleString()} affected · {t.posts.toLocaleString()} posts
          </div>
        </button>
      ))}

      <SectionLabel icon={<TrendUpIcon size={17} className="text-muted-strong" />} label="Gaining momentum" />
      {trendingMomentum.map((t) => (
        <div key={t.title} className="flex items-center justify-between border-b border-border-light py-2.5">
          <div>
            <div className="text-sm">{t.title}</div>
            <div className="mt-0.5 font-mono text-[11px] text-muted">{t.detail}</div>
          </div>
          <span className="font-mono text-sm font-bold text-rage">▲ {t.delta}</span>
        </div>
      ))}

      <SectionLabel icon={<ClockIcon size={17} className="text-muted-strong" />} label="Waiting longest" />
      {trendingWaitingLongest.map((t) => (
        <div key={t.title} className="flex justify-between border-b border-border-light py-2.5 text-sm">
          <span>{t.title}</span>
          <span className="font-mono text-xs font-bold">{t.days}</span>
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="mb-2.5 mt-5 flex items-center gap-2 first:mt-0">
      {icon}
      <span className="font-mono text-[12.5px] font-bold tracking-wide text-muted-strong">{label}</span>
    </div>
  );
}
