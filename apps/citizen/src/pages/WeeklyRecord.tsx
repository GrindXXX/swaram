import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { weeklyRecord as fixture } from '../lib/mock-data';
import { getWeeklyDigest, isSupabaseConfigured, type WeeklyDigest } from '../lib/queries';
import { ShareIcon } from '../components/ui/Icons';

export function WeeklyRecord() {
  const navigate = useNavigate();
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getWeeklyDigest()
      .then((loaded) => { if (active) setDigest(loaded); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function shareRecord() {
    if (navigator.share) await navigator.share({ title: 'Swaram Weekly Record', url: window.location.href });
    else await navigator.clipboard.writeText(window.location.href);
  }

  const footer = (
    <div className="flex gap-2.5 border-t border-border-strong bg-[#EAE0C8] px-4 py-3">
      <button onClick={() => navigate('/')} className="flex-1 rounded-full bg-ink py-3 font-mono text-[13px] font-bold text-paper">
        Open the threads
      </button>
      <button aria-label="Share weekly record" onClick={() => void shareRecord()} className="flex w-14 items-center justify-center rounded-full border-[1.5px] border-ink">
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
            {new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
          </div>
          {!isSupabaseConfigured && <div className="mt-1 font-mono text-[9px] font-bold text-rage">DEMO DATA</div>}
        </div>

        {loading || !digest ? (
          <p className="py-10 text-center font-mono text-xs text-muted">Loading this week's record…</p>
        ) : (
          <>
            <div className="flex border-b border-border-strong py-3.5 text-center">
              <Stat value={digest.posted.toLocaleString()} label="posted" />
              <Stat value={digest.resolved.toLocaleString()} label="resolved" tone="text-resolved" />
              <Stat value={digest.waiting.toLocaleString()} label="waiting" tone="text-rage" />
            </div>

            <div className="border-b border-border-strong py-3.5">
              <div className="font-mono text-[11px] font-bold text-rage">Hottest right now</div>
              {digest.hottest.length === 0 ? (
                <p className="mt-2 text-[13.5px] text-muted">Nothing on the record yet.</p>
              ) : (
                <div className="mt-2 flex flex-col gap-2.5">
                  {digest.hottest.map((h) => (
                    <button
                      key={h.label}
                      onClick={() => h.publicId && navigate(`/i/${h.publicId}`)}
                      className="flex items-baseline justify-between text-left"
                    >
                      <span className="font-display text-lg leading-tight">{h.label}</span>
                      <span className="font-mono text-sm font-bold text-rage">{h.rage}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isSupabaseConfigured && (
              <div className="border-b border-border-strong py-3.5">
                <p className="font-mono text-[11px] leading-relaxed text-muted-soft">
                  &ldquo;Fastest fixed&rdquo; and the district trend need resolution-time and weekly history this
                  backend doesn't compute yet — not shown here rather than shown fabricated.
                </p>
              </div>
            )}

            {!isSupabaseConfigured && (
              <>
                <button onClick={() => navigate('/i/CIV-11290')} className="block w-full border-b border-border-strong py-3.5 text-left">
                  <div className="font-display text-xl leading-tight">{fixture.leadTitle}</div>
                  <div className="mt-1.5 font-mono text-[11px] text-muted">{fixture.leadDetail}</div>
                  <p className="mt-2 text-[13.5px] leading-relaxed">{fixture.leadBody}</p>
                </button>
                <div className="flex gap-3.5 border-b border-border-strong py-3.5">
                  <div className="flex-1 border-l border-border-strong pl-3.5">
                    <div className="font-mono text-[11px] font-bold text-resolved">Fastest fixed</div>
                    <div className="mt-2 font-mono text-[11.5px] leading-[2]">
                      {fixture.fastestFixed.map((f) => (
                        <div key={f.label}>
                          {f.days} <span className="text-muted-strong">{f.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="border-b border-border-strong py-3.5">
                  <div className="font-mono text-[11px] font-bold tracking-wide text-muted">TURNED DOWN BY THE PUBLIC</div>
                  <p className="mt-2 text-[13.5px] leading-relaxed">{fixture.turnedDown}</p>
                </div>
              </>
            )}
          </>
        )}
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
