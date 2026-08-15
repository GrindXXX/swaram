import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Swaram',
  description: 'Swaram — the civic record.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
