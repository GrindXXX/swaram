import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { weeklyRecord as w } from '../lib/mock-data';
import { ShareIcon } from '../components/ui/Icons';

export function WeeklyRecord() {
  const navigate = useNavigate();
  const maxWeek = Math.max(...w.spotlightWeeks);

  const footer = (
    <div className="flex gap-2.5 border-t border-border-strong bg-[#EAE0C8] px-4 py-3">
      <button onClick={() => navigate('/')} className="flex-1 rounded-full bg-ink py-3 font-mono text-[13px] font-bold text-paper">
        Open the threads
      </button>
      <button className="flex w-14 items-center justify-center rounded-full border-[1.5px] border-ink">
        <ShareIcon size={19} className="text-ink" />
      </button>
    </div>
  );

  return (
    <AppShell nav={false} footer={footer} className="bg-paper-weekly">
      <div className="px-4">
        <div className="border-b-[3px] border-double border-ink py-3 text-center">
          <div className="font-mono text-[9px] tracking-[0.3em] text-muted">THE WEEKLY RECORD</div>
          <div className="mt-1.5 font-display text-[34px] tracking-[0.16em]">SWARAM</div>
          <div className="mt-1.5 font-mono text-[10px] tracking-wide text-muted">
            Issue {w.issue} · {w.date}
          </div>
        </div>

        <div className="flex border-b border-border-strong py-3.5 text-center">
          <Stat value={w.posted.toLocaleString()} label="posted" />
          <Stat value={w.resolved.toLocaleString()} label="resolved" tone="text-resolved" />
          <Stat value={w.waiting.toLocaleString()} label="waiting" tone="text-rage" />
        </div>

        <button onClick={() => navigate('/thread/CIV-11290')} className="block w-full border-b border-border-strong py-3.5 text-left">
          <div className="font-display text-xl leading-tight">{w.leadTitle}</div>
          <div className="mt-1.5 font-mono text-[11px] text-muted">{w.leadDetail}</div>
          <p className="mt-2 text-[13.5px] leading-relaxed">{w.leadBody}</p>
        </button>

        <div className="flex gap-3.5 border-b border-border-strong py-3.5">
          <div className="flex-1">
            <div className="font-mono text-[11px] font-bold text-rage">Hottest</div>
            <div className="mt-2 font-mono text-[11.5px] leading-[2]">
              {w.hottest.map((h) => (
                <div key={h.label}>
                  {h.rage} <span className="text-muted-strong">{h.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 border-l border-border-strong pl-3.5">
            <div className="font-mono text-[11px] font-bold text-resolved">Fastest fixed</div>
            <div className="mt-2 font-mono text-[11.5px] leading-[2]">
              {w.fastestFixed.map((f) => (
                <div key={f.label}>
                  {f.days} <span className="text-muted-strong">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-b border-border-strong py-3.5">
          <div className="font-mono text-[11px] font-bold tracking-wide text-muted">TURNED DOWN BY THE PUBLIC</div>
          <p className="mt-2 text-[13.5px] leading-relaxed">{w.turnedDown}</p>
        </div>

        <div className="py-3.5">
          <div className="font-mono text-[11px] font-bold tracking-wide text-muted">
            DISTRICT SPOTLIGHT · {w.spotlightWard.toUpperCase()}
          </div>
          <div className="mt-2.5 flex h-[30px] items-end gap-1.5">
            {w.spotlightWeeks.map((v, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t ${v === maxWeek || v > 80 ? 'bg-resolved' : i === w.spotlightWeeks.length - 2 ? 'bg-[#a89b81]' : 'bg-border-strong'}`}
                style={{ height: `${v}%` }}
              />
            ))}
            <span className="ml-1.5 font-mono text-[10px] text-muted-soft">6 weeks</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ value, label, tone = 'text-ink' }: { value: string; label: string; tone?: string }) {
  return (
    <div className="flex-1">
      <div className={`font-mono text-[19px] font-bold ${tone}`}>{value}</div>
      <div className="mt-1 font-mono text-[10px] text-muted">{label}</div>
    </div>
  );
}
