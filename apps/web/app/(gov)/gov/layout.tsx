import '@/components/gov/newsprint.css';
import { GovNav } from './_components/GovNav';
import { OFFICER } from '@/components/gov/fixtures';

/**
 * Shell for everything under /gov. Two panes for now (nav + content) via
 * newsprint.css's `.sw-shell[data-panes="2"]` — the third pane it supports is
 * for a queue-list + ticket-detail split, which lands with /gov/t/[publicId].
 *
 * OFFICER here is the fixture identity (components/gov/fixtures.ts) used for
 * "signed in as" chrome and as the jurisdiction default when Supabase isn't
 * configured. It is NOT an auth bypass — middleware.ts already gates
 * everything under /gov on a real GOVERNMENT/ADMIN session before this layout
 * ever renders; this is display only.
 */
export default function GovLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sw sw-shell" data-panes="2">
      <GovNav officerName={OFFICER.name} jurisdiction={OFFICER.jurisdiction} />
      <main className="sw-pane">{children}</main>
    </div>
  );
}
