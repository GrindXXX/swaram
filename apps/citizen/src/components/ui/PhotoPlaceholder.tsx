import type { ReactNode } from 'react';

interface PhotoPlaceholderProps {
  height?: number | string;
  className?: string;
  children?: ReactNode;
}

// Every design mockup used a hatched rectangle as a photo stand-in rather
// than a real image. Kept identical here — swap for <img> once evidence
// photos come from Supabase storage.
export function PhotoPlaceholder({ height = 146, className = '', children }: PhotoPlaceholderProps) {
  return (
    <div
      className={`relative flex items-end rounded-card border border-border-strong bg-[#E4D8BC] p-2.5 ${className}`}
      style={{
        height,
        backgroundImage: 'repeating-linear-gradient(45deg, rgba(41,37,31,.09) 0 1px, transparent 1px 7px)',
      }}
    >
      {children}
    </div>
  );
}
