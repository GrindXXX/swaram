import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { RageMeter } from '../components/ui/RageMeter';
import { StatTile } from '../components/ui/StatTile';
import { PhotoPlaceholder } from '../components/ui/PhotoPlaceholder';
import { GovBuildingIcon, ShieldCheckIcon, ChevronLeftIcon, ShareIcon } from '../components/ui/Icons';
import {
  addFacingTooReport,
  createPublicComment,
  getCitizenIssueState,
  getIssue,
  getSession,
  isSupabaseConfigured,
  setIssueFollowing,
  signInWithEmail,
} from '../lib/queries';
import { clearActionIntent, readActionIntent, saveActionIntent, type CitizenActionIntent } from '../lib/action-intent';
import { shareIssue } from '../lib/share';
import type { Issue } from '../lib/types';

export function Thread() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const resumedIntent = useRef(false);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [following, setFollowing] = useState(false);
  const [hasReported, setHasReported] = useState(false);
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState<CitizenActionIntent | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function reloadIssue() {
    if (!id) return;
    const loaded = await getIssue(id);
    setIssue(loaded);
  }

  async function executeIntent(intent: CitizenActionIntent) {
    if (!id) return;
    setWorking(true);
    setError(null);
    try {
      if (intent.action === 'follow') {
        const result = await setIssueFollowing(id, true);
        setFollowing(true);
        setIssue((current) => current && result ? { ...current, standingWithCount: result.follower_count } : current);
        setNotice('You are following this issue.');
      } else if (intent.action === 'comment' && intent.comment) {
        await createPublicComment(id, intent.comment);
        setComment('');
        await reloadIssue();
        setNotice('Your comment is public.');
      } else if (intent.action === 'facing') {
        const key = `swaram:facing:${id}`;
        const clientId = localStorage.getItem(key) ?? crypto.randomUUID();
        localStorage.setItem(key, clientId);
        const result = await addFacingTooReport(id, clientId);
        setHasReported(true);
        setFollowing(true);
        await reloadIssue();
        setNotice(result?.inserted ? 'Your report was added to this issue.' : 'You already reported this issue.');
      }
      clearActionIntent();
      setPending(null);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The action could not be completed.');
    } finally {
      setWorking(false);
    }
  }

  async function startAction(action: CitizenActionIntent['action']) {
    if (!id) return;
    setError(null);
    if (!isSupabaseConfigured) {
      setError('This is demo data. Configure Supabase to use live citizen actions.');
      return;
    }
    const intent = { issueId: id, action, ...(action === 'comment' ? { comment: comment.trim() } : {}) };
    if (action === 'comment' && !comment.trim()) return;
    if (!signedIn) {
      saveActionIntent(intent);
      setPending(intent);
      setNotice('Sign in by email to complete this action. Your intent is saved.');
      return;
    }
    await executeIntent(intent);
  }

  useEffect(() => {
    let active = true;
    if (!id) return;
    resumedIntent.current = false;
    setLoading(true);
    setError(null);
    Promise.all([getIssue(id), getSession()])
      .then(async ([loaded, session]) => {
        if (!active) return;
        setIssue(loaded);
        setSignedIn(Boolean(session));
        if (session && loaded) {
          const state = await getCitizenIssueState(id);
          if (active) {
            setFollowing(state.isFollowing);
            setHasReported(state.hasReported);
          }
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load this issue.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!id || loading || !issue || issue.id !== id || resumedIntent.current) return;
    const stored = readActionIntent();
    const requested = new URLSearchParams(location.search).get('action');
    if (!stored && requested === 'facing') {
      void startAction('facing');
      resumedIntent.current = true;
      return;
    }
    if (stored?.issueId === id) {
      resumedIntent.current = true;
      setComment(stored.comment ?? '');
      if (signedIn) void executeIntent(stored);
      else setPending(stored);
    }
  }, [id, issue, loading, location.search, signedIn]);

  async function sendSignInLink() {
    if (!email.trim()) {
      setError('Enter your email to receive a sign-in link.');
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await signInWithEmail(email.trim(), `/i/${id}`);
      setNotice('Check your email. Returning from the link will complete your saved action.');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Could not send the sign-in link.');
    } finally {
      setWorking(false);
    }
  }

  async function toggleFollowing() {
    if (!signedIn && !following) {
      await startAction('follow');
      return;
    }
    if (!id) return;
    setWorking(true);
    try {
      const result = await setIssueFollowing(id, !following);
      setFollowing(!following);
      if (result) setIssue((current) => current && { ...current, standingWithCount: result.follower_count });
    } catch (followError) {
      setError(followError instanceof Error ? followError.message : 'Could not update your follow.');
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return <AppShell nav={false}><p className="m-auto font-mono text-xs text-muted">Loading issue...</p></AppShell>;
  }

  if (!issue) {
    return (
      <AppShell nav={false}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="font-display text-2xl">Issue not found</h1>
          <p className="text-sm text-muted">This civic record does not exist or is not visible to you.</p>
          {error && <p className="text-sm text-rage">{error}</p>}
          <button onClick={() => navigate('/')} className="font-mono text-xs font-bold">Back to feed</button>
        </div>
      </AppShell>
    );
  }

  const initials = issue.authorHandle.replace('Citizen #', '');
  const composer = (
    <div className="safe-bottom border-t border-border-strong bg-paper-chip px-4 pb-4 pt-3">
      <div className="flex items-center gap-2.5">
        <input
          value={comment}
          maxLength={1000}
          onChange={(event) => setComment(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') void startAction('comment'); }}
          placeholder="Add a public comment..."
          className="min-w-0 flex-1 rounded-full border border-border-strong bg-paper px-4 py-3 font-mono text-[12.5px] outline-none focus:border-rage"
        />
        <button onClick={() => void startAction('comment')} disabled={working || !comment.trim()} className="min-h-[48px] rounded-full bg-ink px-5 font-mono text-[12.5px] font-bold text-paper disabled:opacity-40">Post</button>
      </div>
    </div>
  );

  return (
    <AppShell nav={false} footer={composer}>
      <header className="flex items-center justify-between border-b border-border px-4 pb-3 pt-2">
        <button onClick={() => navigate(-1)} className="text-muted-strong"><ChevronLeftIcon size={22} /></button>
        <span className="font-mono text-[13px] font-bold">Issue {issue.id}</span>
        <button aria-label="Share issue" onClick={() => void shareIssue(issue.id, issue.title).then((result) => { if (result !== 'cancelled') setNotice(result === 'copied' ? 'Issue link copied.' : 'Issue shared.'); }).catch(() => setError('Could not share this issue.'))}>
          <ShareIcon size={22} className="text-muted-strong" />
        </button>
      </header>

      <div className="px-4 pb-4 pt-4">
        {!isSupabaseConfigured && <p className="mb-3 text-center font-mono text-[10px] font-bold text-rage">DEMO DATA · LIVE ACTIONS DISABLED</p>}
        <div className="flex items-center gap-3">
          <Avatar initials={initials} size={46} />
          <div className="flex-1">
            <div className="font-mono text-[13px] font-bold">{issue.authorHandle}</div>
            <div className="mt-0.5 font-mono text-[11px] text-muted">{issue.city} · {issue.ward} · {issue.filedOn}</div>
          </div>
          <button onClick={() => void toggleFollowing()} disabled={working} className={`rounded-full border px-3 py-2 font-mono text-[11px] font-bold ${following ? 'border-rage text-rage' : 'border-border-strong'}`}>
            {following ? 'Following' : 'Follow'}
          </button>
        </div>

        <h2 className="mt-3.5 font-display text-2xl leading-tight">{issue.title}</h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-muted-strong">{issue.body}</p>
        {!issue.publishedToFeed && <div className="mt-3 rounded-card border border-gov-border bg-gov-bg px-3 py-2 text-sm text-gov-text">Created successfully. Safety review and routing are pending; this is visible to you but not the public feed.</div>}
        <PhotoPlaceholder height={104} className="mt-3" />
        {issue.rage > 0 && <div className="mt-3.5"><RageMeter value={issue.rage} size="lg" /></div>}
        <div className="mt-3 flex gap-2">
          <StatTile value={issue.affected.toLocaleString()} label="affected" />
          <StatTile value={issue.reportCount} label="reports" />
          <StatTile value={issue.standingWithCount} label="following" />
        </div>

        <Button variant="rage" className="mt-4 rounded-full" onClick={() => void startAction('facing')} disabled={working || hasReported}>
          {hasReported ? 'You reported this too' : "I'm facing this too"}
        </Button>

        {(error || notice) && <p className={`mt-3 text-sm ${error ? 'text-rage' : 'text-gov'}`}>{error ?? notice}</p>}
        {pending && !signedIn && (
          <div className="mt-3 rounded-card border border-gov-border bg-gov-bg p-3">
            <p className="text-sm text-gov-text">Sign in to {pending.action === 'facing' ? 'add your report to this issue' : pending.action}.</p>
            <div className="mt-2 flex gap-2">
              <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className="min-w-0 flex-1 rounded-lg border border-border-strong bg-paper px-3 py-2 text-sm" />
              <button onClick={() => void sendSignInLink()} disabled={working} className="rounded-lg bg-gov px-3 font-mono text-xs font-bold text-paper">Email link</button>
            </div>
          </div>
        )}

        <div className="mb-1 mt-4 font-mono text-[11.5px] font-bold tracking-wide text-muted">{issue.replies.length} PUBLIC COMMENTS</div>
        {issue.replies.map((reply) => reply.authorKind === 'citizen' ? (
          <div key={reply.id} className="flex gap-2.5 border-t border-border-light py-2.5">
            <Avatar initials={reply.authorLabel.replace('#', '')} size={36} />
            <div><div className="font-mono text-[11.5px] text-muted"><span className="font-bold text-ink">{reply.authorLabel}</span> · {reply.timeAgo}</div><p className="mt-1 text-sm leading-relaxed">{reply.body}</p></div>
          </div>
        ) : (
          <div key={reply.id} className="mt-1.5 flex gap-2.5 rounded-xl border border-gov-border bg-gov-bg p-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-gov bg-[#DDE6E4] text-gov"><GovBuildingIcon size={18} /></div>
            <div><div className="flex items-center gap-1 font-mono text-[11.5px] text-muted"><span className="font-bold text-gov">{reply.authorLabel}</span><ShieldCheckIcon size={13} className="text-gov" /><span>· {reply.timeAgo}</span></div><p className="mt-1 text-sm leading-relaxed text-gov-text">{reply.body}</p></div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
