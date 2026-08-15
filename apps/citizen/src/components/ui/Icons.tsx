// Stroke-icon set traced from the SVG paths used throughout the design deck,
// so every screen shares exactly the icons the mockups shipped with.
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 22, ...props }: IconProps) {
  return { width: size, height: size, viewBox: '0 0 24 24', ...props };
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
      <path d="M4 11l8-6.5 8 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
    </svg>
  );
}

export function MapIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
      <path d="M9 5L4 7v12l5-2 6 2 5-2V5l-5 2z" />
      <path d="M9 5v12M15 7v12" />
    </svg>
  );
}

export function RecordIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
      <path d="M6 17V11a6 6 0 1 1 12 0v6l1.5 2h-15z" />
      <path d="M10.5 19a1.5 1.5 0 0 0 3 0" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
      <circle cx={12} cy={9} r={3.4} />
      <path d="M5.5 19.5a6.8 6.8 0 0 1 13 0" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <circle cx={11} cy={11} r={6.5} />
      <path d="M16 16l4.5 4.5" />
    </svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M12 3c1 3-1.5 4.2-1.5 6.6 0 1.4 1 2.4 1.5 2.9.6-.9 1.2-2 1.2-3.3 2 1.6 3.3 3.9 3.3 6.3a5.5 5.5 0 1 1-11 0C5.5 9.9 9.6 6.6 12 3z" />
    </svg>
  );
}

export function SupportHandIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
      <path d="M4 20V11l4.5-6a1.8 1.8 0 0 1 3 2l-1.2 3.4H17a2.2 2.2 0 0 1 2.1 2.8l-1.5 5.3A2.6 2.6 0 0 1 15 20z" />
    </svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
      <path d="M20 12a7.5 7.5 0 0 1-10.9 6.7L4 20l1.4-4.7A7.5 7.5 0 1 1 20 12z" />
    </svg>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 12v7h12v-7" />
      <path d="M12 15V4" />
      <path d="M8.5 7.5L12 4l3.5 3.5" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 6l-6 6 6 6" />
    </svg>
  );
}

export function GovBuildingIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
      <path d="M4 10l8-5 8 5" />
      <path d="M6 10v8M10 10v8M14 10v8M18 10v8" />
      <path d="M3.5 19h17" />
    </svg>
  );
}

export function LocationPinIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" />
      <circle cx={12} cy={10} r={2.4} />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  );
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v5.5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x={9} y={3} width={6} height={11} rx={3} />
      <path d="M5.5 12a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18.5V21" />
    </svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
      <path d="M4 8.5h3.5L9 6.5h6L16.5 8.5H20v10H4z" />
      <circle cx={12} cy={13} r={3.4} />
    </svg>
  );
}

export function TypeIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      <path d="M5 7h14M5 12h14M5 17h9" />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
      <path d="M12 3l2 4.6 4.6 2-4.6 2-2 4.6-2-4.6-4.6-2 4.6-2z" />
      <path d="M18 15.5l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9z" />
    </svg>
  );
}

export function TrendUpIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 17l5-5 3.5 3.5L20 8" />
      <path d="M15 8h5v5" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
      <circle cx={12} cy={12} r={8} />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
