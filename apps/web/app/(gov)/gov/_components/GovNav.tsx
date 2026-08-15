'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/gov/dashboard', label: 'Dashboard' },
  { href: '/gov/queue', label: 'Queue' },
];

/** Sidebar nav for the gov shell. Client component only because
 *  `aria-current` needs the live pathname — everything else in this route
 *  group renders on the server. */
export function GovNav({ officerName, jurisdiction }: { officerName: string; jurisdiction: string }) {
  const pathname = usePathname();

  return (
    <aside className="sw-pane sw-nav">
      <div className="sw-masthead">
        <div className="t">SWARAM</div>
        <div className="s">GOVERNMENT LEDGER</div>
        <div className="d">{jurisdiction.toUpperCase()}</div>
      </div>
      <nav className="sw-navgroup">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href} className="sw-navitem" aria-current={active ? 'page' : undefined}>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="sw-colophon">
        SIGNED IN AS
        <br />
        {officerName.toUpperCase()}
        <br />
        RLS IS THE REAL BOUNDARY — THIS NAV IS UX ONLY.
      </div>
    </aside>
  );
}
