import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { PhotoPlaceholder } from '../components/ui/PhotoPlaceholder';
import { Pill } from '../components/ui/Pill';
import { GovBuildingIcon, ChevronLeftIcon, CheckIcon } from '../components/ui/Icons';
import {
  getIssue,
  getVerificationContext,
  submitVerification,
  type VerificationVerdict,
} from '../lib/queries';
import type { Issue } from '../lib/types';

const VERDICTS: Array<{ value: VerificationVerdict; label: string }> = [
  { value: 'COMPLETELY_FIXED', label: 'Completely fixed' },
  { value: 'PARTIALLY_FIXED', label: 'Partly fixed' },
  { value: 'STILL_EXISTS', label: 'Still exists' },
  { value: 'NEW_PROBLEM', label: 'New problem created' },
];

type VerificationContext = NonNullable<Awaited<ReturnType<typeof getVerificationContext>>>;

export function RepairVerification() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [context, setContext] = useState<VerificationContext | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!id) return;
    getIssue(id)
      .then(async (loaded) => {
        if (!loaded) throw new Error('Issue not found.');
        const verification = await getVerificationContext(loaded.backendId);
        if (active) {
          setIssue(loaded);
          setContext(verification);
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load verification.');
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function vote(verdict: VerificationVerdict) {
    if (!issue || !context) return;
    setBusy(true);
    setError(null);
    try {
      await submitVerification(issue.backendId, context.resolution_id, verdict, comment);
      const refreshed = await getVerificationContext(issue.backendId);
      setContext(refreshed);
      setNotice('Your verification is recorded. You can change it while the window remains open.');
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : 'Could not record verification.');
    } finally {
      setBusy(false);
    }
  }

  if (error || !issue) {
    return (
      <AppShell nav={false}>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm">
          {error ?? 'Loading verification…'}
        </div>
      </AppShell>
    );
  }

  if (!context) {
    return (
      <AppShell nav={false}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <h2 className="font-display text-2xl">No repair to verify</h2>
          <p className="text-sm text-muted">The authority has not opened a community verification window.</p>
          <button onClick={() => navigate(-1)} className="font-mono text-xs font-bold">Back to issue</button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell nav={false}>
      <header className="flex items-center justify-between border-b border-border px-4 pb-3 pt-2">
        <button onClick={() => navigate(-1)} className="text-muted-strong"><ChevronLeftIcon size={22} /></button>
        <span className="font-mono text-[13px] font-bold">Community verification</span>
        <span className="w-6" />
      </header>

      <div className="px-4 pb-8 pt-3.5">
        <div className="rounded-card border border-gov-border bg-gov-bg p-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gov bg-[#DDE6E4] text-gov"><GovBuildingIcon size={18} /></div>
            <div>
              <div className="font-mono text-xs font-bold text-gov">Authority resolution</div>
              <div className="font-mono text-[11px] text-muted">{new Date(context.submitted_at).toLocaleDateString('en-IN')}</div>
            </div>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-gov-text">{context.action_taken}</p>
          <PhotoPlaceholder height={110} className="mt-3" />
          <div className="mt-2.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-strong">
            <CheckIcon size={15} className={context.same_location ? 'text-resolved' : 'text-muted'} />
            <span>{context.same_location === true ? 'Evidence location matches' : 'Evidence location not confirmed'}</span>
          </div>
        </div>

        <div className="mt-3.5 rounded-card border border-resolved-border bg-resolved-bg p-4">
          <div className="font-display text-xl">Is it actually fixed?</div>
          <div className="mt-3 flex flex-col gap-2">
            {VERDICTS.map((option) => {
              const result = context.breakdown.find((entry) => entry.verdict === option.value);
              return (
                <button key={option.value} disabled={busy || !context.verification_open} onClick={() => void vote(option.value)} className="flex items-center justify-between rounded-lg border border-resolved-border bg-paper px-3 py-3 text-left disabled:opacity-50">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="font-mono text-xs font-bold">{result?.pct ?? 0}% · {result?.responses ?? 0}</span>
                </button>
              );
            })}
          </div>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} placeholder="Optional note or what remains…" className="mt-3 w-full resize-none rounded-lg border border-resolved-border bg-paper px-3 py-2 text-sm outline-none" />
          {notice && <p className="mt-2 font-mono text-[11px] text-resolved">{notice}</p>}
          {error && <p className="mt-2 text-sm text-rage">{error}</p>}
        </div>

        <div className="mt-4 font-mono text-[11.5px] font-bold tracking-wide text-muted">HOW THIS RECORD MOVED</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {issue.history.map((step) => <Pill key={step}>{step}</Pill>)}
        </div>
      </div>
    </AppShell>
  );
}
