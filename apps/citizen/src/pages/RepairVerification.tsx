import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { PhotoPlaceholder } from '../components/ui/PhotoPlaceholder';
import { Button } from '../components/ui/Button';
import { Pill } from '../components/ui/Pill';
import { GovBuildingIcon, ChevronLeftIcon, ShareIcon, CheckIcon, XIcon } from '../components/ui/Icons';
import { issues } from '../lib/mock-data';

const VERDICTS = [
  { label: 'Completely fixed', pct: 72, tone: 'text-resolved', bar: 'bg-resolved' },
  { label: 'Partly fixed', pct: 19, tone: 'text-ink', bar: 'bg-muted' },
  { label: 'Still there', pct: 9, tone: 'text-rage', bar: 'bg-rage' },
];

export function RepairVerification() {
  const { id } = useParams();
  const navigate = useNavigate();
  const issue = issues.find((i) => i.id === id) ?? issues.find((i) => i.status === 'AWAITING_VERIFICATION')!;
  const [verdict, setVerdict] = useState<'fixed' | 'not-fixed' | null>(null);

  const composer = (
    <div className="safe-bottom flex items-center gap-2.5 border-t border-border-strong bg-paper-chip px-4 pb-4 pt-3">
      <div className="flex-1 rounded-full border border-border-strong bg-paper px-4 py-3 font-mono text-[12.5px] text-muted-soft">
        Add to this thread…
      </div>
      <button className="min-h-[48px] rounded-full bg-resolved px-5 font-mono text-[12.5px] font-bold text-paper">
        Verify
      </button>
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

      <div className="px-4 pb-6 pt-3.5">
        <div className="rounded-card border border-gov-border bg-gov-bg p-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gov bg-[#DDE6E4] text-gov">
              <GovBuildingIcon size={18} />
            </div>
            <div>
              <div className="font-mono text-xs font-bold text-gov">Roads Department</div>
              <div className="font-mono text-[11px] text-muted">18 Aug · repair submitted</div>
            </div>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-gov-text">
            Patch completed this morning. 40 sq.m resurfaced and compacted.
          </p>
          <div className="mt-2.5 flex gap-2.5">
            <div className="flex-1">
              <PhotoPlaceholder height={88} />
              <div className="mt-1.5 text-center font-mono text-[10.5px] text-muted">Before · 3 Aug</div>
            </div>
            <div className="flex-1">
              <PhotoPlaceholder height={88} />
              <div className="mt-1.5 text-center font-mono text-[10.5px] text-muted">After · 18 Aug</div>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-strong">
            <CheckIcon size={15} className="text-resolved" />
            <span>Photo location matches the report</span>
          </div>
        </div>

        <div className="mt-3.5 rounded-card border border-resolved-border bg-resolved-bg p-4">
          <div className="font-display text-xl">Is it actually fixed?</div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-strong">214 of 347 people have answered.</p>
          <div className="mt-3 flex flex-col gap-2.5">
            {VERDICTS.map((v) => (
              <div key={v.label}>
                <div className="flex justify-between font-mono text-xs">
                  <span>{v.label}</span>
                  <span className={`font-bold ${v.tone}`}>{v.pct}%</span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-ink/10">
                  <div className={`h-full rounded-full ${v.bar}`} style={{ width: `${v.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3.5 flex gap-2.5">
            <Button variant="resolved" icon={<CheckIcon size={17} />} onClick={() => setVerdict('fixed')}>
              Fixed
            </Button>
            <Button variant="ghost" icon={<XIcon size={17} />} onClick={() => setVerdict('not-fixed')}>
              Not fixed
            </Button>
          </div>
          {verdict && (
            <p className="mt-3 font-mono text-[11.5px] text-resolved">
              Recorded — thanks for verifying. {verdict === 'fixed' ? '+15 smoke' : "We'll flag this for review."}
            </p>
          )}
        </div>

        <div className="mt-4 font-mono text-[11.5px] font-bold tracking-wide text-muted">HOW THIS RECORD MOVED</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {issue.history.map((step) =>
            step === 'Verifying' ? (
              <Pill key={step} tone="resolved">
                {step}
              </Pill>
            ) : step === 'Rage' ? (
              <Pill key={step} tone="rage">
                Rage {issue.rage}
              </Pill>
            ) : (
              <Pill key={step}>{step}</Pill>
            ),
          )}
        </div>
      </div>
    </AppShell>
  );
}
