interface StatTileProps {
  value: string | number;
  label: string;
  tone?: 'default' | 'rage' | 'resolved';
}

const TONE_CLASS = {
  default: 'text-ink',
  rage: 'text-rage',
  resolved: 'text-resolved',
};

export function StatTile({ value, label, tone = 'default' }: StatTileProps) {
  return (
    <div className="flex-1 rounded-card bg-paper-card2 px-3 py-3 text-center">
      <div className={`font-mono text-lg font-bold ${TONE_CLASS[tone]}`}>{value}</div>
      <div className="mt-1 font-mono text-[10px] text-muted">{label}</div>
    </div>
  );
}
