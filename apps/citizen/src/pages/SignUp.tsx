import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { ChevronLeftIcon, ShieldCheckIcon } from '../components/ui/Icons';
import { isSupabaseConfigured, signUpWithPassword } from '../lib/queries';

export function SignUp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSignUp() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter an email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const { needsEmailConfirmation } = await signUpWithPassword(email.trim(), password);
      if (needsEmailConfirmation) {
        setNeedsConfirmation(true);
      } else {
        navigate(next, { replace: true });
      }
    } catch (signUpError) {
      setError(signUpError instanceof Error ? signUpError.message : 'Could not create the account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell nav={false}>
      <header className="flex items-center border-b border-border px-4 pb-3 pt-2">
        <button onClick={() => navigate(-1)} className="text-muted-strong">
          <ChevronLeftIcon size={22} />
        </button>
        <h1 className="flex-1 text-center font-display text-xl">Create account</h1>
        <span className="w-[22px]" />
      </header>

      <div className="mx-auto mt-10 max-w-sm px-6">
        {!isSupabaseConfigured && (
          <p className="mb-5 text-center font-mono text-[10px] font-bold text-rage">
            DEMO DATA · SUPABASE NOT CONFIGURED — SIGN-UP IS DISABLED
          </p>
        )}

        {needsConfirmation ? (
          <div className="rounded-card border border-gov-border bg-gov-bg p-4 text-center">
            <ShieldCheckIcon size={24} className="mx-auto text-gov" />
            <p className="mt-2 text-sm text-gov-text">
              Account created. Check your email to confirm it, then{' '}
              <Link to={`/sign-in?next=${encodeURIComponent(next)}`} className="font-bold underline">sign in</Link>.
            </p>
          </div>
        ) : (
          <>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email address"
              disabled={!isSupabaseConfigured}
              className="w-full rounded-card border border-border-strong bg-paper px-4 py-3 text-sm outline-none focus:border-rage disabled:opacity-50"
            />
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password (min. 6 characters)"
              disabled={!isSupabaseConfigured}
              className="mt-2.5 w-full rounded-card border border-border-strong bg-paper px-4 py-3 text-sm outline-none focus:border-rage disabled:opacity-50"
            />
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void handleSignUp(); }}
              placeholder="Confirm password"
              disabled={!isSupabaseConfigured}
              className="mt-2.5 w-full rounded-card border border-border-strong bg-paper px-4 py-3 text-sm outline-none focus:border-rage disabled:opacity-50"
            />

            <Button className="mt-3.5" onClick={() => void handleSignUp()} disabled={submitting || !isSupabaseConfigured}>
              {submitting ? 'Creating account…' : 'Create account'}
            </Button>

            {error && <p className="mt-3 text-center text-sm text-rage">{error}</p>}

            <p className="mt-6 text-center text-sm text-muted">
              Already have an account?{' '}
              <Link to={`/sign-in?next=${encodeURIComponent(next)}`} className="font-bold text-rage">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
