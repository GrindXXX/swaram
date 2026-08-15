import { useEffect, useRef } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { Pill } from '../components/ui/Pill';
import { initCivicTerrain } from '../lib/civic-terrain';
import '../styles/civic-terrain.css';

// The terrain widget used to take over the whole screen the instant you
// opened this tab. Now it sits in the normal scrolling page like every other
// screen: SWARAM heading first, terrain revealed below the fold as you
// scroll — same AppShell + BottomNav as the rest of the app instead of a
// one-off full-bleed layout.
export function MapView() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const destroy = initCivicTerrain(rootRef.current);
    return destroy;
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

      <div className="px-3.5 pb-8">
        <div
          className="civic-terrain overflow-hidden rounded-card border border-border-strong shadow-[6px_6px_0_rgba(0,0,0,.18)]"
          ref={rootRef}
        />
      </div>
    </AppShell>
  );
}
