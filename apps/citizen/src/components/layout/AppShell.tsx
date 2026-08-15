import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface AppShellProps {
  children: ReactNode;
  nav?: boolean;
  footer?: ReactNode;
  className?: string;
}

// Capacitor renders the real OS status bar, so — unlike the design deck,
// which drew a fake "9:41 · 4G" row on every screen to sell the phone-frame
// mockup — this shell only reserves safe-area space and lets content start
// there. On web (npm run dev) the max-w-mobile clamp keeps it phone-shaped.
//
// `footer` is for screens that replace the tab bar with something else (a
// reply composer, a "Verify" bar) — it's pinned outside the scroll area the
// same way `nav` is. Pass at most one of `nav` / `footer`.
export function AppShell({ children, nav = true, footer, className = '' }: AppShellProps) {
  return (
    <div className="mx-auto flex h-screen max-w-[480px] flex-col bg-paper">
      <div className={`safe-top flex-1 overflow-y-auto ${className}`}>{children}</div>
      {footer}
      {nav && <BottomNav />}
    </div>
  );
}
