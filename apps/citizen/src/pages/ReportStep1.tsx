import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { CameraIcon, MicIcon, TypeIcon, LocationPinIcon, ShieldCheckIcon } from '../components/ui/Icons';
import { currentUser } from '../lib/mock-data';

export function ReportStep1() {
  const navigate = useNavigate();

  return (
    <AppShell nav={false}>
      <header className="flex items-center justify-between px-4 pb-3.5 pt-2">
        <button onClick={() => navigate('/')} className="font-mono text-[13px] text-muted-strong">
          Cancel
        </button>
        <span className="font-mono text-[13px] font-bold">Step 1 of 2</span>
        <span className="w-11" />
      </header>

      <div className="flex flex-col gap-4 px-5">
        <div>
          <h2 className="font-display text-[28px] leading-tight">What's the problem?</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-strong">
            Take a photo, or just speak. We'll handle the rest.
          </p>
        </div>

        <button
          onClick={() => navigate('/report/confirm')}
          className="flex items-center gap-4 rounded-card bg-rage px-5 py-6 text-left text-paper shadow-[0_5px_0_rgba(23,21,18,.3)]"
        >
          <CameraIcon size={38} />
          <span>
            <span className="block font-mono text-lg font-bold">Take a photo</span>
            <span className="mt-1 block text-[13px] opacity-85">Most people start here</span>
          </span>
        </button>

        <button
          onClick={() => navigate('/report/confirm')}
          className="flex items-center gap-4 rounded-card border-[1.5px] border-ink bg-paper px-5 py-5 text-left"
        >
          <MicIcon size={34} />
          <span>
            <span className="block font-mono text-lg font-bold">Speak instead</span>
            <span className="mt-1 block text-[13px] text-muted">ಕನ್ನಡ · हिन्दी · English</span>
          </span>
        </button>

        <button
          onClick={() => navigate('/report/confirm')}
          className="flex items-center gap-4 rounded-card border-[1.5px] border-border-strong bg-paper px-5 py-5 text-left text-muted-strong"
        >
          <TypeIcon size={30} />
          <span className="font-mono text-[17px] font-bold">Type it out</span>
        </button>

        <div className="flex items-center gap-3 rounded-card bg-paper-card2 px-4 py-3.5">
          <LocationPinIcon size={24} className="text-muted-strong" />
          <div className="flex-1">
            <div className="text-[14.5px]">Whitefield Main Road</div>
            <div className="mt-0.5 font-mono text-[11px] text-muted">Found from your phone · {currentUser.ward}</div>
          </div>
          <span className="font-mono text-[11.5px] font-bold text-rage">Change</span>
        </div>

        <div className="mb-1.5 mt-auto flex items-center gap-2.5 rounded-card bg-gov-bg px-4 py-3.5">
          <ShieldCheckIcon size={22} className="flex-none text-gov" />
          <div className="text-[13px] leading-relaxed text-gov-text">
            You post as <strong>{currentUser.handle}</strong>. Your name is never shown.
          </div>
        </div>
      </div>

      <div className="px-5 pb-6 pt-4">
        <Button onClick={() => navigate('/report/confirm')} className="text-base">
          Next
        </Button>
      </div>
    </AppShell>
  );
}
