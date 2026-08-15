import { FlameIcon } from './Icons';

interface RageMeterProps {
  value: number; // 0-100
  label?: string;
  size?: 'sm' | 'lg';
  footer?: string;
}

// The signature "gauge that burns" component: a pulsing flame, a heat-glow
// track, and a value that reads hot past ~70. Default label matches the
// deck's default pressureLabel prop ("RAGE METER"); swap for "CIVIC PRESSURE"
// or "PRESSURE INDEX" per the same enum the source design exposed.
export function RageMeter({ value, label = 'RAGE METER', size = 'sm', footer }: RageMeterProps) {
  const big = size === 'lg';
  return (
    <div className="relative overflow-hidden rounded-card bg-paper-card2 px-3.5 py-3">
      <div
        className="pointer-events-none absolute inset-0 animate-sw-glow"
        style={{ background: 'radial-gradient(ellipse at 84% 100%, rgba(196,112,58,.5), transparent 60%)' }}
      />
      <div className="relative flex items-center gap-2">
        <FlameIcon size={big ? 20 : 18} className="animate-sw-flick text-rage" style={{ transformOrigin: '50% 100%' }} />
        <span className={`flex-1 font-mono font-bold tracking-wide text-rage ${big ? 'text-xs' : 'text-[11.5px]'}`}>
          {label}
        </span>
        <span className={`font-mono font-bold text-rage ${big ? 'text-2xl' : 'text-lg'}`}>{value}</span>
      </div>
      <div
        className="relative mt-2.5 overflow-visible rounded-full bg-rage/15"
        style={{ height: big ? 13 : 11 }}
      >
        <div
          className="absolute inset-y-0 left-0 animate-sw-heat rounded-full"
          style={{ width: `${value}%`, background: 'linear-gradient(90deg,#7c2915,#9E351B 55%,#C4703A)' }}
        />
        {value >= 40 && (
          <FlameIcon
            size={big ? 22 : 18}
            className="absolute animate-sw-flick text-rage-ember"
            style={{ left: `calc(${value}% - 10px)`, bottom: big ? 6 : 4, transformOrigin: '50% 100%' }}
          />
        )}
      </div>
      {footer && <div className="relative mt-2 font-mono text-[11px] text-muted">{footer}</div>}
    </div>
  );
}
