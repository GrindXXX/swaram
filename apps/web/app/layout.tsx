import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Swaram',
  description: 'Civic issue reporting + public accountability layer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
