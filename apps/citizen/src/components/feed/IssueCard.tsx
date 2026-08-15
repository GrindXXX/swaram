import { useNavigate } from 'react-router-dom';
import type { Issue } from '../../lib/types';
import { Avatar } from '../ui/Avatar';
import { Pill } from '../ui/Pill';
import { RageMeter } from '../ui/RageMeter';
import { PhotoPlaceholder } from '../ui/PhotoPlaceholder';
import { Button } from '../ui/Button';
import { ChatIcon, SupportHandIcon, SparkleIcon, ShareIcon } from '../ui/Icons';
import { shareIssue } from '../../lib/share';

export function IssueCard({ issue }: { issue: Issue }) {
  const navigate = useNavigate();
  const initials = issue.authorHandle.replace('Citizen #', '');

  return (
    <article className="flex gap-3 border-b border-border-light py-4">
      <Avatar initials={initials} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-mono text-xs text-muted">
          <button onClick={() => navigate(`/i/${issue.id}`)} className="font-bold text-ink">
            {issue.authorHandle}
          </button>
          <span>·</span>
          <span>{issue.timeAgo}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-muted">
          <span>{issue.city}</span>
          <Pill>{issue.category}</Pill>
        </div>

        <button onClick={() => navigate(`/i/${issue.id}`)} className="block text-left">
          <h2 className="mt-2 font-display text-lg leading-tight">{issue.title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-strong">{issue.body}</p>
        </button>

        <PhotoPlaceholder className="mt-2.5 justify-between">
          <span className="rounded-full bg-ink/75 px-2.5 py-1 font-mono text-[10px] text-paper">
            {issue.photoCount} photos
          </span>
          {issue.overdueDays !== undefined && issue.overdueDays > 0 && (
            <span className="self-start -rotate-6 rounded border-2 border-rage bg-paper/55 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-rage">
              OVERDUE
            </span>
          )}
        </PhotoPlaceholder>

        {issue.rage > 0 && (
          <div className="mt-3">
            <RageMeter
              value={issue.rage}
              footer={`${issue.affected.toLocaleString()} affected · ${issue.reportCount} reports · heating up`}
            />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-muted-strong">
          <span className="flex items-center gap-1.5 font-mono text-xs">
            <ChatIcon size={19} /> {issue.replies.length || issue.reportCount}
          </span>
          <span className="flex items-center gap-1.5 font-mono text-xs">
            <SupportHandIcon size={19} /> {issue.standingWithCount}
          </span>
          <SparkleIcon size={19} />
          <button aria-label="Share issue" onClick={() => void shareIssue(issue.id, issue.title)}><ShareIcon size={19} /></button>
        </div>

        <Button
          variant="rage"
          className="mt-3 rounded-full"
          icon={<SupportHandIcon size={18} />}
          onClick={() => navigate(`/i/${issue.id}?action=facing`)}
        >
          I'm facing this too
        </Button>
      </div>
    </article>
  );
}
