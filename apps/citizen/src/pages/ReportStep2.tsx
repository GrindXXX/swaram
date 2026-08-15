import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Pill } from '../components/ui/Pill';
import { ChevronLeftIcon, SparkleIcon, LocationPinIcon } from '../components/ui/Icons';
import { clearReportDraft, readReportDraft } from '../lib/report-draft';
import {
  getSession,
  isSupabaseConfigured,
  signInWithEmail,
  submitReport,
} from '../lib/queries';

export function ReportStep2() {
  const navigate = useNavigate();
  const [draft] = useState(readReportDraft);
  const [signedIn, setSignedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    let active = true;
    getSession()
      .then((session) => {
        if (active) setSignedIn(Boolean(session));
      })
      .catch((sessionError: unknown) => {
        if (active) setError(sessionError instanceof Error ? sessionError.message : 'Could not read your session.');
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit() {
    if (!draft) {
      navigate('/report');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add the VITE_SUPABASE_URL and anon key.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (!signedIn) {
        if (!email.trim()) {
          setError('Enter your email to receive a sign-in link.');
          setSubmitting(false);
          return;
        }
        // Google OAuth is the target, but the current Supabase project only has
        // email auth enabled. Keep the draft across the magic-link redirect.
        await signInWithEmail(email.trim());
        setNotice('Check your email for the sign-in link, then return here to submit.');
        setSubmitting(false);
        return;
      }

      const accepted = await submitReport(draft);
      clearReportDraft();
      navigate(`/thread/${accepted.public_id}`, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'The report could not be submitted.');
      setSubmitting(false);
    }
  }

  if (!draft) {
    return (
      <AppShell nav={false}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h2 className="font-display text-2xl">No report to preview</h2>
          <Button onClick={() => navigate('/report')}>Start a report</Button>
        </div>
      </AppShell>
    );
  }

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
        <div>
          <div className="mb-1.5 font-mono text-[11.5px] font-bold tracking-wide text-muted">YOUR REPORT</div>
          <p className="text-[15px] italic leading-relaxed text-muted-strong">
            “{draft.description}”
          </p>
        </div>

        <div className="rounded-card border border-gov-border bg-gov-bg p-4">
          <div className="flex items-center gap-2">
            <SparkleIcon size={20} className="text-gov" />
            <span className="flex-1 font-mono text-[12.5px] font-bold text-gov">Submission preview</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs">
            <Pill tone="gov">{draft.locationPrecision}</Pill>
            <Pill tone="gov">{draft.locationVisibility}</Pill>
            <Pill tone="gov">Routing pending</Pill>
          </div>
          {/* No polygon data exists yet, so the UI must not claim a ward or department. */}
          <div className="mt-3 text-[13px] leading-relaxed text-gov-text">
            Swaram will create the issue immediately. Classification, jurisdiction matching and duplicate review run
            afterward and cannot block this submission.
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-card bg-paper-card2 p-4">
          <LocationPinIcon size={26} className="flex-none text-rage" />
          <div className="flex-1">
            <div className="text-[14.5px] leading-snug">
              <strong>Phone location attached</strong>
            </div>
            <div className="mt-1 font-mono text-[11.5px] text-muted">
              No ward polygon is claimed · public view: {draft.locationVisibility.toLowerCase()}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2.5 px-5 pb-6">
        {!signedIn && (
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            className="w-full rounded-card border border-border-strong bg-paper px-4 py-3 text-sm outline-none focus:border-rage"
          />
        )}
        {error && <p className="text-sm leading-relaxed text-rage">{error}</p>}
        {notice && <p className="text-sm leading-relaxed text-gov">{notice}</p>}
        <Button variant="rage" onClick={handleSubmit} disabled={submitting} className="text-base">
          {submitting ? 'Submitting…' : signedIn ? 'Submit new problem' : 'Email me a sign-in link'}
        </Button>
        <Button variant="outline" onClick={() => navigate('/report')}>
          Edit report
        </Button>
      </div>
    </AppShell>
  );
}
