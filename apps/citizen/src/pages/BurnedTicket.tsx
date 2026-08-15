import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { FlameIcon, RecordIcon } from '../components/ui/Icons';
import { issues } from '../lib/mock-data';

export function BurnedTicket() {
  const { id } = useParams();
  const navigate = useNavigate();
  const issue = issues.find((i) => i.id === id) ?? issues[0];

  const footer = (
    <div className="flex gap-2.5 px-5 pb-6">
      <button className="flex-1 rounded-full bg-paper py-3.5 font-mono text-[13.5px] font-bold text-ink">
        Share the burn
      </button>
      <button className="flex w-[60px] items-center justify-center rounded-full border-[1.5px] border-paper/50">
        <RecordIcon size={19} className="text-paper" />
      </button>
    </div>
  );

  return (
    <AppShell nav={false} footer={footer} className="!bg-ink-dark">
      <div
        className="flex min-h-full flex-col items-center justify-center px-5 text-paper"
        style={{ backgroundImage: 'radial-gradient(ellipse at 78% 88%, rgba(158,53,27,.35), transparent 60%)' }}
      >
        <div className="font-mono text-[11px] font-bold tracking-[0.3em] text-rage-ember">RECORD CLOSED</div>
        <div className="mt-3 text-center font-display text-3xl leading-tight">{issue.title.replace("won't go away", 'is gone')}</div>
        <div className="mt-2.5 font-mono text-xs text-[#C0B49A]">Verified by 214 neighbours · 18 Aug</div>

        <div className="relative mt-6 w-full">
          <div className="relative overflow-hidden rounded-card border border-border-strong bg-paper p-4 text-ink">
            <div className="flex justify-between border-b border-border-light pb-2 font-mono text-[10.5px] tracking-wide text-muted">
              <span>{issue.id}</span>
              <span>{issue.ward.toUpperCase()}</span>
            </div>
            <div className="mt-3 font-display text-xl leading-tight">{issue.title}</div>
            <div className="mt-2 font-mono text-[11.5px] text-muted">
              Filed {issue.filedOn} · {issue.reportCount} reports · {issue.standingWithCount} supporters
            </div>
            <div className="mt-3 font-mono text-[11.5px] leading-[1.9] text-muted-strong">
              Roads Department · Kiran R.
              <br />
              Work order BBMP/RD/8842
              <br />
              Resurfaced 40 sq.m · 18 Aug
            </div>
            <div className="mt-3 inline-block -rotate-6 rounded border-2 border-resolved px-2.5 py-1 font-mono text-[11px] font-bold tracking-wide text-resolved">
              BURNED
            </div>
          </div>
        </div>

        <div className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-rage-glow/35 bg-paper/5 px-4 py-3.5">
          <FlameIcon size={26} className="animate-sw-flick flex-none text-rage-glow" style={{ transformOrigin: '50% 100%' }} />
          <div className="flex-1">
            <div className="font-mono text-lg font-bold text-rage-glow">+200 smoke</div>
            <div className="mt-0.5 font-mono text-[11.5px] text-[#C0B49A]">Split with 81 others who filed it</div>
          </div>
        </div>

        <div className="mt-4 text-center font-mono text-[12.5px] leading-relaxed text-[#C0B49A]">
          Burned tickets stay in the archive.
          <br />
          Nothing is deleted — only closed.
        </div>

        <button onClick={() => navigate('/profile')} className="mt-6 font-mono text-[11px] text-[#C0B49A] underline">
          Back to your profile
        </button>
      </div>
    </AppShell>
  );
}
