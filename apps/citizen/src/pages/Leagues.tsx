import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { StatTile } from '../components/ui/StatTile';
import { Pill } from '../components/ui/Pill';
import { FlameIcon, ChevronLeftIcon } from '../components/ui/Icons';
import { currentUser } from '../lib/mock-data';

const LEAGUES = [
  { name: 'EMBER', active: false, done: true },
  { name: 'KINDLING', active: true, done: false },
  { name: 'BLAZE', active: false, done: false },
  { name: 'WILDFIRE', active: false, done: false },
  { name: 'BEACON', active: false, done: false },
];

const monthly = [
  { m: 'MAR', h: 32, hot: false },
  { m: 'APR', h: 54, hot: false },
  { m: 'MAY', h: 41, hot: false },
  { m: 'JUN', h: 70, hot: true },
  { m: 'JUL', h: 88, hot: true },
  { m: 'AUG', h: 100, hot: true },
];

const earnRules = [
  { label: 'A repair verified from your post', points: 200 },
  { label: 'Your post reaches the department', points: 50 },
  { label: 'You cast an honest verdict', points: 15 },
  { label: 'Someone joins your record', points: 5 },
];

export function Leagues() {
  const navigate = useNavigate();
  const progressPct = Math.round((currentUser.smokePoints / (currentUser.smokePoints + currentUser.smokeToNextLeague)) * 100);

  return (
    <AppShell nav={false}>
      <header className="flex items-center justify-between border-b border-border px-4 pb-3 pt-2">
        <button onClick={() => navigate(-1)} className="text-muted-strong">
          <ChevronLeftIcon size={22} />
        </button>
        <span className="font-display text-xl">Your smoke</span>
        <Pill>This year ▾</Pill>
      </header>

      <div className="px-4 py-3.5">
        <div className="mb-3 rounded-card border border-rage/30 bg-rage/5 px-3.5 py-2.5 text-center font-mono text-[10.5px] leading-relaxed text-rage">
          PREVIEW ONLY — there's no points, league or badge system in the backend yet. Everything below is illustrative.
        </div>
        <div className="relative overflow-hidden rounded-card bg-ink-dark p-4 text-paper">
          <div
            className="pointer-events-none absolute inset-0 animate-sw-glow"
            style={{ background: 'radial-gradient(ellipse at 88% 120%, rgba(196,112,58,.55), transparent 62%)' }}
          />
          <div className="relative flex items-center gap-2">
            <FlameIcon size={20} className="animate-sw-flick text-rage-glow" style={{ transformOrigin: '50% 100%' }} />
            <span className="flex-1 font-mono text-[11px] font-bold tracking-widest text-[#D9C49C]">SMOKE POINTS</span>
            <span className="font-mono text-[10.5px] text-[#D9C49C]">+{currentUser.smokeThisWeek} this week</span>
          </div>
          <div className="relative mt-3 animate-sw-count font-mono text-[42px] font-bold leading-none">
            {currentUser.smokePoints.toLocaleString()}
          </div>
          <div className="relative mt-4 flex justify-between font-mono text-[11px] text-[#D9C49C]">
            <span>KINDLING · LEAGUE 2</span>
            <span>{currentUser.smokeToNextLeague} to BLAZE</span>
          </div>
          <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-paper/15">
            <div
              className="h-full animate-sw-heat rounded-full"
              style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg,#9E351B,#E0A45C)' }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between">
          {LEAGUES.map((l) => (
            <div key={l.name} className={`text-center ${l.active ? '' : 'opacity-40'}`}>
              <FlameIcon
                size={l.active ? 40 : 30}
                className={`mx-auto ${l.active ? 'animate-sw-flick text-rage' : 'text-muted'}`}
                style={{ transformOrigin: '50% 100%' }}
              />
              <div className={`mt-1 font-mono text-[9px] font-bold ${l.active ? 'text-rage' : 'text-muted'}`}>{l.name}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <StatTile value={9} label="raised" />
          <StatTile value={6} label="burned" tone="resolved" />
          <StatTile value={2} label="waiting" tone="rage" />
          <StatTile value={31} label="verdicts" />
        </div>

        <div className="mb-2 mt-4 font-mono text-[11px] font-bold tracking-wide text-muted">ISSUES YOU RAISED</div>
        <div className="flex h-[74px] items-end gap-1.5 border-b border-border pb-0.5">
          {monthly.map((m) => (
            <div
              key={m.m}
              className={`flex-1 rounded-t ${m.hot ? 'bg-rage' : 'bg-border-strong'}`}
              style={{ height: `${m.h}%` }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[9.5px] text-muted-soft">
          {monthly.map((m) => (
            <span key={m.m}>{m.m}</span>
          ))}
        </div>

        <div className="mb-2 mt-4 font-mono text-[11px] font-bold tracking-wide text-muted">HOW YOU EARN SMOKE</div>
        {earnRules.map((r) => (
          <div key={r.label} className="flex justify-between border-t border-border-light py-2 text-[13.5px]">
            <span>{r.label}</span>
            <span className="font-mono text-xs font-bold text-rage">+{r.points}</span>
          </div>
        ))}

        <div className="mt-3.5 flex items-center gap-2.5 rounded-card bg-paper-card2 px-3.5 py-3">
          <span className="text-[13px] leading-relaxed">
            You are <strong>#{currentUser.wardRank} of {currentUser.wardTotal.toLocaleString()}</strong> in {currentUser.ward}.
          </span>
        </div>
      </div>
    </AppShell>
  );
}
