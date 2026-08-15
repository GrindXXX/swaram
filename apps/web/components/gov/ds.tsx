import type { ReactNode } from 'react';

type PillProps = { status?: string; priority?: string; size?: 'sm' | 'md' };

export function StatusPill({ status = '' }: PillProps) {
  return <span className="sw-pill" data-tone={status === 'IN_PROGRESS' ? 'gov' : 'muted'}>{status.replaceAll('_', ' ')}</span>;
}

export function PriorityPill({ priority = '' }: PillProps) {
  return <span className="sw-pill" data-tone={priority === 'CRITICAL' ? 'rage' : 'muted'}>{priority}</span>;
}

export function QueueRow({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function AITraceCard({ runs }: { runs: Array<{ agent_name: string; output: string; confidence: number; was_overridden: boolean }> }) {
  return <div className="sw-box">{runs.map((run, index) => <div className="sw-micro" key={`${run.agent_name}-${index}`}>{run.agent_name}: {run.output} ({Math.round(run.confidence * 100)}%){run.was_overridden ? ' · overridden' : ''}</div>)}</div>;
}
