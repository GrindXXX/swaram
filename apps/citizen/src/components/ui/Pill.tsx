import type { ReactNode } from 'react';

const TONES = {
  neutral: 'bg-paper-chip text-muted-strong',
  ink: 'bg-ink text-paper',
  rage: 'bg-rage/10 text-rage',
  gov: 'bg-gov-bg text-gov',
  resolved: 'bg-resolved text-paper font-bold',
} as const;

interface PillProps {
  children: ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}

export function Pill({ children, tone = 'neutral', className = '' }: PillProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-xs ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}
