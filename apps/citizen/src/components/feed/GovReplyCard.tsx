import { GovBuildingIcon, ShieldCheckIcon } from '../ui/Icons';

interface GovReplyCardProps {
  department: string;
  timeAgo: string;
  body: string;
}

export function GovReplyCard({ department, timeAgo, body }: GovReplyCardProps) {
  return (
    <article className="mt-3 flex gap-3 rounded-xl border border-gov-border bg-gov-bg p-3">
      <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-gov bg-[#DDE6E4] text-gov">
        <GovBuildingIcon size={22} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5 font-mono text-xs text-muted">
          <span className="font-bold text-gov">{department}</span>
          <ShieldCheckIcon size={14} className="text-gov" />
          <span>· {timeAgo}</span>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-gov-text">{body}</p>
      </div>
    </article>
  );
}
