import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Pill } from '../components/ui/Pill';
import { FlameIcon, GovBuildingIcon, ShieldCheckIcon, ChatIcon, SupportHandIcon, RecordIcon } from '../components/ui/Icons';

const alerts = [
  {
    icon: <FlameIcon size={24} className="animate-sw-flick text-rage" />,
    bg: 'bg-rage/10',
    body: (
      <>
        <strong>347 people</strong> are now facing the pothole you reported.
      </>
    ),
    meta: 'Rage rose to 87 · 2h',
    to: '/thread/CIV-10482',
  },
  {
    icon: <GovBuildingIcon size={24} className="text-gov" />,
    bg: 'bg-gov-bg',
    body: (
      <>
        <strong>Roads Department</strong> replied in your thread.
      </>
    ),
    quote: '"Resurfacing scheduled for 18 August."',
    meta: '2h',
    to: '/thread/CIV-10482',
  },
  {
    icon: <ShieldCheckIcon size={24} className="text-resolved" />,
    bg: 'bg-resolved-bg',
    body: (
      <>
        A repair was submitted on <strong>the drain at 9th Cross</strong>.
      </>
    ),
    cta: "Tap to say if it's actually fixed →",
    to: '/thread/CIV-11311/verify',
  },
  {
    icon: <ChatIcon size={24} className="text-muted" />,
    body: (
      <>
        <strong>#B72D</strong> and 11 others replied to a thread you follow.
      </>
    ),
    meta: '9h',
    to: '/thread/CIV-10482',
  },
  {
    icon: <SupportHandIcon size={24} className="text-muted" />,
    body: 'Two reports near you joined a record you support.',
    meta: '1d',
    to: '/',
  },
  {
    icon: <RecordIcon size={24} className="text-muted" />,
    body: (
      <>
        This week's <strong>Weekly Record</strong> is ready to read.
      </>
    ),
    meta: '1w',
    to: '/weekly',
  },
];

export function Alerts() {
  const navigate = useNavigate();
  return (
    <AppShell>
      <header className="flex items-center justify-between border-b border-border px-4 pb-3.5 pt-2">
        <span className="font-display text-2xl">Alerts</span>
        <Pill tone="neutral">All</Pill>
      </header>
      <div className="flex flex-col gap-2.5 p-3.5">
        {alerts.map((a, i) => (
          <button
            key={i}
            onClick={() => navigate(a.to)}
            className={`flex gap-3 rounded-xl p-3.5 text-left ${a.bg ?? ''} ${!a.bg ? 'border-b border-border-light' : ''}`}
          >
            <span className="flex-none">{a.icon}</span>
            <div>
              <div className="text-sm leading-relaxed">{a.body}</div>
              {a.quote && <div className="mt-1 text-[13px] italic text-muted-strong">{a.quote}</div>}
              {a.cta && <div className="mt-1.5 font-mono text-[11.5px] font-bold text-resolved">{a.cta}</div>}
              {a.meta && <div className="mt-1.5 font-mono text-[11px] text-muted">{a.meta}</div>}
            </div>
          </button>
        ))}
      </div>
    </AppShell>
  );
}
