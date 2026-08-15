import { sendMagicLink } from './actions';

type Props = { searchParams: { next?: string; sent?: string; error?: string } };

export default function SignInPage({ searchParams }: Props) {
  const next = searchParams.next?.startsWith('/') && !searchParams.next.startsWith('//') && !searchParams.next.includes('\\')
    ? searchParams.next
    : '/gov';
  return (
    <section className="auth-card">
      <div className="kicker">Government desk · secure access</div>
      <h1>Sign in to Swaram</h1>
      <p>Use your official roster email. Access is granted from the active government officer registry, never from the address alone.</p>
      <hr className="auth-rule" />
      {searchParams.sent === '1' && <p className="auth-notice">Check your inbox. The secure link returns you to your intended page.</p>}
      {searchParams.error && <p className="auth-notice auth-error">{searchParams.error}</p>}
      <form action={sendMagicLink}>
        <input type="hidden" name="next" value={next} />
        <label className="auth-label" htmlFor="email">Official email</label>
        <input className="auth-input" id="email" name="email" type="email" autoComplete="email" required placeholder="officer@agency.gov.in" />
        <button className="auth-submit" type="submit">Email a magic link</button>
      </form>
      <p className="auth-foot">A valid sign-in without an active officer posting remains a citizen account and cannot enter the government desk.</p>
    </section>
  );
}
