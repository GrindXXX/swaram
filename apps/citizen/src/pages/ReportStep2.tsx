import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { PhotoPlaceholder } from '../components/ui/PhotoPlaceholder';
import { Pill } from '../components/ui/Pill';
import { ChevronLeftIcon, SparkleIcon, SupportHandIcon } from '../components/ui/Icons';

export function ReportStep2() {
  const navigate = useNavigate();

  return (
    <AppShell nav={false}>
      <header className="flex items-center justify-between px-4 pb-3.5 pt-2">
        <button onClick={() => navigate(-1)} className="text-muted-strong">
          <ChevronLeftIcon size={22} />
        </button>
        <span className="font-mono text-[13px] font-bold">Step 2 of 2</span>
        <span className="w-6" />
      </header>

      <div className="flex flex-col gap-4 px-5 pb-6">
        <PhotoPlaceholder height={170} className="items-start justify-end p-3">
          <span className="rounded-full bg-ink/75 px-3 py-1.5 font-mono text-[11px] text-paper">Retake</span>
        </PhotoPlaceholder>

        <div>
          <div className="mb-1.5 font-mono text-[11.5px] font-bold tracking-wide text-muted">WHAT YOU SAID</div>
          <p className="text-[15px] italic leading-relaxed text-muted-strong">
            "There's a huge pothole right before the Whitefield signal. Nearly two weeks now. Bikes are swerving into
            the next lane."
          </p>
        </div>

        <div className="rounded-card border border-gov-border bg-gov-bg p-4">
          <div className="flex items-center gap-2">
            <SparkleIcon size={20} className="text-gov" />
            <span className="flex-1 font-mono text-[12.5px] font-bold text-gov">Swaram understood</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs">
            <Pill tone="gov">Roads</Pill>
            <Pill tone="gov">Ward 42</Pill>
            <Pill tone="gov">Urgent</Pill>
            <Pill tone="gov">~1,400 affected</Pill>
          </div>
          <div className="mt-3 text-[13px] leading-relaxed text-gov-text">
            It will reach the <strong>BBMP Roads desk, Ward 42</strong>. Tap any tag to change it.
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-card bg-paper-card2 p-4">
          <SupportHandIcon size={26} className="flex-none text-rage" />
          <div className="flex-1">
            <div className="text-[14.5px] leading-snug">
              <strong>81 neighbours</strong> already posted this.
            </div>
            <div className="mt-1 font-mono text-[11.5px] text-muted">Join them — it carries more weight together.</div>
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2.5 px-5 pb-6">
        <Button variant="rage" onClick={() => navigate('/thread/CIV-10482')} className="text-base">
          Join the 81
        </Button>
        <Button variant="outline" onClick={() => navigate('/thread/CIV-10482')}>
          Post as a new problem
        </Button>
      </div>
    </AppShell>
  );
}
