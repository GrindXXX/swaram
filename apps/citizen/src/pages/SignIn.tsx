import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { ChevronLeftIcon } from '../components/ui/Icons';
import { isSupabaseConfigured, signInWithEmail, signInWithPassword } from '../lib/queries';

export function SignIn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function handleSignIn() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      await signInWithPassword(email.trim(), password);
      navigate(next, { replace: true });
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Could not sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMagicLink() {
    setError(null);
    if (!email.trim()) {
      setError('Enter your email first.');
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmail(email.trim(), next);
      setMagicLinkSent(true);
      setNotice('Check your email for a sign-in link.');
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : 'Could not send the sign-in link.');
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
        <h1 className="flex-1 text-center font-display text-xl">Sign in</h1>
        <span className="w-[22px]" />
      </header>

      <div className="mx-auto mt-10 max-w-sm px-6">
        {!isSupabaseConfigured && (
          <p className="mb-5 text-center font-mono text-[10px] font-bold text-rage">
            DEMO DATA · SUPABASE NOT CONFIGURED — SIGN-IN IS DISABLED
          </p>
        )}

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
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') void handleSignIn(); }}
          placeholder="Password"
          disabled={!isSupabaseConfigured}
          className="mt-2.5 w-full rounded-card border border-border-strong bg-paper px-4 py-3 text-sm outline-none focus:border-rage disabled:opacity-50"
        />

        <Button className="mt-3.5" onClick={() => void handleSignIn()} disabled={submitting || !isSupabaseConfigured}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>

        {(error || notice) && (
          <p className={`mt-3 text-center text-sm ${error ? 'text-rage' : 'text-gov'}`}>{error ?? notice}</p>
        )}

        <div className="mt-5 flex items-center gap-3 text-muted-soft">
          <div className="h-px flex-1 bg-border" />
          <span className="font-mono text-[10px] tracking-wide">OR</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={() => void handleMagicLink()}
          disabled={submitting || !isSupabaseConfigured || magicLinkSent}
          className="mt-3.5 w-full rounded-card border border-border-strong py-3 font-mono text-[12.5px] font-bold text-ink disabled:opacity-50"
        >
          {magicLinkSent ? 'Link sent — check your email' : 'Email me a sign-in link instead'}
        </button>

        <p className="mt-6 text-center text-sm text-muted">
          New here? <Link to={`/sign-up?next=${encodeURIComponent(next)}`} className="font-bold text-rage">Create an account</Link>
        </p>
      </div>
    </AppShell>
  );
}
