import { useEffect, useRef, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { Pill } from '../components/ui/Pill';
import { initCivicTerrain } from '../lib/civic-terrain';
import { getJurisdictionCounts, isSupabaseConfigured } from '../lib/queries';
import '../styles/civic-terrain.css';

// Unlike every other screen, this one doesn't sit inside AppShell's
// 480px phone-frame clamp — the terrain view genuinely wants the width
// (it's a real data map, not a card list), so it goes full-bleed above the
// tab bar instead.
export function MapView() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [realCounts, setRealCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const destroy = initCivicTerrain(rootRef.current);
    return destroy;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    getJurisdictionCounts().then((counts) => { if (active) setRealCounts(counts); });
    return () => { active = false; };
  }, []);

  return (
    <AppShell>
      <header className="flex items-center justify-between px-4 pb-3 pt-2">
        <span className="font-display text-2xl tracking-wide">SWARAM</span>
        <Pill>Ward 42 ▾</Pill>
      </header>

      <div className="px-4 pb-5">
        <h1 className="font-display text-[28px] leading-tight">The Civic Terrain</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-muted-strong">
          Every open record, laid out by state and district. Scroll down to survey the columns.
        </p>
      </div>

      {isSupabaseConfigured && (
        <div className="px-4 pb-5">
          <div className="mb-2 font-mono text-[11px] font-bold tracking-wide text-muted">
            REAL ISSUE COUNTS BY JURISDICTION
          </div>
          {realCounts === null ? (
            <p className="font-mono text-xs text-muted">Loading…</p>
          ) : Object.keys(realCounts).length === 0 ? (
            <p className="text-sm text-muted">No jurisdiction-tagged issues yet.</p>
          ) : (
            <div className="rounded-card border border-border-strong bg-paper-card2 p-3.5">
              {Object.entries(realCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <div key={name} className="flex justify-between border-b border-border-light py-2 text-sm last:border-0">
                    <span>{name}</span>
                    <span className="font-mono font-bold text-rage">{count}</span>
                  </div>
                ))}
            </div>
          )}
          <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-muted-soft">
            Real counts, grouped by whatever jurisdiction each issue's routing landed on — not the same as the
            terrain map below, which renders official state/district geometry with no boundary data behind it yet
            (see the sample-figures stamp on it).
          </p>
        </div>
      )}

      <div className="px-3.5 pb-8">
        <div
          className="civic-terrain overflow-hidden rounded-card border border-border-strong shadow-[6px_6px_0_rgba(0,0,0,.18)]"
          ref={rootRef}
        />
      </div>
    </AppShell>
  );
}
